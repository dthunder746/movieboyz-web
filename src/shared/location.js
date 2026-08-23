// The document half of writing a link: where this page actually is, and what a
// link into a Movie has to do to survive the surface it sits on.
//
// `route.js` composes an address from a site root and says nothing about where
// that root is; this is the half that asks the document. It is the one thing
// the link writers cannot work out for themselves and the reason it is not in
// `route.js`, which is pure and takes a path as an argument.
//
// The second half is the class every Movie link carries and the guard that
// keeps a click on one from also being read as a row selection. It sits here
// because it is the same question asked of the DOM rather than of a path, and
// because a link and the class naming it are no use apart.
//
// Untested by design, as the site's other DOM wiring is. What it decides
// (`siteRoot`, `movieHref`) is tested next door in `route.test.js`.

import { movieHref, siteRoot } from './route.js';

// The root a `<base>` declares, if the page declares one. Only the catch-all
// page does, and it is the only page whose own address does not say where the
// site root is. Reading `.href` rather than the attribute lets the browser
// resolve it, so whatever shape it was written in comes back as a path.
export function documentRoot() {
  const base = document.querySelector('base');
  return base ? new URL(base.href).pathname : '';
}

let root = null;

// Where the site root sits, worked out once. It cannot change while the page is
// open, and a table asks for it once per rendered cell.
export function currentRoot() {
  if (root === null) root = siteRoot(window.location.pathname, documentRoot());
  return root;
}

export function movieUrl(imdbId) {
  return movieHref(currentRoot(), imdbId);
}

// The class every link into a Movie page carries, so the guard below and the
// stylesheet name the same thing.
export const MOVIE_LINK_CLASS = 'movie-title-link';

// Keep a click on one of those links from also being read as a row selection.
//
// Both tables are Tabulator instances with `selectableRows`, which selects on
// any click anywhere inside a row. Without this a reader opening a Movie in a
// new tab would silently plot the film they were leaving on the chart behind
// them. Caught on the way down, before the event reaches the row element
// Tabulator listens on, and the navigation itself is left alone.
//
// Attached once per host, because both table builders render into the same
// element and either can be rebuilt while the page is open.
export function guardMovieLinks(elementId) {
  const host = document.getElementById(elementId);
  if (!host || host.dataset.movieLinkGuard) return;
  host.dataset.movieLinkGuard = 'true';

  host.addEventListener('click', (event) => {
    if (event.target.closest(`.${MOVIE_LINK_CLASS}`)) event.stopPropagation();
  }, true);
}
