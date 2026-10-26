# Feature guide

[Documentation home](../README.md) · [Code map](code-map.md) · [Resources](resources.md)

## Start and continue

The title screen offers **Start** for a game with no recorded activities and **Continue** when records exist. Both open the saved tree; choosing Start does not reset a save. State loads when the game provider mounts.

Code: [`TitleScreen.tsx`](../src/components/TitleScreen.tsx), [`App.tsx`](../src/App.tsx), [`GameProvider.tsx`](../src/state/GameProvider.tsx).

## Self-care and LP

Open **Self-Care** and record an activity. Every record earns 5 LP, including repeated activities on the same day. The panel shows today's completion count. Dates use the browser's local calendar, with an extra day offset in demo mode.

| Activity | Unlocked leaf colour |
| --- | --- |
| Walk | Spring green |
| Connect | Sunset orange |
| Take a Break | Teal |
| Reflect | Lavender |

Lifetime LP is the sum of all activity rewards. It drives tree growth, houses, and milestone relics. Available LP, shown in the toolbar and shop, subtracts purchase costs. Shopping does not undo growth. Resting or missing days does not remove records or rewards.

Code: [`SelfCarePanel.tsx`](../src/components/SelfCarePanel.tsx), [`activities.ts`](../src/game/activities.ts), [`rules.ts`](../src/game/rules.ts), [`progression.ts`](../src/game/progression.ts), [`inventory.ts`](../src/shop/inventory.ts).

## Reflections and photos

Choose **Reflect**, optionally write up to 10,000 characters, select a mood, and attach up to three images. Saving records the activity after the selected images have been stored. A photo storage error leaves the form open for retrying or saving without photos.

Photos are resized to a longest side of at most 1024 pixels and encoded as JPEG. The journal and Relics panel display thumbnails; selecting one opens the stored image in a new tab. Relics also lets you add or remove photos later, within the same three-image limit. Missing image data displays “Photo not on this device.”

Code: [`SelfCarePanel.tsx`](../src/components/SelfCarePanel.tsx), [`ReflectionImages.tsx`](../src/components/ReflectionImages.tsx), [`RelicsPanel.tsx`](../src/components/RelicsPanel.tsx), [`images.ts`](../src/state/images.ts).

## Tree growth, houses, and villagers

Every activity creates one branch and one root segment. The same record IDs generate the same geometry. Leaves use the activity's colour unless painted. Roots extend below ground; the main root deepens four tiles every second record, up to the depth limit of 36 tiles.

At 40 lifetime LP, the tree becomes eligible for its first house, with another house allowance every 5 LP. Houses need a suitable branch and enough space, so placement can wait for later growth. Once placed, houses stay in place as the tree grows. Their porches have animated villagers, cycling through wizard, librarian, knight, and blacksmith characters.

Code: [`buildTree.ts`](../src/game/buildTree.ts), [`treeShape.ts`](../src/world/treeShape.ts), [`tree.ts`](../src/world/tree.ts), [`houses.ts`](../src/world/houses.ts), [`npcs.ts`](../src/world/npcs.ts), [`renderer.ts`](../src/world/renderer.ts).

## Explore and control the spirit

The spirit walks, jumps, lands on leaves and house decks, and climbs the trunk, branches, and roots. The camera follows after movement starts; dragging the view or focusing another location interrupts following. Movement is session state and is not stored in the saved game.

| Input | Action |
| --- | --- |
| Left/right arrows or A/D | Walk; move sideways while climbing. |
| Up arrow or W | Catch a nearby limb and climb upward. |
| Down arrow or S | Climb down; enter nearby roots from ground level; drop through an elevated platform. |
| Space | Jump; releasing early reduces jump height. A focused button still uses Space for activation. |
| E | Select the nearby branch, normally opening its journal entry; active paint or placement mode handles the selection instead. |
| Pointer drag | Pan the world. |
| Wheel or pinch | Zoom. |
| Toolbar + / − | Zoom in/out. |
| + / = or − / _ with canvas focus | Zoom in/out. |
| F or 0 with canvas focus, or Fit tree button | Frame the tree. |
| Arrow keys with the spirit disabled and canvas focused | Pan the camera. |

Movement handlers ignore typing fields and modifier shortcuts. Click leaves to select their record, or click a keepsake/relic to open Relics.

Code: [`player.ts`](../src/world/player.ts), [`renderer.ts`](../src/world/renderer.ts), [`camera.ts`](../src/world/camera.ts), [`hitTest.ts`](../src/world/hitTest.ts).

## Paint

Open **Paint**, choose an unlocked preset or **Mix**, then select a branch. Mix exposes red, green, and blue sliders and a hex preview. Custom colours do not require unlocking. **Undo** restores the previous colour for the latest action in the current paint session; **Done** leaves paint mode. Painted colours persist, while undo history is temporary and resets when paint mode is toggled.

Code: [`PaintPalette.tsx`](../src/components/PaintPalette.tsx), [`App.tsx`](../src/App.tsx), [`gameReducer.ts`](../src/state/gameReducer.ts), [`palette.ts`](../src/world/palette.ts).

## Journal

**Journal** opens a book on the latest page. Entries are sorted by local date and creation time; each day starts a new page, with continuation pages when needed. Entries show the activity, time, current leaf colour, reflection, mood, and photos when present.

Use the page arrows or left/right keys to turn pages. **Done**, Escape, or the backdrop closes the book. Selecting an entry focuses its leaves on the tree. Selecting leaves opens the journal on that record and marks it.

Code: [`JournalBook.tsx`](../src/components/JournalBook.tsx), [`journal.ts`](../src/game/journal.ts), [`history.ts`](../src/game/history.ts), [`App.tsx`](../src/App.tsx).

## Relics, keepsakes, and inscriptions

Each reflection gets a keepsake at the tip of its root, including reflections without text or photos. **Relics** lists the reflections and their saved details. **Find in the roots** focuses the keepsake; clicking a keepsake opens its reflection. Its colour follows the corresponding leaves' paint colour.

| Lifetime LP | Milestone |
| --- | --- |
| 20 | Carved stone is revealed. |
| 40 | Heartwood relic is revealed and the ruin lights up. |

The panel includes milestone lore and discovery times. Reflections with text, mood, or photos count as inscriptions for the ruin display.

Code: [`RelicsPanel.tsx`](../src/components/RelicsPanel.tsx), [`relics.ts`](../src/game/relics.ts), [`progression.ts`](../src/game/progression.ts), [`overlay.ts`](../src/world/overlay.ts), [`renderer.ts`](../src/world/renderer.ts).

## Shop and branch decorations

Open **Shop** beside Paint, choose a section, and buy using available LP. Each item costs at most 25 LP. Buttons show the LP shortfall when an item is unaffordable and display how many copies you own.

In **My items**, choose **Place**, then select a branch. **Move** selects a new branch for an existing decoration. **Store** removes it from the tree while retaining ownership. Moving and storing are free; storing does not refund LP. Multiple copies can be purchased and hung on a branch. Inventory and branch assignments persist.

| Tree section | Base price |
| --- | --- |
| Baubles | 5 LP |
| Ribbons & bows | 6 LP |
| Sweet treats | 8 LP |
| Lights | 10 LP |
| Nature | 12 LP |
| Figurines | 18 LP |
| Curios | 20 LP |

Premium-name matches in the catalog cost 25 LP, overriding section prices. The catalog is generated from existing trinket PNGs. Escape closes the shop when keyboard focus is inside it; **Cancel** exits placement mode.

Code: [`ShopPanel.tsx`](../src/shop/ShopPanel.tsx), [`catalog.ts`](../src/shop/catalog.ts), [`inventory.ts`](../src/shop/inventory.ts), [`decorations.ts`](../src/shop/decorations.ts), [`gameReducer.ts`](../src/state/gameReducer.ts).

## Spirit wardrobe

The shop also sells wearable accessories. **Buy & wear** purchases and equips an accessory. **My items** offers **Wear** and **Take off**. The spirit can wear one accessory per section; equipping another in that section takes the previous one off without deleting it. Accessories cannot be placed on branches.

| Spirit section | Base price |
| --- | --- |
| Hats | 15 LP |
| Eyewear | 10 LP |
| Scarves | 8 LP |
| Packs & capes | 15 LP |
| Wings & charms | 20 LP |
| Jewelry | 12 LP |
| Little jewels | 6 LP |

Premium matches cost 25 LP. Numbered sprite variants are alternate views, not separate products. Clothing placement accounts for front and side poses and layers pieces behind or in front of the spirit.

Code: [`catalog.ts`](../src/shop/catalog.ts), [`inventory.ts`](../src/shop/inventory.ts), [`outfit.ts`](../src/shop/outfit.ts), [`spirit.ts`](../src/world/spirit.ts), [`renderer.ts`](../src/world/renderer.ts).

## Spirit messages and settings

The spirit offers supportive messages based on recent activity counts and mood tags, without reading reflection text. A message requires at least three new records since the last dismissed message, and dismissal prevents another message that local day. The lookback window is seven days.

**Settings** toggles the spirit and reduced motion. Disabling the spirit also disables its movement and messages. Reduced motion changes growth and visual effects without deleting progress. **Reset save** asks for confirmation, then clears game progress, purchases, paint, and settings; the provider also clears saved photos when no records remain. The About text includes self-care context and support resources.

Code: [`SpiritBubble.tsx`](../src/components/SpiritBubble.tsx), [`spirit.ts`](../src/game/spirit.ts), [`SettingsPanel.tsx`](../src/components/SettingsPanel.tsx), [`GameProvider.tsx`](../src/state/GameProvider.tsx).

## Music and sound

Choosing **Start** or **Continue** starts a background track that loops for the rest of the session. The spirit plays a jump sound each time it jumps off the ground or a limb; stepping off a ledge is silent. Browsers only allow audio after the player interacts with the page, which is why the music waits for the title screen's button.

Code: [`sounds.ts`](../src/audio/sounds.ts), [`App.tsx`](../src/App.tsx), [`renderer.ts`](../src/world/renderer.ts).

## Demo and quick growth

**Grow ×10** is available in the normal tree view. Each press creates ten real activity records, cycling through the four activities: 50 lifetime LP plus ten branches and roots. These records are saved, appear in the journal, unlock colours, and count toward shop funds and milestones. Its displayed press counter is temporary.

Adding `?demo=1` to the URL shows **Next day** and **Reset** controls. Next day increments the saved calendar offset; it does not itself create an activity. Demo Reset immediately clears game state without the Settings confirmation dialog.

Code: [`GrowBoost.tsx`](../src/components/GrowBoost.tsx), [`DemoControls.tsx`](../src/components/DemoControls.tsx), [`App.tsx`](../src/App.tsx), [`gameReducer.ts`](../src/state/gameReducer.ts).

## Automatic saving

Game facts save after state changes in localStorage. Photos live separately in IndexedDB. Optional shop and photo fields allow older version-2 saves without those fields to load. Invalid or unreadable game data starts a new game; a failed write logs a warning and keeps the current session running.

There is no account sync or save export/import UI. Data belongs to this browser's site storage; clearing it removes the local save. See [storage details](resources.md#browser-storage).
