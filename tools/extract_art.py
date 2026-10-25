"""Cut painted reference sheets into clean pixel-art atlases for src/world.

    python3 tools/extract_art.py                      # build every atlas in art-manifest.json
    python3 tools/extract_art.py --only tree-kit      # build one atlas
    python3 tools/extract_art.py --find-boxes SHEET   # print the frame boxes found on a new sheet
    python3 tools/extract_art.py --preview DIR        # also write 5x previews on a dark background

The sources are JPEGs of pixel art drawn several image pixels per art pixel,
either framed on a grey grid (frame boxes listed in the manifest) or loose on a
flat background colour in rows (boxes found automatically). For each frame this
keys out the background, finds the art pixel grid (one pitch per group, one
phase per frame) and samples the middle of every cell. Needs Pillow and numpy
(tools/requirements.txt). See tools/README.md for adding a new sheet.
"""

import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
MANIFEST = HERE / 'art-manifest.json'
ASSETS = HERE.parent / 'src/world/assets'
LAYOUT_TS = HERE.parent / 'src/world/artLayout.ts'
INSET = 6
# Blue minus red: the grey sheets' background and grid lines sit at 4 to 14 (and between
# 130 and 190 bright), bark below 2.
WARM_GREY = 2


# --- keying and grid sampling ------------------------------------------------

def foreground(rgb):
    """Everything except the sheet's grey background and its grid lines. That grey is
    cool (blue above red) and mid-bright; the spirit's and the kit's olive bark is just
    as grey but warm, and teeth and sparkles are near white, so those are art."""
    lum = rgb.mean(axis=2)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    cool = rgb[:, :, 2] - rgb[:, :, 0] >= WARM_GREY
    return ~((sat < 24) & (lum > 92) & (lum <= 200) & cool)


def colour_key(colours, tolerance):
    """Foreground for sheets on flat background colours (a page, and lighter cells on it).
    The key keeps its colours so sampling can tell a hole in a robe from a gap under an arm."""
    colours = [np.asarray(c) for c in colours]

    def key(rgb):
        return np.min([np.abs(rgb - c).max(axis=2) for c in colours], axis=0) > tolerance

    key.colours = colours
    return key


def sheet_background(image):
    a = np.asarray(image).astype(int)
    border = np.concatenate([a[:4].reshape(-1, 3), a[-4:].reshape(-1, 3), a[:, :4].reshape(-1, 3), a[:, -4:].reshape(-1, 3)])
    return np.median(border, axis=0)


def crop(image, box, key=foreground, inset=INSET):
    x0, y0, x1, y1 = box
    rgb = np.asarray(image.crop((x0 + inset, y0 + inset, x1 - inset, y1 - inset))).astype(int)
    return rgb, key(rgb)


def edge_signal(rgb, mask, axis):
    grad = np.abs(np.diff(rgb, axis=axis)).sum(axis=2)
    m = mask[:, 1:] if axis == 1 else mask[1:, :]
    return (grad * m).sum(axis=0 if axis == 1 else 1)


def best_phase(signal, pitch):
    best = (-1.0, 0.0)
    for phase in np.arange(0, pitch, 0.25):
        idx = np.round(np.arange(phase, len(signal), pitch)).astype(int)
        idx = idx[idx < len(signal)]
        score = signal[idx].sum() / max(1, len(idx))
        if score > best[0]:
            best = (score, phase)
    return best


def shared_pitch(crops, lo=5.3, hi=6.4):
    """One pitch for a group of frames drawn at the same scale: coarse search, then fine."""
    signals = [[edge_signal(rgb, mask, axis) for axis in (0, 1)] for rgb, mask in crops[:16]]

    def score(pitch):
        return sum(best_phase(s, pitch)[0] for pair in signals for s in pair)

    coarse = max(np.arange(lo, hi, 0.05), key=score)
    return max(np.arange(coarse - 0.05, coarse + 0.05, 0.01), key=score)


HOLE_TOLERANCE = 7
SLIVER_TOLERANCE = 3
# Enclosed pockets this small are never gaps the artist meant to see through; bigger ones
# are the space between a figure and its staff, banner or tools.
SMALL_POCKET = 16


def sample(rgb, mask, pitch, bg_colours=None):
    phase_x = best_phase(edge_signal(rgb, mask, 1), pitch)[1]
    phase_y = best_phase(edge_signal(rgb, mask, 0), pitch)[1]
    h, w, _ = rgb.shape
    cols = int((w - phase_x) // pitch)
    rows = int((h - phase_y) // pitch)
    out = np.zeros((rows, cols, 4), dtype=np.uint8)
    every = np.zeros((rows, cols, 3), dtype=np.uint8)
    for r in range(rows):
        for c in range(cols):
            x0 = phase_x + c * pitch
            y0 = phase_y + r * pitch
            xs = slice(int(round(x0 + pitch * 0.3)), int(round(x0 + pitch * 0.7)) + 1)
            ys = slice(int(round(y0 + pitch * 0.3)), int(round(y0 + pitch * 0.7)) + 1)
            cell = mask[ys, xs]
            if cell.size == 0:
                continue
            every[r, c] = np.median(rgb[ys, xs].reshape(-1, 3), axis=0)
            if cell.mean() < 0.5:
                continue
            out[r, c, :3] = np.median(rgb[ys, xs][cell], axis=0)
            out[r, c, 3] = 255
    clear = out[:, :, 3] == 0
    if bg_colours is not None and clear.any():
        # The background drifts a few levels across a sheet; judge each frame by its own too.
        bg_colours = [*bg_colours, np.median(every[clear], axis=0)]
    if bg_colours is not None:
        fill_holes(out, every, bg_colours)
        fill_slivers(out, every, bg_colours)
        close_dents(out, every, bg_colours)
        # Closing cracks can seal off new pockets.
        fill_holes(out, every, bg_colours)
    else:
        # Framed sheets: what the grey key dropped inside a figure is patched from around it.
        close_dents(out)
        fill_holes(out)
    return drop_specks(out)


def patch(sprite, todo, colours=None, bg_colours=None):
    """Make the pixels in `todo` opaque. One whose cell median is clearly art keeps that
    colour; one that looks like the background (or on a framed sheet, any) takes the median
    of its opaque neighbours, working inwards, so a patch matches what surrounds it. Next
    to dark outlines the JPEG darkens the background a few levels, so "clearly" is the
    wider hole margin, not the sliver one."""
    todo = todo.copy()
    if colours is not None:
        for y, x in zip(*np.nonzero(todo)):
            c = colours[y, x].astype(int)
            if min(np.abs(c - bg).max() for bg in bg_colours) > HOLE_TOLERANCE:
                sprite[y, x, :3] = c
                sprite[y, x, 3] = 255
                todo[y, x] = False
    h, w = todo.shape
    while todo.any():
        solid = (sprite[:, :, 3] > 0) & ~todo
        ready = []
        for y, x in zip(*np.nonzero(todo)):
            near = solid[max(0, y - 1):y + 2, max(0, x - 1):x + 2]
            if near.any():
                ready.append((y, x, np.median(sprite[max(0, y - 1):y + 2, max(0, x - 1):x + 2][near][:, :3], axis=0)))
        if not ready:
            break
        for y, x, c in ready:
            sprite[y, x, :3] = c
            sprite[y, x, 3] = 255
            todo[y, x] = False


def fill_holes(sprite, colours=None, bg_colours=None):
    """Clear pockets the figure fully encloses are clothing the key mistook for background
    (dark robes, armour); give them back their colour. Small pockets are always filled;
    larger ones that really are the background colour (between an arm and a staff) stay
    clear, and on framed sheets (no colours) only small ones are filled."""
    clear = sprite[:, :, 3] == 0
    h, w = clear.shape
    outside = np.zeros_like(clear)
    stack = [(y, x) for y in range(h) for x in (0, w - 1) if clear[y, x]]
    stack += [(y, x) for x in range(w) for y in (0, h - 1) if clear[y, x]]
    while stack:
        y, x = stack.pop()
        if outside[y, x]:
            continue
        outside[y, x] = True
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and clear[ny, nx] and not outside[ny, nx]:
                stack.append((ny, nx))
    pocket = np.zeros(clear.shape, dtype=int)
    sizes = [0]
    for y, x in zip(*np.nonzero(clear & ~outside)):
        if pocket[y, x]:
            continue
        sizes.append(0)
        stack = [(y, x)]
        pocket[y, x] = len(sizes) - 1
        while stack:
            cy, cx = stack.pop()
            sizes[-1] += 1
            for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                if 0 <= ny < h and 0 <= nx < w and clear[ny, nx] and not outside[ny, nx] and not pocket[ny, nx]:
                    pocket[ny, nx] = len(sizes) - 1
                    stack.append((ny, nx))
    todo = np.zeros_like(clear)
    for y, x in zip(*np.nonzero(pocket)):
        if sizes[pocket[y, x]] <= SMALL_POCKET:
            todo[y, x] = True
        elif colours is not None:
            todo[y, x] = min(np.abs(colours[y, x].astype(int) - bg).max() for bg in bg_colours) > HOLE_TOLERANCE
    patch(sprite, todo, colours, bg_colours)


def fill_slivers(sprite, colours, bg_colours):
    """Clothing shaded almost exactly like the background leaves thin cracks open to the
    outside, which fill_holes cannot reach. Close gaps up to two pixels wide between
    opaque pixels, unless the cell's median really is the background (cell medians are
    far steadier than single pixels, so a small margin is enough)."""
    for _ in range(2):
        solid = sprite[:, :, 3] > 0
        h, w = solid.shape
        at = lambda y, x: 0 <= y < h and 0 <= x < w and solid[y, x]
        for y, x in zip(*np.nonzero(~solid)):
            across = at(y, x - 1) and (at(y, x + 1) or at(y, x + 2))
            down = at(y - 1, x) and (at(y + 1, x) or at(y + 2, x))
            if not (across or down):
                continue
            c = colours[y, x].astype(int)
            if min(np.abs(c - bg).max() for bg in bg_colours) > SLIVER_TOLERANCE:
                sprite[y, x, :3] = c
                sprite[y, x, 3] = 255


def close_dents(sprite, colours=None, bg_colours=None):
    """A one-pixel dent with three opaque sides is a break in the outline whatever its
    colour (often left by closing the slivers next to it), so it is patched. Repeated
    until none are left; a dent only ever leads to another inside the same notch."""
    while True:
        solid = sprite[:, :, 3] > 0
        padded = np.pad(solid, 1)
        sides = padded[:-2, 1:-1].astype(int) + padded[2:, 1:-1] + padded[1:-1, :-2] + padded[1:-1, 2:]
        dents = ~solid & (sides >= 3)
        if not dents.any():
            return
        patch(sprite, dents, colours, bg_colours)


def drop_specks(sprite):
    """Clear opaque pixels with no opaque 4-neighbour (JPEG noise on grid lines)."""
    a = sprite[:, :, 3] > 0
    padded = np.pad(a, 1)
    neighbours = padded[:-2, 1:-1] | padded[2:, 1:-1] | padded[1:-1, :-2] | padded[1:-1, 2:]
    sprite[a & ~neighbours] = 0
    return sprite


def isolate(sprite):
    """Keep the main figure and bits close to it (sparkles, zzz); drop stray pieces of
    labels or neighbouring frames that fell inside the box."""
    a = sprite[:, :, 3] > 0
    label = np.zeros(a.shape, dtype=int)
    boxes = []
    for y, x in zip(*np.nonzero(a)):
        if label[y, x]:
            continue
        n = len(boxes) + 1
        stack, area, y0, x0, y1, x1 = [(y, x)], 0, y, x, y, x
        label[y, x] = n
        while stack:
            cy, cx = stack.pop()
            area += 1
            y0, x0, y1, x1 = min(y0, cy), min(x0, cx), max(y1, cy), max(x1, cx)
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < a.shape[0] and 0 <= nx < a.shape[1] and a[ny, nx] and not label[ny, nx]:
                        label[ny, nx] = n
                        stack.append((ny, nx))
        boxes.append((area, y0, x0, y1, x1))
    if len(boxes) < 2:
        return sprite
    main = max(range(len(boxes)), key=lambda i: boxes[i][0])
    _, my0, mx0, my1, mx1 = boxes[main]
    pad = max(3, int(0.35 * max(my1 - my0, mx1 - mx0)))
    for i, (_, y0, x0, y1, x1) in enumerate(boxes):
        near = y1 >= my0 - pad and y0 <= my1 + pad and x1 >= mx0 - pad and x0 <= mx1 + pad
        if not near:
            sprite[label == i + 1] = 0
    return sprite


def trim(sprite):
    ys, xs = np.nonzero(sprite[:, :, 3])
    if len(xs) == 0:
        raise ValueError('frame is empty after keying; check its box')
    return sprite[ys.min():ys.max() + 1, xs.min():xs.max() + 1]


def extract_group(image, boxes, name, key=foreground, inset=INSET, pitch_range=(5.3, 6.4), pitch=None, keep_main=False):
    crops = [crop(image, box, key, inset) for box in boxes]
    pitch = pitch or shared_pitch(crops, *pitch_range)
    frames = []
    for rgb, mask in crops:
        sprite = sample(rgb, mask, pitch, getattr(key, 'colours', None))
        if keep_main:
            sprite = isolate(sprite)
        if sprite[:, :, 3].any():
            frames.append(trim(sprite))
    print(f'  {name}: {len(frames)} frames, pitch {pitch:.2f}')
    return frames


def grid_cuts(profile, count, length):
    """Edges of `count` cells along an axis: each inner line snaps to the emptiest
    spot within a third of a cell of where an even grid would put it."""
    span = length / count
    cuts = [0]
    for i in range(1, count):
        lo = int(i * span - span / 3)
        hi = int(i * span + span / 3)
        cuts.append(lo + int(np.argmin(profile[lo:hi])))
    return cuts + [length]


def grid_boxes(image, key, cols, rows, row_bands=None):
    """Frame boxes for art laid out in an even grid on a flat background, row by row.
    `row_bands` ([y0, y1] per row) skips label lines between rows."""
    fg = key(np.asarray(image).astype(int))
    h, w = fg.shape
    if row_bands is None:
        ys = grid_cuts(fg.mean(axis=1), rows, h)
        row_bands = [(ys[r], ys[r + 1]) for r in range(rows)]
    out = []
    for y0, y1 in row_bands:
        xs = grid_cuts(fg[y0:y1].mean(axis=0), cols, w)
        out.append([[xs[c], y0, xs[c + 1], y1] for c in range(cols)])
    return out


# --- packing -----------------------------------------------------------------

def pack_rows(groups):
    """One row per group, equal cells, frames bottom-centred so feet stay put."""
    cell_w = max(f.shape[1] for frames in groups.values() for f in frames)
    cell_h = max(f.shape[0] for frames in groups.values() for f in frames)
    sheet = np.zeros((cell_h * len(groups), cell_w * max(len(f) for f in groups.values()), 4), dtype=np.uint8)
    for r, frames in enumerate(groups.values()):
        for c, f in enumerate(frames):
            fy = r * cell_h + cell_h - f.shape[0]
            fx = c * cell_w + (cell_w - f.shape[1]) // 2
            sheet[fy:fy + f.shape[0], fx:fx + f.shape[1]] = f
    return sheet, {'cell': (cell_w, cell_h), 'rows': [(name, len(f)) for name, f in groups.items()]}


def pack_shelf(groups, width=256):
    """Named sprites (group name + index) shelf-packed with a 1px gap."""
    sprites = {f'{name}{i}': f for name, frames in groups.items() for i, f in enumerate(frames)}
    x = y = shelf = 0
    rects = {}
    for name, f in sprites.items():
        h, w = f.shape[:2]
        if x + w > width:
            x, y, shelf = 0, y + shelf + 1, 0
        rects[name] = (x, y, w, h)
        x += w + 1
        shelf = max(shelf, h)
    atlas = np.zeros((y + shelf, width, 4), dtype=np.uint8)
    for name, (x, y, w, h) in rects.items():
        atlas[y:y + h, x:x + w] = sprites[name]
    return atlas, {'rects': rects}


def layout_ts(export, info):
    if 'cell' in info:
        w, h = info['cell']
        rows = ',\n'.join(f'  {name}: {{ row: {r}, frames: {n} }}' for r, (name, n) in enumerate(info['rows']))
        return f'export const {export}_CELL = {{ w: {w}, h: {h} }}\nexport const {export}_ANIMS = {{\n{rows},\n}} as const\n'
    rects = '\n'.join(f'  {n}: {{ x: {x}, y: {y}, w: {w}, h: {h} }},' for n, (x, y, w, h) in info['rects'].items())
    return f'export const {export} = {{\n{rects}\n}} as const\n'


# --- finding boxes on a new sheet ---------------------------------------------

def runs(line, min_len):
    """(start, end) of each run of True at least min_len long."""
    padded = np.concatenate([[False], line, [False]])
    edges = np.flatnonzero(padded[1:] != padded[:-1])
    return [(s, e) for s, e in zip(edges[::2], edges[1::2]) if e - s >= min_len]


def group_positions(positions, gap=4):
    groups = []
    for p in sorted(positions):
        if groups and p - groups[-1][-1] <= gap:
            groups[-1].append(p)
        else:
            groups.append([p])
    return [(g[0], g[-1]) for g in groups]


def find_boxes(image, min_size):
    """Rectangles framed by dark lines, as rows of [x0, y0, x1, y1] top to bottom.

    A starting point for the manifest: check each box against the sheet, since
    labels and long outlines can still split or merge a row.
    """
    rgb = np.asarray(image).astype(int)
    lum = rgb.mean(axis=2)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    dark = (lum < 90) & (sat < 40)
    fg = foreground(rgb)
    # Frame tops and bottoms run across a whole box; outlines inside a sprite rarely do.
    h_lines = group_positions([y for y in range(dark.shape[0]) if runs(dark[y], min_size * 2)])
    found = []
    for (t0, t1), (b0, b1) in zip(h_lines, h_lines[1:]):
        if b0 - t1 < min_size:
            continue
        band = dark[t1 + 1:b0]
        cols = np.flatnonzero(band.mean(axis=0) > 0.85)
        xs = group_positions(cols.tolist())
        row = []
        for (l0, l1), (r0, r1) in zip(xs, xs[1:]):
            if r1 - l0 < min_size:
                continue
            inside = fg[t1 + INSET:b0 - INSET, l1 + INSET:r0 - INSET]
            # The gap between two neighbouring frames is framed too, but holds no art.
            if inside.size and (inside & ~dark[t1 + INSET:b0 - INSET, l1 + INSET:r0 - INSET]).mean() > 0.02:
                row.append([int(l0), int(t0), int(r1), int(b1)])
        if row:
            found.append(row)
    return found


# --- main --------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--only', help='build just this atlas from the manifest')
    parser.add_argument('--find-boxes', metavar='SHEET', help='print frame boxes found on SHEET and exit')
    parser.add_argument('--min-size', type=int, default=60, help='smallest box side for --find-boxes (image pixels)')
    parser.add_argument('--preview', metavar='DIR', help='write 5x previews of each atlas to DIR')
    args = parser.parse_args()

    if args.find_boxes:
        for row in find_boxes(Image.open(args.find_boxes).convert('RGB'), args.min_size):
            print(json.dumps(row))
        return

    manifest = json.loads(MANIFEST.read_text())
    ASSETS.mkdir(parents=True, exist_ok=True)
    chunks = []
    for name, spec in manifest['atlases'].items():
        if args.only and name != args.only:
            continue
        print(name)
        image = Image.open((MANIFEST.parent / spec['source']).resolve()).convert('RGB')
        pitch_range = tuple(spec.get('pitch', (5.3, 6.4)))
        bg = sheet_background(image)
        for x0, y0, x1, y1 in spec.get('exclude', []):
            # Labels and logos: paint them out with the background before anything else.
            image.paste(tuple(int(v) for v in bg), (x0, y0, x1, y1))
        if 'rows' in spec:
            # Loose art on a flat colour in an even grid: one group per row, empty cells skipped.
            tolerance = spec.get('tolerance', 30)
            cut_key = colour_key([bg], tolerance)
            key = colour_key(spec['bg_colors'], tolerance) if 'bg_colors' in spec else cut_key
            boxes = grid_boxes(image, cut_key, spec['cols'], len(spec['rows']), spec.get('row_bands'))
            # A whole sheet is drawn at one scale; frames from every row pin the pitch down.
            sample_boxes = [row[c] for row in boxes for c in range(1, len(row), 4)]
            pitch = shared_pitch([crop(image, b, key, 0) for b in sample_boxes], *pitch_range)
            keep_main = spec.get('isolate', False)
            groups = {g: extract_group(image, b, g, key, 0, pitch=pitch, keep_main=keep_main) for g, b in zip(spec['rows'], boxes)}
        else:
            groups = {g: extract_group(image, boxes, g, pitch_range=pitch_range) for g, boxes in spec['groups'].items()}
        atlas, info = pack_rows(groups) if spec['pack'] == 'rows' else pack_shelf(groups)
        Image.fromarray(atlas).save(ASSETS / f'{name}.png')
        chunks.append(f'// {name}.png\n' + layout_ts(spec['export'], info))
        if args.preview:
            preview = Image.new('RGBA', (atlas.shape[1], atlas.shape[0]), (40, 48, 64, 255))
            preview.alpha_composite(Image.fromarray(atlas))
            Path(args.preview).mkdir(parents=True, exist_ok=True)
            preview.resize((atlas.shape[1] * 5, atlas.shape[0] * 5), Image.NEAREST).save(Path(args.preview) / f'{name}.png')

    if args.only:
        print('layout file not rewritten with --only; run without it to regenerate artLayout.ts')
        return
    LAYOUT_TS.write_text(
        '// Generated by tools/extract_art.py from tools/art-manifest.json. Do not edit;\n'
        '// change the manifest and re-run the tool instead.\n\n' + '\n'.join(chunks)
    )
    print(f'wrote {len(chunks)} atlases to {ASSETS} and {LAYOUT_TS}')


if __name__ == '__main__':
    main()
