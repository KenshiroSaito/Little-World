# Little World

**Take care of yourself. Watch what grows.**

Little World is a cozy pixel-art self-care game. Every small act of care, like a walk, a message to a friend, a break or a moment of reflection, grows a branch on your tree and pushes its roots deeper. Over time the tree fills with colour, its roots uncover an ancient ruin, and little characters move into tree houses in its branches.

**Play it in your browser:** https://kenshirosaito.github.io/Little-World/

---

## Who it is for

Little World is made for **students**.

Student life comes with deadlines, exams, part-time jobs, moving away from home and a lot of time alone with a screen. Self-care is usually the first thing to go when a week gets busy, and the tools meant to help often make it worse. Habit trackers count streaks, so one missed day feels like failure. Wellness apps can feel clinical, or ask for more energy than a tired student has.

## How it helps

**Small actions count.** The four activities are things a student can do between classes: **Walk**, **Connect** (reach out to someone), **Take a Break** and **Reflect**. None of them needs equipment, money or a big block of time.

**Nothing is lost when you rest.** There are no streaks, no wilting and no penalties. LP (life points) only ever goes up. Coming back after a hard week feels like returning to something that waited for you, not something you let down.

**Care you can see.** Each record grows a real branch and root, so progress is visible at a glance. Each activity has its own leaf colour, which shows the balance of your week. A tree that is all green walks and no orange "connect" leaves is a gentle nudge to message someone.

**A kind voice, not a coach.** The tree spirit notices what you *did* do this week ("You reached out to someone 3 times this week. The lanterns noticed."). It never mentions missed days. If you marked a mood like *tired* or *anxious* and still looked after yourself, that is what it points out. It only reads activity counts and mood tags, never your written reflections.

**Reflection without pressure.** Reflect lets you write one optional sentence, tag a mood and attach up to three photos. Your reflections are kept in a journal book, and are carved into the tablets of the ruin your roots uncover. That gives you a private record of how you have been, to look back on.

**Something to look forward to.** Relics to dig up, tree houses and characters that move in, a shop to spend LP on trinkets and outfits for the spirit, and a paint palette (with a full RGB mixer) to recolour your leaves. These give a reason to open the app that is about play, not obligation.

**Private by default.** No account, no server and no tracking. Everything, photos included, is saved only in your own browser.

**Help is one tap away.** Settings links to UVic Counselling Services and the 9-8-8 Suicide Crisis Helpline (call or text, Canada). Little World is a self-care companion, not a medical tool.

---

## Features

- **Self-Care panel**: record Walk, Connect, Take a Break or Reflect (+5 LP each, no daily limit).
- **A growing tree**: every record adds one branch with leaves and one root. Roots reach stone at 20 LP and the buried ruin at 40 LP.
- **Relics and inscriptions**: the Carved Stone and Heartwood Relic, plus your reflections written on the ruin's tablets.
- **Tree houses**: from 40 LP, a new house and resident appear with each record.
- **Playable spirit**: walk, jump and climb the trunk, branches and roots. Read the journal entry behind any leaf cluster.
- **Journal**: a page-turning book of everything you have recorded, day by day.
- **Paint mode**: recolour any leaf cluster with unlocked colours or your own RGB mix, with undo.
- **Shop**: spend LP on trinkets for the branches and accessories for the spirit. Your LP total never goes down.
- **Settings**: turn the spirit's messages on or off, reduce motion, and reset your save.

### Controls

| Action | Keys / input |
| --- | --- |
| Walk | Arrow keys or WASD |
| Jump | Space |
| Climb trunk, branches and roots | Up / Down |
| Read the journal entry at your leaves | E |
| Look around | Drag |
| Zoom | Scroll, or the + / − buttons |
| Fit the whole tree on screen | F, or the fit button |

### Demo tools

- **Grow ×10** (left edge of the screen): adds 10 records at once, so you can show a fully grown tree in a few presses.
- **`?demo`** at the end of the URL shows demo controls for skipping to the next day and resetting.

---

## Run locally

Use Node.js 22 (the version used by the deployment workflow) and npm.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite, then choose **Start** or **Continue**. The game saves in the current browser. No server or account setup is required.

## Documentation

- [Feature guide](docs/features.md): every player-facing feature, controls, limits, and the code that implements it.
- [Code map](docs/code-map.md): UI, game rules, state, rendering modules, and extension points.
- [Resources](docs/resources.md): art, sprite sheets, dependencies, storage, configuration, and deployment.
- [Art extraction tools](tools/README.md): rebuild atlases and individual item sprites from the source sheets.

## Checks and builds

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server with hot reload. |
| `npm run build` | Type-check the app and configuration, then produce `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm run lint` | Run ESLint. |
| `npm test` | Run Vitest in watch mode. |
| `npm test -- --run` | Run the test suite once. |

The GitHub Actions workflow builds pushes to `main` and publishes `dist/` to the `gh-pages` branch. See [deployment resources](docs/resources.md#build-and-deployment).

## Tech stack

- React 19 + TypeScript, built with Vite
- Three.js for lighting, glow and particle effects over a hand-drawn pixel-art canvas
- Vitest for tests
- `localStorage` and IndexedDB for saves and photos (nothing leaves the device)

---

## AI use

<!-- To be written by the team. -->
