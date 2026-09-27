// The Movies section's dispatcher: the lookup table, or one film.
//
// `/movies/` and `/movies/?id=tt0068646` are the same file, because a Movie is
// addressed by a query parameter rather than a directory of its own: a slice
// republishes daily and can carry a film this build has never heard of, so a
// directory per Movie would 404 for exactly the new releases most worth looking
// at (ADR 0010). The film used to sit one directory deeper, at
// `/movies/movie/?id=`, which made the section's own address and the film's
// look unrelated and left `/movies/movie/` naming nothing (#187).
//
// The decision is `movieIdFromSearch`, next door in `shared/route.js` with a
// test beside it. What is here is the import that follows from it, and it is
// dynamic so that Vite splits the two: a reader who came for one film should
// not be made to download the lookup table's filters, sorting and cards to see
// it, and a reader of the table should not download the film page.
//
// The surface the address did not name goes before the import rather than
// after. Both are written out in `movies/index.html` and they name some of the
// same things, so the page module has to find one of each; taking the other
// away first is what makes that true, and it happens here, synchronously,
// before either module runs.

import { movieIdFromSearch } from '../shared/route.js';

const imdbId = movieIdFromSearch(window.location.search);

document.getElementById(imdbId ? 'movies-lookup' : 'movie-detail')?.remove();

if (imdbId) {
  import('./movie/page.js');
} else {
  import('./page.js');
}
