import { resolve } from 'node:path';

import { defineConfig } from 'vite';

// Relative base so the build works both at a Pages project path and under the
// custom domain after cutover (DNS untouched, per the cutover plan).
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      // Every page is its own entry. The root is a redirect at the manifest's
      // default view; each Campaign is a directory so its URL carries the
      // league and the year, which is what the page reads to know what to show.
      // The Movies lookup is a section of its own: it belongs to no League and
      // its URL says so.
      input: {
        root: resolve(import.meta.dirname, 'index.html'),
        movieboyz2026: resolve(
          import.meta.dirname,
          'league/movieboyz/2026/index.html',
        ),
        movies: resolve(import.meta.dirname, 'movies/index.html'),
      },
    },
  },
});
