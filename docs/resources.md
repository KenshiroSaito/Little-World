# Resources and assets

[Documentation home](../README.md) · [Features](features.md) · [Code map](code-map.md)

## Runtime art

| Resource | Location | Use |
| --- | --- | --- |
| Tree atlas | [`tree-kit.png`](../src/world/assets/tree-kit.png) | Wood, roots, leaves and tree details; extracted through `treeKit.ts` using generated atlas rectangles. |
| Spirit atlas | [`spirit-sheet.png`](../src/world/assets/spirit-sheet.png) | Spirit/player animation frames, selected by `world/spirit.ts`. |
| Villager atlases | [`src/world/assets/`](../src/world/assets) | `knight.png`, `wizard.png`, `blacksmith.png`, `librarian.png`; loaded for house residents. |
| Tree decorations | [`trinkets/`](../src/world/assets/trinkets) | Individual transparent PNGs offered by the shop and drawn on branches. |
| Wearable accessories | [`accessories/`](../src/world/assets/accessories) | Front and alternate views for shop products worn by the spirit. |
| Generated atlas layout | [`artLayout.ts`](../src/world/artLayout.ts) | Animation cells/rows and tree-kit rectangles used to sample atlas images. |
| Procedural pixel sprites | [`sprites.ts`](../src/world/sprites.ts) | Small sprite definitions, outlines and halos; additional world objects are drawn directly in terrain, houses and overlay code. |
| Public icons | [`public/`](../public) | `favicon.svg` and `icons.svg`. |
| Additional bundled artwork | [`src/assets/`](../src/assets) | `hero.png`, `react.svg` and `vite.svg` are present; this directory is separate from the world/shop art catalogs. |

### Trinket categories

The shop reads `src/world/assets/trinkets/*/*.png`. Current directories are `baubles`, `candy`, `lights`, `figurines`, `nature`, `ribbons`, and `misc`. The filename becomes a readable item name and, with its directory, a stable catalog ID such as `misc/terrarium`.

### Accessory categories and views

The shop reads `src/world/assets/accessories/*/*.png`. Current directories are `hats`, `eyewear`, `neckwear`, `backs`, `wings`, `jewelry`, and `jewels`. Each unsuffixed name is one product. Numbered names such as `crown-2.png` are alternate views of that product, not separate purchases. The catalog selects the `-2` view when present; `outfit.ts` decides how views are fitted for front/side poses.

Assets retain the source sheets' resolution and are scaled with smoothing disabled for display. Trinket images are cached when used; accessory rendering also composes pieces around the spirit's animation frame.

## Art source sheets and extraction

Source sheets live in [`tools/sheets/`](../tools/sheets):

| Sheet | Purpose |
| --- | --- |
| `maincharacter.jpeg` | Spirit animation source. |
| `worldtreeprocedural.jpeg` | Tree construction art source. |
| `trinkets.png` | Decorations split into individual trinket PNGs. |
| `accessories.png` | Wearable pieces and alternate views split into category folders. |

[`art-manifest.json`](../tools/art-manifest.json) describes atlas source boxes and packing. [`extract_art.py`](../tools/extract_art.py) creates atlases and layout metadata. [`split_sheets.py`](../tools/split_sheets.py) extracts individual trinkets/accessories. Their Python dependencies are Pillow and NumPy in [`requirements.txt`](../tools/requirements.txt).

For commands, sheet formats, background removal and preview generation, use the existing [art extraction guide](../tools/README.md). Python tooling is needed only when regenerating art, not for normal npm development/builds. Rebuilding can replace generated PNGs and layout metadata, so inspect the resulting diff and previews.

## Browser storage

| Resource | Identifier | Contents/lifecycle |
| --- | --- | --- |
| localStorage | `littleworld:save` | JSON version-2 game facts: activity logs, paint, settings, spirit dismissal, demo offset, optional purchases and image ID references. Loaded/validated on provider initialization; saved after state changes. |
| IndexedDB database | `littleworld:images`, version 1 | Reflection photo blobs in the `images` object store, keyed by generated IDs. |
| Temporary object URLs | Created through `URL.createObjectURL` | Draft/stored photo display; revoked by component cleanup. |
| Session memory | React and renderer state | Open panels, paint undo history, placement mode, camera, animation clocks, player position and growth-button press count. |

Photos are resized to at most 1024 pixels on the longest side, encoded as JPEG at quality 0.85, and given a page-colour background for transparency. Removing a saved photo removes its ID from the reflection and requests deletion of its blob. Starting/resetting a game with no logs triggers photo-store clearing.

There is no backend or cross-device synchronization in this implementation. Keeping only the localStorage JSON would not preserve the separate photo blobs. Storage failures are handled through warnings or photo-specific UI errors; a blocked or full store can prevent persistence even while the current session continues.

## Dependencies and configuration

Exact installed versions are recorded in [`package-lock.json`](../package-lock.json); declared ranges and scripts are in [`package.json`](../package.json).

| Resource | Purpose |
| --- | --- |
| React and React DOM | UI components, state/context, lifecycle and browser mounting. |
| Three.js | World render stage, textures, shaders, sprites and effects. |
| TypeScript and type packages | Shared contracts and type-checking. |
| Vite and its React plugin | Development server, asset imports/globs, bundling and production output. |
| Vitest | Game, world and shop tests. |
| ESLint, TypeScript ESLint, React Hooks/Refresh plugins | Static checks for source and React patterns. |
| [`tsconfig.json`](../tsconfig.json), [`tsconfig.app.json`](../tsconfig.app.json), [`tsconfig.node.json`](../tsconfig.node.json) | TypeScript project references and browser/tool configuration. |
| [`eslint.config.js`](../eslint.config.js) | Lint rules and file scope. |
| [`index.html`](../index.html) | Browser HTML entry and metadata. |

For browser support, the code uses canvas, ResizeObserver, Pointer Events, animation frames, localStorage, IndexedDB, `createImageBitmap`, and `crypto.randomUUID`. The preferred graphics path uses WebGL through Three.js, with a Canvas 2D fallback attempt when the stage cannot initialize.

## Build and deployment

[`vite.config.ts`](../vite.config.ts) enables React and uses `base: './'` so generated asset paths are relative, including when served from a repository subpath. `npm run build` runs TypeScript project builds followed by Vite and writes `dist/`. `npm run preview` serves that output locally.

[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) runs on pushes to `main` and manual dispatch. It checks out the repository, sets up Node.js 22, runs `npm ci` and `npm run build`, then uses the workflow's GitHub token to publish `dist/` to the `gh-pages` branch. The workflow has write access to repository contents and serializes deployments through its `pages` concurrency group. Hosting still depends on the repository's GitHub Pages settings.

## Resource maintenance

Keep catalog IDs and atlas metadata consistent with their images. Do not delete alternate accessory views as apparent duplicate products: they are rendering resources. Update this guide and the feature guide when adding a section, storage mechanism, source sheet or runtime dependency.
