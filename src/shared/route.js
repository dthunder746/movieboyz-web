// Which Campaign a page is showing, read off the page's own URL, and where the
// site's root sits above it.
//
// The manifest's `default_view` answers "where should a reader who asked for
// nothing in particular land", which is the root redirect's question. It is the
// wrong answer for a page that already sits at a Campaign's own path: once 2027
// opens, `/league/movieboyz/2026/` still has to show 2026.

// `league` is the marker rather than a fixed position, because the build sets a
// relative base and the same files serve both from the custom domain and from a
// Pages project path, which prefixes everything with the repo name.
const LEAGUE_SEGMENT = 'league';
const MOVIES_SEGMENT = 'movies';

// The path's directory segments, with a trailing file dropped. `index.html` is
// the file every one of these pages is really at, and it says nothing about
// where the page sits.
function directorySegments(pathname) {
  const segments = String(pathname ?? '')
    .split('/')
    .filter((segment) => segment);

  if (segments.length && segments[segments.length - 1].includes('.')) segments.pop();
  return segments;
}

function isYear(segment) {
  return /^\d{4}$/.test(segment ?? '');
}

// Where a Campaign's own three segments start, or -1. The last `league` on the
// path rather than the first, because the prefix is somebody else's naming and
// can repeat the marker.
function campaignMarker(segments) {
  const marker = segments.lastIndexOf(LEAGUE_SEGMENT);
  if (marker === -1 || !isYear(segments[marker + 2])) return -1;
  return marker;
}

export function campaignFromPath(pathname) {
  const segments = directorySegments(pathname);

  const marker = campaignMarker(segments);
  if (marker === -1) return null;

  return { leagueSlug: segments[marker + 1], year: Number(segments[marker + 2]) };
}

export function isMoviesPath(pathname) {
  const segments = directorySegments(pathname);
  if (campaignMarker(segments) !== -1) return false;
  return segments.lastIndexOf(MOVIES_SEGMENT) !== -1;
}

// The absolute path the site's own root sits at, always ending in a slash.
//
// Navigation links are written from it rather than as `../`, for two reasons.
// The site serves both from the domain apex and from a Pages project path that
// puts the repo name in front of everything, so the prefix has to be carried
// rather than assumed. And the catch-all page sets a `<base>` pointing here, so
// a `../` link on that page would be counted twice.
//
// A path naming no section at all is taken to be the root itself, which is what
// the repo root is. The one path that misreads is an unmatched path under a
// prefix, which the catch-all page answers and which names no Campaign anyway
// (`docs/adr/0010-addressing-pages-on-a-static-host.md` in the platform repo).
export function siteRoot(pathname) {
  const segments = directorySegments(pathname);

  const marker = campaignMarker(segments);
  if (marker !== -1) return absolutePath(segments.slice(0, marker));

  const movies = segments.lastIndexOf(MOVIES_SEGMENT);
  if (movies !== -1) return absolutePath(segments.slice(0, movies));

  return absolutePath(segments);
}

function absolutePath(segments) {
  return segments.length ? `/${segments.join('/')}/` : '/';
}

// The other direction, for the repo root. `default_view` answers "which Campaign
// should a reader who asked for nothing in particular land on", and the root is
// the one page that asks exactly that.
//
// The path is relative for the same reason the build's base is: the root can be
// served from the domain apex or from a Pages project path, and only a relative
// redirect survives both.
export function defaultViewPath(manifest) {
  const view = manifest?.default_view;
  if (!view?.league_slug || !view?.year) return null;
  return `${LEAGUE_SEGMENT}/${view.league_slug}/${view.year}/`;
}
