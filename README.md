# Little World

A browser self-care game: record small acts of care to grow a pixel-art tree, keep reflections, decorate branches, and dress the tree spirit.

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
