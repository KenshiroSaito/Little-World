# Art extraction

`extract_art.py` turns painted reference sheets (JPEGs of pixel art) into clean,
transparent atlases in `src/world/assets/` and writes their layout to
`src/world/artLayout.ts`. Every sheet is listed in `art-manifest.json`; the
sheets themselves are in `sheets/`.

Two kinds of sheet work:

- **Framed** (a grey grid with dark frame boxes, like `maincharacter.jpeg`):
  list each frame box under `groups`.
- **Loose grid** (frames in rows on one flat colour, like the character sheets
  this branch used to carry): give `cols` and one name per row in `rows`; frame
  boxes are found from the art, one group per row, empty cells skipped.

```sh
python3 -m venv .venv && .venv/bin/pip install -r tools/requirements.txt
.venv/bin/python tools/extract_art.py                    # rebuild every atlas
.venv/bin/python tools/extract_art.py --preview /tmp/art # plus 5x previews to check by eye
```

## Adding a sheet

1. Put the sheet in `tools/sheets/` and find its frame boxes:

   ```sh
   .venv/bin/python tools/extract_art.py --find-boxes tools/sheets/newsheet.jpeg
   ```

   Each printed line is one row of `[x0, y0, x1, y1]` boxes in image pixels,
   measured on the dark frame lines. It is a starting point: faint lines and
   labels can merge two frames or split one, so check the boxes against the
   sheet. Loose art without frames (like the leaf clusters) needs boxes by hand;
   any box around the art with a little grey margin works.

2. Add an atlas to `art-manifest.json`:

   - `source`: path to the sheet, relative to this folder.
   - `pack`: `"rows"` for animations (one row per group, equal cells, frames
     bottom-centred) or `"shelf"` for a kit of separate sprites.
   - `export`: the TypeScript name. Rows give `<EXPORT>_CELL` and
     `<EXPORT>_ANIMS`; shelf gives `<EXPORT>` with a rect per sprite, named
     group + index (`leaf0`, `leaf1`, ...).
   - `groups`: group name -> list of boxes. Frames in one group should be drawn
     at the same scale; the tool finds one pixel pitch per group.

   Loose-grid options:

   - `cols`, `rows`: column count and a name per row.
   - `row_bands`: `[y0, y1]` per row, when labels sit between rows.
   - `exclude`: `[x0, y0, x1, y1]` rectangles painted out first (labels, logos).
   - `bg_colors`: background colours when there is more than one (a page and
     lighter cells); otherwise the sheet's border colour is used.
   - `tolerance`: how far from the background a pixel must be to count as art.
     Keep it low (6 to 13) for dark clothing near the background colour; the
     background noise on these sheets is about 1.5.
   - `isolate`: keep only the main figure and bits near it (drops label and
     neighbour fragments).
   - `pitch`: `[min, max]` image pixels per art pixel to search (default 5.3 to 6.4).

   Pockets inside a figure that the key mistook for background (robes, armour)
   are filled back in automatically, as are cracks up to two pixels wide,
   one-pixel dents in the outline (framed sheets too), and any enclosed pocket
   of 16 pixels or fewer whatever its colour, patched from its neighbours where
   the sheet shows only background there. Bigger pockets are the space between
   a figure and its staff, banner or tools, and stay clear. Each frame is also
   judged against its own background, which drifts a few levels across a sheet.

   On framed grey sheets the grey key leaves warm greys (olive bark) and near
   whites (teeth, sparkles) as art; the background and grid lines are cool,
   mid-bright greys.

3. Run the tool without `--only` so `artLayout.ts` is regenerated, then import
   the PNG and its layout in `src/world`. Check the result with `--preview`.

Status frames that would make the spirit look worse (the sheet's Sad/Wilt) are
left out on purpose: the spirit never reacts badly to a hard day.
