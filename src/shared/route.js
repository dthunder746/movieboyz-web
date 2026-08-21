// Which Campaign a page is showing, read off the page's own URL.
//
// The manifest's `default_view` answers "where should a reader who asked for
// nothing in particular land", which is the root redirect's question. It is the
// wrong answer for a page that already sits at a Campaign's own path: once 2027
// opens, `/league/movieboyz/2026/` still has to show 2026.

// `league` is the marker rather than a fixed position, because the build sets a
// relative base and the same files serve both from the custom domain and from a
// Pages project path, which prefixes everything with the repo name.
const LEAGUE_SEGMENT = 'league';

export function campaignFromPath(pathname) {
  const segments = String(pathname ?? '')
    .split('/')
    .filter((segment) => segment);

  const marker = segments.lastIndexOf(LEAGUE_SEGMENT);
  if (marker === -1) return null;

  const leagueSlug = segments[marker + 1];
  const year = segments[marker + 2];
  if (!/^\d{4}$/.test(year ?? '')) return null;

  return { leagueSlug, year: Number(year) };
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
