# movieboyz-web

Public site for the MovieBoyz Fantasy Box Office system, plus the artifact set it
renders.

The site is a pure renderer. Every number it shows is pre-computed upstream and
published to the `artifacts` branch of this repo; nothing here calculates
anything. Vanilla JS, built with Vite, served by GitHub Pages.

## Branches

| Branch | What it holds |
|--------|---------------|
| `main` | Site source. Pushing here builds and deploys to Pages. |
| `artifacts` | The published artifact set (`index.json`, `leagues/<slug>/<year>.json`). Written by the upstream processor, never by hand, never force pushed. |

The site fetches from `raw.githubusercontent.com/dthunder746/movieboyz-web/artifacts`.
Both branches have to be publicly readable for that to work without a credential,
which is why the artifacts live here rather than beside the code that generates
them.

## Local development

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # vitest, the view-model suite under src/campaign/
npm run build
```

CI runs `npm test` before `npm run build`, so a failing suite stops the deploy.

`VITE_ARTIFACT_BASE` overrides where artifacts are fetched from, for pointing a
local site at a scratch set.
