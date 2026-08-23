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

The two branches move on their own schedules, and the catch all page is what
keeps that from mattering. A Campaign published to `artifacts` today is
reachable today, without a push to `main` and without a deploy, because
`404.html` renders any Campaign path rather than only the ones the build made a
directory for. Only the current year has a directory, so the address everybody
loads answers 200 and an unlisted year answers 404 with a working page. See
[ADR 0010](https://github.com/dthunder746/movieboyz-platform/blob/main/docs/adr/0010-addressing-pages-on-a-static-host.md)
for why addresses are shaped the way they are.

## Source layout

| Path | What lives there |
|-----------|------------------|
| `src/site.css` | The one stylesheet, linked from every page's `<head>` and never imported from JavaScript. Linked that way it builds to a single asset every page shares and the browser caches once. Reached through the JavaScript graph it would be split per page. |
| `src/shared/` | What more than one page needs. Money and date formatting, the palettes, the light/dark theme, the favicon, the artifact fetch plumbing, the URL reading and the plotted-row selection, plus the test stub for that seam under `testing/`. `ratings.js` is the review sources catalogue and how each one's stored score is read back into its own units. `lifecycle.js` is what a Campaign state is called and how it is toned. `route.js` composes and reads the site's addresses and `location.js` is the DOM half of that, which asks the document where the site root actually is. `nav.js` builds the navigation every page carries and `notice.js` is the page a reader gets when there is nothing to render. |
| `src/campaign/` | One Campaign year's page. The Board, the Standings, the Profit series, and the surfaces that render them. `entry.js` is what the HTML loads, `layout.js` holds the markup, and `page.js` fills it in. |
| `src/movies/` | The Movies lookup page. Every Movie the platform tracks, read from the Movie slices and no League file, so it works for a reader who is in no League. |
| `src/movies/movie/` | One Movie's own page, at `/movies/movie/?id=tt0068646`. Its full box office curve, its Weekly gross, its facts and its ratings, plus the way back to any Campaign holding it. A section of the lookup rather than a top level address, which is what keeps `siteRoot` and the catch all's `<base>` bootstrap out of it. |
| `404.html` | The catch all. Its build entry sits beside the real pages in `vite.config.js`, and it loads the same Campaign entry they do. |

The Campaign is the one page group with two HTML files, and neither of them
holds its markup. `league/movieboyz/2026/index.html` and `404.html` are thin
shells around a single `<div id="page">` plus the CDN tags, both loading
`src/campaign/entry.js`, which reads the Campaign off the page's own URL and
renders `layout.js` into that div. The markup lives in a module because two
files need it and a second copy would drift. `404.html` additionally opens with
an inline script that writes a `<base>`, because the host serves it from
arbitrary paths and its relative asset URLs would otherwise resolve against
whatever the reader typed. That script duplicates a few lines of `route.js` on
purpose: it has to run before the module graph is addressable.

A page imports from `shared`; nothing in `shared` imports back out, so a page
group can be added without editing another one. `src/movies/` is the first one
added that way, and the one edit it did make to `src/campaign/` was the lift of
`selection.js` into `shared/` once both pages needed it.

Shared does not mean free of the domain. `route.js` reads a Campaign off the
URL and `favicon.js` paints the leader of one, because that is what those jobs
are, whoever is asking. The line is a dependency rather than a vocabulary: a
module belongs in `shared` when it needs nothing from a page group, not when it
has stopped naming Campaigns. That is why the artifact fetching splits in two.
`shared/artifacts.js` knows how to fetch one and needs nothing; `campaign/data.js`
knows which ones a Campaign needs and reads that off the Board.

## Local development

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # vitest, the view-model suites under src/
npm run build
```

CI runs `npm test` before `npm run build`, so a failing suite stops the deploy.

`VITE_ARTIFACT_BASE` overrides where artifacts are fetched from, for pointing a
local site at a scratch set.
