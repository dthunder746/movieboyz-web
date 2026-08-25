import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { defineConfig } from 'vite';

// Answer an unmatched path the way the host does, in dev.
//
// Pages serves `404.html` for a path it has no file for, which is the whole
// mechanism the catch-all rests on. Vite's dev server does not: it defaults to
// `appType: 'spa'` and hands back the root `index.html` instead. That made the
// catch-all impossible to exercise locally, and worse, it served the root's
// redirect at a Campaign address, where the hop it makes used to append rather
// than replace and the page walked off into an ever longer URL.
//
// `appType: 'mpa'` turns the fallback off; this puts the right one back. The
// status is 404 because that is what Pages answers with, and the accepted cost
// recorded in ADR 0010 is only legible if dev shows it too.
function serveCatchAll(root) {
  return {
    name: 'movieboyz-catch-all',
    apply: 'serve',
    configureServer(server) {
      // Returning a function installs this late in Vite's own chain, but not
      // last: it lands after the HTML fallback and before the middleware that
      // actually serves the file. So the fallback has already rewritten a
      // directory request to its `index.html` by the time this runs, and a path
      // that exists on disk here is a real page that belongs to Vite.
      return () => {
        server.middlewares.use(async (req, res, next) => {
          if (req.method !== 'GET' || !req.headers.accept?.includes('text/html')) return next();

          const requested = decodeURIComponent(req.url.split('?')[0]);
          if (requested.endsWith('.html') && existsSync(join(root, requested))) return next();

          try {
            const html = await readFile(resolve(root, '404.html'), 'utf8');
            res.statusCode = 404;
            res.setHeader('Content-Type', 'text/html');
            res.end(await server.transformIndexHtml(req.url, html, req.originalUrl));
          } catch {
            next();
          }
        });
      };
    },
  };
}

// Relative base so the build works both at a Pages project path and under the
// custom domain after cutover (DNS untouched, per the cutover plan).
export default defineConfig({
  base: './',
  appType: 'mpa',
  plugins: [serveCatchAll(import.meta.dirname)],
  build: {
    rollupOptions: {
      // Every page is its own entry. The root is a redirect at the manifest's
      // default view; each League is a directory carrying its landing page, and
      // each Campaign is a directory inside it so its URL carries the league
      // and the year, which is what the page reads to know what to show. A
      // League's own file is the same shell whichever League it is, so a second
      // published League is one more entry here and no code. The draft is a
      // page of the Campaign rather than a section of its own, so it is a
      // directory inside the year: a draft is always one year's, and its
      // address says which (#81).
      // The Movies lookup is a section of its own: it belongs to no League and
      // its URL says so. One Movie is a page inside that section, addressed by
      // a query parameter rather than a directory apiece: a slice republishes
      // daily and can carry a film this build has never heard of, so a
      // directory per Movie would 404 for exactly the new releases most worth
      // looking at (ADR 0010).
      //
      // `404.html` is the catch-all. Pages serves it for a path it has no file
      // for, and it renders whatever Campaign that path names, so a newly
      // published year is reachable the moment its artifact lands rather than
      // waiting on a deploy. The real directories above are kept for the
      // current year so the common case answers 200
      // (platform docs/adr/0010-addressing-pages-on-a-static-host.md).
      //
      // There is only ever one catch-all, so it cannot be a Campaign page: a
      // draft address is a Campaign address with one segment on the end, and
      // both arrive at the same file. `src/catchall/entry.js` is what tells
      // them apart, and it imports the page it picked dynamically so the two
      // stay in separate chunks (#85).
      input: {
        root: resolve(import.meta.dirname, 'index.html'),
        movieboyzLanding: resolve(import.meta.dirname, 'league/movieboyz/index.html'),
        movieboyz2026: resolve(
          import.meta.dirname,
          'league/movieboyz/2026/index.html',
        ),
        movieboyz2026Draft: resolve(
          import.meta.dirname,
          'league/movieboyz/2026/draft/index.html',
        ),
        movies: resolve(import.meta.dirname, 'movies/index.html'),
        movieDetail: resolve(import.meta.dirname, 'movies/movie/index.html'),
        catchAll: resolve(import.meta.dirname, '404.html'),
      },
    },
  },
});
