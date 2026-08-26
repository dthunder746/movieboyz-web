# movieboyz-web

Public site for the MovieBoyz Fantasy Box Office system, plus the artifact set it
renders.

The site renders; it does not score. Every figure a league rule decides is
pre-computed upstream and published to the `artifacts` branch of this repo.
Vanilla JS, built with Vite, served by GitHub Pages.

Three figures are worked out in the browser, and all three are presentational
rather than rules ([platform#55](https://github.com/dthunder746/movieboyz-platform/issues/55)).

| Figure | Where | What it does |
|--------|-------|--------------|
| `roi` | `src/campaign/board.js` | A Board row's Profit to date over its Breakeven, both published. |
| `totalSeries` | `src/campaign/standings.js` | A User's Slate Profit and Bomb impact added per day, because the artifact publishes the two series apart and a single total only for the latest scored day. The chart needs a line. |
| `leaderboardForDraft` | `src/draft/season-helpers.js` | A User's published Profit to date added up over the Picks they hold on one Season's draft board, so the board can be ordered. |

The line between the two kinds is whether changing the figure would change who
wins. None of these would: each is a published number restated for a cell, a
chart or a board, and the artifact carries everything any of them reads. The
Season sums are the one to be careful about, because they carry a piece of
league knowledge the other two do not: a `hit` or a `bomb` is a year long Pick
and does not count towards a Season's totals, so the sum skips them. That is a
rule about what a Season board scores, sitting in the page. It is here rather
than upstream because nothing published decides a Season, the Outcome names the
Campaign's winner and not a board's, so there is no figure to read instead. If a
Season ever becomes something the league settles, this is the first thing that
should move.

The Slate ROI used to sit beside them and does not any more, because excluding a
bomb's Breakeven from its picker's denominator is a league rule, and rules live
in the processor ([ADR 0003](https://github.com/dthunder746/movieboyz-platform/blob/main/docs/adr/0003-scoring-arithmetic.md)).
A figure that needs a rule to work out belongs upstream, whatever it is being
rendered into.

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
| `src/shared/` | What more than one page needs. Money and date formatting, the palettes, the light/dark theme, the favicon, the artifact fetch plumbing, the URL reading and the plotted-row selection, plus the test stub for that seam under `testing/`. `icons.js` draws the Pick type and Season glyphs and the User badges. `ratings.js` is the review sources catalogue and how each one's stored score is read back into its own units. `lifecycle.js` is what a Campaign state is called and how it is toned. `route.js` composes and reads the site's addresses, both a League's own and a Campaign's inside it, and `location.js` is the DOM half of that, which asks the document where the site root actually is. `nav.js` builds the navigation every page carries and `notice.js` is the page a reader gets when there is nothing to render. `campaign-unavailable.js` is the error a page raises for a Campaign artifact that did not load, which is not in `artifacts.js` because that half knows nothing about a Campaign. |
| `src/league/` | One League's landing page, at `/league/movieboyz/`. The mega league down the left and a card per Campaign down the right, fed by a single landing artifact. Expanding a card fetches that year's Campaign artifact and renders its standings in place. `entry.js` is what the HTML loads, `layout.js` holds the markup, and `page.js` fills it in, as the Campaign group does. |
| `src/campaign/` | One Campaign year's page. The Board, the Standings, the Profit series, and the surfaces that render them. `entry.js` is what the HTML loads, `layout.js` holds the markup, and `page.js` fills it in. |
| `src/movies/` | The Movies lookup page. Every Movie the platform tracks, read from the Movie slices and no League file, so it works for a reader who is in no League. |
| `src/movies/movie/` | One Movie's own page, at `/movies/movie/?id=tt0068646`. Its full box office curve, its Weekly gross, its facts and its ratings, plus the way back to any Campaign holding it. A section of the lookup rather than a top level address, which is what keeps `siteRoot` and the catch all's `<base>` bootstrap out of it. |
| `src/draft/` | One Campaign year's draft page, at `/league/movieboyz/2026/draft/`. Three season tabs over a picks table, a leaderboard, a highlights strip and a sidebar of the Movies nobody took, plus a what if mode that swaps picks around and re scores the board. Ported from the old site. `entry.js` is what the HTML loads and `layout.js` holds the page shell, but only down to an empty `#draft-app`: the tabs and every surface under them are built by `page.js` once the Campaign lands, which is how the old page worked and was left alone in the port. |
| `src/catchall/` | What `404.html` loads. It reads the path, decides whether the address names a draft or a Campaign, and imports that page dynamically so the two stay in separate chunks. |
| `404.html` | The catch all. Its build entry sits beside the real pages in `vite.config.js`, and it loads the dispatcher above rather than a page directly. |

Three page groups keep their markup in a module rather than in their HTML, and
for the same reason in every case: more than one file needs it. The Campaign has
two (the real directory and the catch-all) and so does the draft. The League
landing has one today and one per published League after that, and nothing in
that shell names a League, so a second League is the same file in a directory
named for it plus one more build entry, rather than a second copy of the page to
keep in step.

Taking the Campaign's two first, neither of them holds its markup.
`league/movieboyz/2026/index.html` and `404.html` are thin
shells around a single `<div id="page">` plus the CDN tags, both loading
`src/campaign/entry.js`, which reads the Campaign off the page's own URL and
renders `layout.js` into that div. The markup lives in a module because two
files need it and a second copy would drift. `404.html` additionally opens with
an inline script that writes a `<base>`, because the host serves it from
arbitrary paths and its relative asset URLs would otherwise resolve against
whatever the reader typed. That script duplicates a few lines of `route.js` on
purpose: it has to run before the module graph is addressable.

The draft page sits the same way, one directory deeper. A Campaign address and
a draft address differ by one segment on the end, and the host has only ever one
`404.html` to answer both with, so the catch all cannot load either page
directly: `src/catchall/entry.js` asks `route.js` which one the path names and
imports it. The import is dynamic so Vite splits the two, and a reader who
landed on a Campaign address does not download the draft page's what if mode to
see it.

A page imports from `shared`; nothing in `shared` imports back out, so a page
group can be added without editing another one. `src/movies/` is the first one
added that way, and the one edit it did make to `src/campaign/` was the lift of
`selection.js` into `shared/` once both pages needed it. The draft page went the
same way and did it twice, lifting `icons.js` and the `CampaignUnavailable`
error out of `src/campaign/` rather than reaching sideways into it.

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
