# movieboyz-web

Public site for the MovieBoyz Fantasy Box Office system, plus the artifact set it
renders.

The site renders; it does not score. Every figure a league rule decides is
pre-computed upstream and published to the `artifacts` branch of this repo.
Vanilla JS, built with Vite, served by GitHub Pages.

Two figures are worked out in the browser, and both are presentational rather
than rules ([platform#55](https://github.com/dthunder746/movieboyz-platform/issues/55)).

| Figure | Where | What it does |
|--------|-------|--------------|
| `roi` | `src/campaign/board.js` | A Board row's Profit to date over its Breakeven, both published. |
| `totalSeries` | `src/campaign/standings.js` | A User's Slate Profit and Bomb impact added per day, because the artifact publishes the two series apart and a single total only for the latest scored day. The chart needs a line. |

The line between the two kinds is whether changing the figure would change who
wins. Neither of these would: each is a published number restated for a cell or
a chart, and the artifact carries everything either one reads. The Slate ROI
used to sit beside them and does not any more, because excluding a bomb's
Breakeven from its picker's denominator is a league rule, and rules live in the
processor ([ADR 0003](https://github.com/dthunder746/movieboyz-platform/blob/main/docs/adr/0003-scoring-arithmetic.md)). A figure
that needs a rule to work out belongs upstream, whatever it is being rendered
into.

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
