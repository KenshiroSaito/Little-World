"""Cut the trinket and accessory sheets into one transparent PNG per sprite.

    python3 tools/split_sheets.py                  # write every sprite into src/world/assets/
    python3 tools/split_sheets.py --preview DIR    # also a labelled contact sheet per sheet

Unlike extract_art.py's sheets these are painted at no steady pixel scale, so
sprites are cut at the sheet's own resolution: background removed, edges hard.
The trinkets sit loose on one flat colour. The accessory sheet carries a soft
alpha matte whose solid core is the art (its glows and cell shading are faint),
grown a pixel or two to take back each sprite's dark outline; every accessory
comes as several views, written as <name>.png (the first, top view) and
<name>-2.png, <name>-3.png, ... in reading order. Needs Pillow and numpy.
"""

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
ASSETS = HERE.parent / 'src/world/assets'

# Specks smaller than this (image pixels) are noise, not part of a sprite.
SPECK = 6
# Enclosed gaps this small inside a sprite are keying misses (dark outline pixels), not holes.
SMALL_HOLE = 12

TRINKETS = {
    'source': 'sheets/trinkets.png',
    'out': 'trinkets',
    'background': (17, 24, 34),
    'tolerance': 14,
    # The title line and the seven row labels, painted out before cutting.
    'exclude': [[0, 0, 1536, 50], [15, 72, 300, 97], [15, 272, 300, 297], [15, 407, 300, 432],
                [15, 539, 300, 564], [15, 683, 300, 707], [15, 796, 180, 817], [15, 913, 300, 938]],
    # One entry per row of items, top to bottom: (folder, names left to right).
    'rows': [
        ('baubles', [f'bauble-{i:02d}' for i in range(1, 22)]),
        ('baubles', [f'bauble-{i:02d}' for i in range(22, 43)]),
        ('figurines', ['star', 'snowflake', 'christmas-tree', 'snowman', 'gingerbread-man', 'reindeer', 'penguin',
                       'santa', 'stocking', 'candy-cane', 'heart', 'bell', 'rocking-horse', 'cottage', 'gift',
                       'gingerbread-house', 'crescent-moon', 'robin']),
        ('nature', ['pinecone', 'acorn', 'holly', 'mistletoe', 'poinsettia', 'wreath', 'snowflake', 'north-star',
                    'moon-and-star', 'sun', 'ice-star', 'autumn-leaf', 'maple-leaf', 'four-leaf-clover', 'pumpkin',
                    'blue-flower', 'butterfly']),
        ('lights', [f'light-{i:02d}' for i in range(1, 25)]),
        ('ribbons', ['bow-red', 'bow-green', 'bow-gold', 'bow-blue', 'bow-purple', 'bow-white', 'ribbon-red',
                     'ribbon-green', 'ribbon-gold', 'ribbon-blue', 'streamer-purple', 'streamer-silver',
                     'streamer-red', 'streamer-green', 'streamer-gold', 'streamer-blue', 'streamer-sky',
                     'streamer-violet']),
        ('misc', ['planet', 'orb', 'snow-globe', 'paper-crane', 'potion', 'terrarium', 'crystal', 'spool', 'sparkle',
                  'wind-chime', 'dreamcatcher', 'pocket-watch', 'key', 'music-note', 'snowman-head', 'green-top-hat',
                  'mushroom']),
        ('candy', ['candy-cane', 'lollipop', 'wrapped-candy-red', 'wrapped-candy-blue', 'donut', 'cookie', 'pretzel',
                   'star-cookie', 'cupcake', 'popsicle', 'macaron', 'peppermint', 'wrapped-candy-green', 'chocolate',
                   'gumdrop', 'orange-slice', 'wrapped-candy-purple']),
    ],
}

ACCESSORIES = {
    'source': 'sheets/accessories.png',
    'out': 'accessories',
    # Alpha at or above `core` is art; the outline around it is grown back where alpha is at least `edge`.
    # Around dark accessories the matte keeps some background at 200 to 225, so the core starts above that.
    'core': 225,
    'edge': 120,
    'grow': 3,
    # Ten columns between these x positions.
    'span': [1, 1313],
    # Each category's band of rows (below its label), and its ten accessories left to right.
    'categories': [
        ('hats', [92, 252], ['red-cap', 'blue-cap', 'straw-hat', 'witch-hat', 'viking-helmet', 'top-hat',
                             'white-fedora', 'green-hood', 'crown', 'santa-hat']),
        ('eyewear', [296, 432], ['sunglasses', 'round-glasses', '3d-glasses', 'goggles', 'shutter-shades',
                                 'heart-glasses', 'monocle', 'green-glasses', 'dark-sunglasses', 'ski-goggles']),
        ('neckwear', [486, 630], ['red-scarf', 'blue-scarf', 'green-scarf', 'purple-scarf', 'striped-scarf',
                                  'black-scarf', 'white-scarf', 'pink-scarf', 'teal-scarf', 'tan-scarf']),
        ('backs', [674, 832], ['brown-backpack', 'green-backpack', 'blue-backpack', 'red-backpack', 'tan-backpack',
                               'black-backpack', 'red-cape', 'blue-cape', 'green-cape', 'skull-cape']),
        ('jewelry', [874, 996], ['gold-earrings', 'heart-necklace', 'gem-necklace', 'earmuffs', 'gold-ring',
                                 'spiked-collar', 'headphones', 'daisy', 'red-bow', 'mini-wings']),
        ('jewels', [1022, 1086], ['gold-studs', 'sapphire-earrings', 'ruby-earrings', 'emerald-earrings',
                                  'gold-hairclip', 'chain-bracelet', 'bead-bracelet', 'small-daisy', 'small-red-bow',
                                  'wing-clips']),
        ('wings', [1110, 1192], ['angel-wings', 'bat-wings', 'dragon-wings', 'crystal-wings', 'golden-wings',
                                 'orbs', 'cat-ears', 'halo', 'pouch', 'lantern']),
    ],
    # Pieces of one view this close (image pixels) are joined: the bridge of a pair of glasses.
    'join': 3,
}


# --- masks ---------------------------------------------------------------------

def components(mask):
    """Connected areas of True (8-neighbour), each as (ys, xs) index arrays."""
    h, w = mask.shape
    seen = np.zeros((h, w), dtype=bool)
    out = []
    for y0, x0 in zip(*np.nonzero(mask)):
        if seen[y0, x0]:
            continue
        seen[y0, x0] = True
        stack = [(y0, x0)]
        ys, xs = [], []
        while stack:
            y, x = stack.pop()
            ys.append(y)
            xs.append(x)
            for ny in (y - 1, y, y + 1):
                for nx in (x - 1, x, x + 1):
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
        out.append((np.array(ys), np.array(xs)))
    return out


def grow(mask, n):
    out = mask.copy()
    for _ in range(n):
        m = out.copy()
        m[1:] |= out[:-1]
        m[:-1] |= out[1:]
        m[:, 1:] |= out[:, :-1]
        m[:, :-1] |= out[:, 1:]
        out = m
    return out


def clean(mask):
    """Drop specks and fill small enclosed gaps; big holes (a wreath's middle) stay clear."""
    out = np.zeros_like(mask)
    for ys, xs in components(mask):
        if len(ys) >= SPECK:
            out[ys, xs] = True
    h, w = out.shape
    for ys, xs in components(~out):
        inside = ys.min() > 0 and xs.min() > 0 and ys.max() < h - 1 and xs.max() < w - 1
        if inside and len(ys) <= SMALL_HOLE:
            out[ys, xs] = True
    return out


def runs(line, gap):
    """(start, end) of each stretch of True, bridging gaps shorter than `gap`."""
    idx = np.flatnonzero(line)
    if len(idx) == 0:
        return []
    out = [[idx[0], idx[0] + 1]]
    for i in idx[1:]:
        if i - out[-1][1] < gap:
            out[-1][1] = i + 1
        else:
            out.append([i, i + 1])
    return [tuple(r) for r in out]


def cutout(rgb, mask):
    """RGBA of the masked pixels, trimmed to them."""
    ys, xs = np.nonzero(mask)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    out = np.zeros((y1 - y0, x1 - x0, 4), dtype=np.uint8)
    out[:, :, :3] = rgb[y0:y1, x0:x1]
    out[:, :, 3] = np.where(mask[y0:y1, x0:x1], 255, 0)
    return out


# --- the two sheets ------------------------------------------------------------

def split_trinkets(spec):
    image = Image.open(HERE / spec['source']).convert('RGB')
    bg = np.array(spec['background'])
    for box in spec['exclude']:
        image.paste(tuple(int(v) for v in bg), tuple(box))
    rgb = np.asarray(image).astype(int)
    fg = np.abs(rgb - bg).max(axis=2) > spec['tolerance']
    bands = [b for b in runs(fg.mean(axis=1) > 0.002, 4) if b[1] - b[0] >= 30]
    if len(bands) != len(spec['rows']):
        raise SystemExit(f'trinkets: found {len(bands)} rows of items, expected {len(spec["rows"])}')
    sprites = []
    for (y0, y1), (folder, names) in zip(bands, spec['rows']):
        items = runs(fg[y0:y1].any(axis=0), 6)
        if len(items) != len(names):
            raise SystemExit(f'trinkets: {folder} row at y {y0} has {len(items)} items, expected {len(names)}')
        for (x0, x1), name in zip(items, names):
            mask = clean(fg[y0:y1, x0:x1])
            sprites.append((f'{folder}/{name}', cutout(rgb[y0:y1, x0:x1], mask)))
    return sprites


def views(mask, join):
    """The separate pictures in one cell: pieces joined when nearly touching, in reading order."""
    boxes = [[ys.min(), xs.min(), ys.max() + 1, xs.max() + 1] for ys, xs in components(mask) if len(ys) >= SPECK * 4]
    merged = True
    while merged:
        merged = False
        for i in range(len(boxes)):
            for j in range(i + 1, len(boxes)):
                a, b = boxes[i], boxes[j]
                if a[0] - join < b[2] and b[0] - join < a[2] and a[1] - join < b[3] and b[1] - join < a[3]:
                    boxes[i] = [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]
                    del boxes[j]
                    merged = True
                    break
            if merged:
                break
    # Rows: a box starts a new row once its middle is below the previous row's boxes.
    boxes.sort(key=lambda b: (b[0] + b[2]) / 2)
    rows = []
    for b in boxes:
        if rows and (b[0] + b[2]) / 2 < max(r[2] for r in rows[-1]):
            rows[-1].append(b)
        else:
            rows.append([b])
    return [b for row in rows for b in sorted(row, key=lambda b: b[1])]


def split_accessories(spec):
    rgba = np.asarray(Image.open(HERE / spec['source']).convert('RGBA')).astype(int)
    rgb, alpha = rgba[:, :, :3], rgba[:, :, 3]
    x_lo, x_hi = spec['span']
    edges = np.linspace(x_lo, x_hi, 11).round().astype(int)
    sprites = []
    for folder, (y0, y1), names in spec['categories']:
        for c, name in enumerate(names):
            x0, x1 = edges[c], edges[c + 1]
            a = alpha[y0:y1, x0:x1]
            core = clean(a >= spec['core'])
            mask = clean(grow(core, spec['grow']) & (a >= spec['edge']))
            found = views(mask, spec['join'])
            if not found:
                raise SystemExit(f'accessories: nothing found for {folder}/{name}')
            for i, (vy0, vx0, vy1, vx1) in enumerate(found):
                piece = np.zeros_like(mask)
                piece[vy0:vy1, vx0:vx1] = mask[vy0:vy1, vx0:vx1]
                suffix = '' if i == 0 else f'-{i + 1}'
                sprites.append((f'{folder}/{name}{suffix}', cutout(rgb[y0:y1, x0:x1], piece)))
    return sprites


# --- output --------------------------------------------------------------------

def contact_sheet(sprites, path, cell=96, cols=12):
    """Every sprite on a dark tile with its name, to check the cut by eye."""
    rows = -(-len(sprites) // cols)
    sheet = Image.new('RGBA', (cols * cell, rows * (cell + 14)), (40, 48, 64, 255))
    draw = ImageDraw.Draw(sheet)
    for i, (name, px) in enumerate(sprites):
        x, y = (i % cols) * cell, (i // cols) * (cell + 14)
        img = Image.fromarray(px)
        scale = min(1.0, (cell - 8) / max(img.size))
        if scale < 1:
            img = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))), Image.NEAREST)
        sheet.alpha_composite(img, (x + (cell - img.width) // 2, y + (cell - img.height) // 2))
        draw.text((x + 3, y + cell), name.split('/')[-1][:16], fill=(220, 220, 220, 255))
    sheet.save(path)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--preview', metavar='DIR', help='write a labelled contact sheet per sheet to DIR')
    args = parser.parse_args()
    for spec, split in ((TRINKETS, split_trinkets), (ACCESSORIES, split_accessories)):
        sprites = split(spec)
        root = ASSETS / spec['out']
        for name, px in sprites:
            path = root / f'{name}.png'
            path.parent.mkdir(parents=True, exist_ok=True)
            Image.fromarray(px).save(path)
        print(f'{spec["out"]}: {len(sprites)} sprites in {root}')
        if args.preview:
            Path(args.preview).mkdir(parents=True, exist_ok=True)
            contact_sheet(sprites, Path(args.preview) / f'{spec["out"]}.png')


if __name__ == '__main__':
    main()
