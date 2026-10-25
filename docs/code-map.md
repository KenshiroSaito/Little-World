# Code map

[Documentation home](../README.md) · [Features](features.md) · [Resources](resources.md)

## Data flow

`main.tsx` mounts React StrictMode, `GameProvider`, and `App`. UI events dispatch typed actions to `gameReducer`. The provider derives geometry, LP, history, colours, relics, and spirit messages from the resulting state, then saves game facts. `App` passes the derived scene to `TreeCanvas`, which updates `WorldRenderer`.

The renderer owns its camera, animation timing, pointer input, and player simulation. These session details are separate from the saved activity records. Canvas selections flow back through `App` to painting, placement, Journal, or Relics. Photos are stored asynchronously before their IDs are attached to a reflection.

## Application and components

All component paths below are relative to [`src/components/`](../src/components).

| File | Responsibility |
| --- | --- |
| [`main.tsx`](../src/main.tsx) | Application entry point and provider mounting. |
| [`App.tsx`](../src/App.tsx) | Title/tree screen, panel routing, paint history, placement mode, outfit and keepsake scene data, journal/tree navigation. |
| [`types.ts`](../src/types.ts) | Shared activity, mood, colour, log, state, reducer-action, segment, relic, and canvas-selection contracts. |
| `TitleScreen.tsx` | Start/Continue screen. |
| `Hud.tsx` | Available LP, panel buttons, paint toggle, zoom and fit actions. |
| `SelfCarePanel.tsx` | Activity recording and reflection form, including photo preparation. |
| `PaintPalette.tsx` | Preset swatches, RGB mixer, Undo and Done controls. |
| `JournalBook.tsx` | Paginated activity history and links to leaves. |
| `RelicsPanel.tsx` | Reflection keepsakes, photo editing, root navigation, and milestone lore. |
| `ReflectionImages.tsx` | Stored-photo loading, thumbnails, missing-photo fallback, draft previews, and object-URL cleanup. |
| `SpiritBubble.tsx` | Display and dismissal of the current spirit message. |
| `SettingsPanel.tsx` | Spirit/reduced-motion settings, confirmed reset, and About text. |
| `GrowBoost.tsx`, `GrowBoost.css` | Ten-record growth shortcut and its styling. |
| `DemoControls.tsx` | URL-gated day advance and immediate reset. |
| [`App.css`](../src/App.css), [`index.css`](../src/index.css) | Application layouts, panels, journal, global typography and controls. |

## State and persistence

| File | Responsibility |
| --- | --- |
| [`GameProvider.tsx`](../src/state/GameProvider.tsx) | Context access through `useGame`, reducer lifecycle, derived values, timestamped helpers, automatic saving and empty-game photo cleanup. |
| [`gameReducer.ts`](../src/state/gameReducer.ts) | Pure action handling and validation; buying, placing, wearing, photo IDs, recording, painting, spirit dismissal, settings, demo dates, reset. |
| [`persistence.ts`](../src/state/persistence.ts) | Version-2 save validation, localStorage reading/writing, and failure handling. |
| [`images.ts`](../src/state/images.ts) | IndexedDB photo storage, resizing/encoding, lookup, deletion and clearing. |

`GameState` stores records, per-segment paint, spirit/settings facts, demo day offset, and optional purchases. A reflection can carry optional image IDs. LP, tree segments, milestones, and journal pages are computed rather than stored.

Reducer actions use explicit timestamps and purchase IDs supplied by callers. Keep browser side effects such as file storage outside the reducer. A photo-only edit does not create another reward or record.

## Game rules

Files are in [`src/game/`](../src/game).

| File | Responsibility |
| --- | --- |
| `activities.ts` | Four activity labels, preset colour names, and the 5-LP reward constant. |
| `moods.ts` | Mood labels/options. |
| `rules.ts` | Local dates, today's counts, unique record IDs, reflection limits, activity recording. |
| `buildTree.ts` | Seeded branch/root geometry, painted leaf assignments, root depth and world limits. |
| `progression.ts` | Lifetime LP, unlocked colours, relic thresholds/discovery times, ruin status and inscription records. |
| `relics.ts` | Milestone names and lore. |
| `history.ts` | Experience-history ordering. |
| `journal.ts` | Date grouping and page capacity, accounting for text, mood and photos. |
| `spirit.ts` | Message eligibility, recent-activity/mood summaries and supportive templates. |
| `game.test.ts` | Rules, progression, persistence, history, reflection and other game-logic checks. |

## Shop

Files are in [`src/shop/`](../src/shop).

| File | Responsibility |
| --- | --- |
| `catalog.ts` | Discovers bundled trinket/accessory PNGs with Vite globs; defines sections, labels, kinds, prices, premium matches and alternate accessory views. |
| `inventory.ts` | Purchase records, available balance, affordability, duplicate transaction protection, outfit selection and saved-inventory validation. |
| `ShopPanel.tsx` | Browsing, prices/shortfalls, ownership counts, My items, placement/storage and wardrobe controls. |
| `decorations.ts` | Cached decoration images drawn into the tree layer at assigned branches. |
| `outfit.ts` | Accessory fitting, pose-specific placements, front/side views, mirrored pairs and draw order around the spirit. |
| `shop.css` | Shop cards, grouped navigation, equipped states, placement prompt and responsive rules. |
| `shop.test.ts` | Catalog, purchasing, balances, saved inventory, placement, wardrobe and rendering-related checks. |

Purchases subtract from available LP only. The reducer still computes lifetime LP from unchanged activity records for growth and milestones. A trinket uses `segmentId`; a worn accessory uses `worn`, with at most one equipped item per section.

## World and rendering

Files are in [`src/world/`](../src/world).

| File | Responsibility |
| --- | --- |
| `index.ts` | Public exports for the React tree canvas and leaf palette. |
| `TreeCanvas.tsx` | React canvas lifecycle, scene updates, selection callback, imperative zoom/fit/branch/keepsake focus methods. |
| `renderer.ts` | Coordinates scene changes, image loading, layers, growth, camera, input, player, houses, highlights, keepsakes, outfit, frame loop and cleanup. |
| `stage.ts` | Three.js render stage, layer textures, compositing and sprite/effect passes. |
| `shaders.ts` | GLSL used by the rendering effects. |
| `camera.ts` | Pixel-aligned scale, world/screen conversion, clamping, pan, zoom, fit and interpolation. |
| `layout.ts` | 16-pixel tiles, world bounds, surface/ruin/relic positions and coordinate conversion. |
| `player.ts` | Pure player physics: collision world, ground/air/climb modes, platforms, jumping and nearby-branch selection. |
| `treeShape.ts` | Tree dimensions, leaf sizes/variants, growth interpolation, bounds and spirit-perch geometry. |
| `tree.ts` | Tree pixels, wood, leaves, roots, sprigs, houses and growth/glow sources. |
| `treeKit.ts` | Tree-atlas loading, image helpers, sprite extraction, wood textures and recolouring. |
| `artLayout.ts` | Generated atlas frame dimensions, animation rows and sprite rectangles. |
| `terrain.ts` | Ground, underground strata and environment drawing. |
| `houses.ts` | House eligibility, stable placement, deck/porch bounds, procedural house drawing. |
| `npcs.ts` | Villager sheets, order and animation frame selection. |
| `spirit.ts` | Spirit/player animation selection and frame-position adjustments. |
| `overlay.ts` | Milestone relics, ruin/tablet details, keepsakes and selection overlays. |
| `hitTest.ts` | World-click selection using relic, keepsake, tablet and branch geometry. |
| `lighting.ts` | Light-map construction and painting. |
| `particles.ts` | Ambient and burst effects. |
| `palette.ts` | Bark, terrain, leaf and effect colours; custom-colour shade derivation. |
| `sprites.ts` | Small code-defined pixel sprites, canvas creation, outlines and halos. |
| `rng.ts` | Seeded random/hash helpers for stable visual variation. |
| `fixtures.ts` | Scene fixtures used during development/testing. |
| `world.test.ts` | Geometry, camera, world layout, hit testing, player and rendering-logic checks. |

The renderer draws terrain/tree/overlay/light/glow layers. Decorations are stamped onto the tree layer so they share camera transforms and world effects. The spirit and villagers have sprite passes. If Three.js stage construction fails, the renderer attempts its plain Canvas 2D path. The frame loop and event listeners are disposed when the canvas unmounts.

## Extending the code

### Add an activity

Update activity IDs/types, labels/colours, palette values, spirit summaries and any assumptions that cycle over the activity set. Check record validation and existing saves. Use `recordActivity` for reward and ID rules, and verify `game.test.ts`.

### Add a shop item

Place a transparent PNG under an existing trinket or accessory category in `src/world/assets/`. The build-time glob discovers it automatically. Use a stable filename: the catalog derives item IDs from section/filename, and saves reference those IDs. For accessories, the unsuffixed file is the product; `-2.png` is an optional side view and further numbered files remain view resources. Check front/side fitting in `outfit.ts`.

New sections also need catalog section lists, labels and prices. Prices are part of save validation: renaming/removing products or changing prices can invalidate existing inventory and requires a migration strategy if retaining those saves matters.

### Add a saved feature

Extend `GameState` and `GameAction`, handle the action in the reducer, and update save validation. Prefer optional fields/defaults when preserving existing version-2 saves. Derive values from stored facts when possible; do not persist camera/frame state just to share it with the UI.

### Verify changes

Run `npm run build`, `npm run lint`, and `npm test -- --run`. For visual/input changes, also run the app and exercise the relevant controls, zoom levels, reset flow and a reload. Unit tests cover logic but do not establish browser visual correctness.
