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
// `explicitRoot` wins over the path when the page has one, and only the
// catch-all page does. It is served for a path that can name anything at all, so
// the path there is the reader's typing rather than evidence of where the site
// sits, and deriving from it points the navigation at whatever they typed. Its
// `<base>` bootstrap already worked the root out before the module graph was
// addressable, and that is the answer to carry.
//
// Failing that, a path naming no section at all is taken to be the root itself,
// which is what the repo root is. The one path that misreads is an unmatched
// path under a prefix that names no section, which only the catch-all answers
// and where the `<base>` is wrong in the same way
// (`docs/adr/0010-addressing-pages-on-a-static-host.md` in the platform repo).
export function siteRoot(pathname, explicitRoot) {
  if (explicitRoot) return explicitRoot.endsWith('/') ? explicitRoot : `${explicitRoot}/`;

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

// Where the root's redirect should actually send a reader, absolute, or null if
// the Manifest names nowhere to send them.
//
// The relative path above has to be resolved against something, and it must be
// the site root rather than the address the page was served at. Those are the
// same thing whenever the root is served where it belongs. When they are not,
// resolving against the address appends the default view to it instead of
// replacing it, and since the result is another address with no page, the next
// load appends again: `/league/movieboyz/2099` becomes
// `/league/movieboyz/league/movieboyz/2026/` and grows without limit.
//
// A caller that gets back the path it passed in should render rather than hop.
// That is the one hop this cannot prevent, for a root `siteRoot` cannot locate,
// and stopping there bounds the walk at one step instead of none.
export function defaultViewTarget(pathname, manifest) {
  const path = defaultViewPath(manifest);
  if (!path) return null;
  return `${siteRoot(pathname)}${path}`;
}
