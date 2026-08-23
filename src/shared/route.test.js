import { describe, expect, it } from 'vitest';

import {
  campaignFromPath,
  campaignHref,
  campaignPath,
  defaultViewPath,
  defaultViewTarget,
  isMoviesPath,
  leagueFromPath,
  leagueHref,
  leaguePath,
  movieHref,
  movieIdFromSearch,
  moviePath,
  siteRoot,
} from './route.js';

// Which Campaign a page shows is settled by where the page sits, not by the
// manifest's `default_view`. Once a second Campaign is published the 2026 page
// has to keep showing 2026 even though the default has moved on.
describe('campaignFromPath', () => {
  it('reads the league and year off a directory path', () => {
    expect(campaignFromPath('/league/movieboyz/2026/')).toEqual({
      leagueSlug: 'movieboyz',
      year: 2026,
    });
  });

  it('reads them off the index.html itself', () => {
    expect(campaignFromPath('/league/movieboyz/2026/index.html')).toEqual({
      leagueSlug: 'movieboyz',
      year: 2026,
    });
  });

  // The build sets a relative base so it serves both from the custom domain and
  // from a Pages project path, which puts the repo name in front of everything.
  it('ignores whatever the path is prefixed with', () => {
    expect(campaignFromPath('/movieboyz-web/league/movieboyz/2026/')).toEqual({
      leagueSlug: 'movieboyz',
      year: 2026,
    });
  });

  // The prefix is somebody else's naming, so it can collide with the marker.
  // The Campaign is the last `league` on the path, not the first.
  it('ignores a prefix that repeats the league marker', () => {
    expect(campaignFromPath('/league/league/movieboyz/2026/')).toEqual({
      leagueSlug: 'movieboyz',
      year: 2026,
    });
  });

  it('gives the year back as a number', () => {
    expect(campaignFromPath('/league/movieboyz/2026/').year).toBe(2026);
  });

  it('finds no Campaign at the root', () => {
    expect(campaignFromPath('/')).toBeNull();
  });

  it('finds no Campaign where the path names no league', () => {
    expect(campaignFromPath('/about/index.html')).toBeNull();
  });

  // A path that reaches this far is malformed rather than a different Campaign,
  // so falling back to the manifest's default beats fetching `leagues/x/NaN`.
  it('finds no Campaign where the year is not a year', () => {
    expect(campaignFromPath('/league/movieboyz/latest/')).toBeNull();
  });

  it('finds no Campaign where the league segment is missing', () => {
    expect(campaignFromPath('/league/2026/')).toBeNull();
  });
});

// A League's own landing page, which is the Campaign path with the year taken
// off. It is the one address that names a League and not a year (#67).
describe('leagueFromPath', () => {
  it('reads the slug off a directory path', () => {
    expect(leagueFromPath('/league/movieboyz/')).toEqual({ leagueSlug: 'movieboyz' });
  });

  it('reads it off the index.html itself', () => {
    expect(leagueFromPath('/league/movieboyz/index.html')).toEqual({
      leagueSlug: 'movieboyz',
    });
  });

  it('ignores whatever the path is prefixed with', () => {
    expect(leagueFromPath('/movieboyz-web/league/movieboyz/')).toEqual({
      leagueSlug: 'movieboyz',
    });
  });

  it('ignores a prefix that repeats the league marker', () => {
    expect(leagueFromPath('/league/league/movieboyz/')).toEqual({
      leagueSlug: 'movieboyz',
    });
  });

  // A Campaign is not its League's landing page. The slug has to be the last
  // segment, which is what keeps the two addresses apart in one direction and
  // stops a landing page rendering at a Campaign's address in the other.
  it('finds no League at a Campaign path', () => {
    expect(leagueFromPath('/league/movieboyz/2026/')).toBeNull();
  });

  // The same rule catches a malformed year, which `campaignFromPath` already
  // refuses. Reading it as a landing page would answer a typo with a page.
  it('finds no League where a Campaign path is malformed', () => {
    expect(leagueFromPath('/league/movieboyz/latest/')).toBeNull();
  });

  it('finds no League at the root', () => {
    expect(leagueFromPath('/')).toBeNull();
  });

  it('finds no League where the slug is missing', () => {
    expect(leagueFromPath('/league/')).toBeNull();
  });

  it('finds no League at the Movies section', () => {
    expect(leagueFromPath('/movies/')).toBeNull();
  });
});

// The other direction: where the repo root sends a reader who asked for nothing
// in particular. The manifest names the Campaign; this turns it into a path.
describe('defaultViewPath', () => {
  it('builds the path the manifest points at', () => {
    const manifest = { default_view: { league_slug: 'movieboyz', year: 2026 } };
    expect(defaultViewPath(manifest)).toBe('league/movieboyz/2026/');
  });

  // Relative, because the build sets a relative base and the root can be served
  // from a Pages project path as easily as from the domain apex.
  it('keeps the path relative', () => {
    const manifest = { default_view: { league_slug: 'movieboyz', year: 2026 } };
    expect(defaultViewPath(manifest).startsWith('/')).toBe(false);
  });

  it('round-trips back through campaignFromPath', () => {
    const manifest = { default_view: { league_slug: 'movieboyz', year: 2026 } };
    expect(campaignFromPath(`/${defaultViewPath(manifest)}`)).toEqual({
      leagueSlug: 'movieboyz',
      year: 2026,
    });
  });

  it('finds no path when the manifest names no default view', () => {
    expect(defaultViewPath({})).toBeNull();
  });

  it('finds no path when the default view is missing its year', () => {
    expect(defaultViewPath({ default_view: { league_slug: 'movieboyz' } })).toBeNull();
  });

  it('finds no path when the default view is missing its league', () => {
    expect(defaultViewPath({ default_view: { year: 2026 } })).toBeNull();
  });
});

// Where the root's redirect actually sends a reader. `defaultViewPath` answers
// with a relative path so it survives both the apex and a Pages project path,
// and this is the half that decides what it is relative to.
describe('defaultViewTarget', () => {
  const MANIFEST = { default_view: { league_slug: 'movieboyz', year: 2026 } };

  it('sends a reader at the root to the default view', () => {
    expect(defaultViewTarget('/', MANIFEST)).toBe('/league/movieboyz/2026/');
  });

  it('keeps the Pages project path in front', () => {
    expect(defaultViewTarget('/movieboyz-web/', MANIFEST)).toBe(
      '/movieboyz-web/league/movieboyz/2026/',
    );
  });

  // The loop this exists to stop. A host that serves the root's markup at an
  // address that is not the root used to make the hop resolve against that
  // address, appending the default view to it instead of replacing it, and the
  // next load appended again. Pinning the hop to the site root ends it.
  it('pins the hop to the site root rather than the address it was served at', () => {
    expect(defaultViewTarget('/league/movieboyz/2099', MANIFEST)).toBe(
      '/league/movieboyz/2026/',
    );
    expect(defaultViewTarget('/league/movieboyz/2099/', MANIFEST)).toBe(
      '/league/movieboyz/2026/',
    );
  });

  // Belt and braces for a root this module cannot locate. One hop lands here,
  // the target matches the address, and the caller stops rather than going
  // round again.
  it('answers the address it was given when the hop would land back on it', () => {
    expect(defaultViewTarget('/typo/league/movieboyz/2026/', MANIFEST)).toBe(
      '/typo/league/movieboyz/2026/',
    );
  });

  it('answers nothing when the manifest names no default view', () => {
    expect(defaultViewTarget('/', {})).toBeNull();
  });
});

// Where the site's root sits above the page asking. Every navigation link is
// written from it, because the same files serve from the domain apex and from
// a Pages project path that puts the repo name in front of everything, and a
// link written as `../` breaks under the catch-all page, whose `<base>` already
// points at the root.
describe('siteRoot', () => {
  it('is the apex for a Campaign served from it', () => {
    expect(siteRoot('/league/movieboyz/2026/')).toBe('/');
  });

  it('keeps the Pages project path in front', () => {
    expect(siteRoot('/movieboyz-web/league/movieboyz/2026/')).toBe('/movieboyz-web/');
  });

  it('ignores the file the path ends at', () => {
    expect(siteRoot('/movieboyz-web/league/movieboyz/2026/index.html')).toBe(
      '/movieboyz-web/',
    );
  });

  it('reads the Movies section as one below the root', () => {
    expect(siteRoot('/movieboyz-web/movies/index.html')).toBe('/movieboyz-web/');
  });

  it('is the apex at the apex', () => {
    expect(siteRoot('/')).toBe('/');
  });

  it('is the whole directory path at a root served from a prefix', () => {
    expect(siteRoot('/movieboyz-web/')).toBe('/movieboyz-web/');
  });

  // Same reason `campaignFromPath` takes the last marker: the prefix is
  // somebody else's naming and can repeat it.
  it('ignores a prefix that repeats the league marker', () => {
    expect(siteRoot('/league/league/movieboyz/2026/')).toBe('/league/');
  });

  // A League could be slugged `movies`. The Campaign shape is checked first, so
  // the section marker cannot be read off a league slug.
  it('reads a Campaign whose league is slugged like the Movies section', () => {
    expect(siteRoot('/league/movies/2026/')).toBe('/');
  });

  // A League landing page sits one segment shallower than a Campaign, and the
  // root is still whatever comes before the marker.
  it('reads a League landing page as two below the root', () => {
    expect(siteRoot('/movieboyz-web/league/movieboyz/')).toBe('/movieboyz-web/');
  });

  it('reads a League landing page slugged like the Movies section', () => {
    expect(siteRoot('/league/movies/')).toBe('/');
  });

  // Neither a Campaign nor a landing page, which is a path only the catch-all
  // answers. The marker still says where the site starts, so the navigation it
  // renders points at the site rather than at the typo.
  it('locates the root from the marker alone when the rest is malformed', () => {
    expect(siteRoot('/movieboyz-web/league/movieboyz/latest/')).toBe('/movieboyz-web/');
  });

  // The catch-all page is served for a path that can name anything at all, so
  // the path is not evidence of where the root is. Its `<base>` bootstrap
  // already worked that out before the module graph was addressable, and it is
  // the answer to use when there is one. Without this a reader who landed on
  // `/typo/` got a navigation pointing at `/typo/league/...`, which is the
  // dead end the notice page exists to avoid.
  describe('given an explicit root', () => {
    it('takes it over anything the path says', () => {
      expect(siteRoot('/typo/', '/')).toBe('/');
      expect(siteRoot('/movieboyz-web/typo/', '/movieboyz-web/')).toBe('/movieboyz-web/');
    });

    it('still ends it in a slash', () => {
      expect(siteRoot('/typo/', '/movieboyz-web')).toBe('/movieboyz-web/');
    });

    it('falls back to the path when there is no explicit root', () => {
      expect(siteRoot('/movieboyz-web/league/movieboyz/2026/', '')).toBe('/movieboyz-web/');
    });
  });
});

// Which section a page sits in, for marking the navigation entry the reader is
// already on.
describe('isMoviesPath', () => {
  it('is true at the Movies section', () => {
    expect(isMoviesPath('/movies/')).toBe(true);
  });

  it('is true at the Movies index itself', () => {
    expect(isMoviesPath('/movieboyz-web/movies/index.html')).toBe(true);
  });

  it('is false at a Campaign whose league is slugged like the section', () => {
    expect(isMoviesPath('/league/movies/2026/')).toBe(false);
  });

  it('is false at a League landing page slugged like the section', () => {
    expect(isMoviesPath('/league/movies/')).toBe(false);
  });

  it('is false at the root', () => {
    expect(isMoviesPath('/')).toBe(false);
  });
});

// ── Addresses the site writes rather than reads ────────────────────────────
//
// The other direction of the same knowledge. A page that links to a Campaign or
// to a Movie composes the address here rather than writing the segments out,
// so the two directions cannot drift.

describe('leaguePath', () => {
  it('is the two segments a League sits under', () => {
    expect(leaguePath('movieboyz')).toBe('league/movieboyz/');
  });

  it('encodes a slug that is not URL safe', () => {
    expect(leaguePath('a b')).toBe('league/a%20b/');
  });
});

describe('leagueHref', () => {
  it('hangs the League off the site root', () => {
    expect(leagueHref('/', 'movieboyz')).toBe('/league/movieboyz/');
  });

  it('carries a prefix the site is served under', () => {
    expect(leagueHref('/movieboyz-web/', 'movieboyz')).toBe('/movieboyz-web/league/movieboyz/');
  });
});

describe('campaignPath', () => {
  it('is the three segments a Campaign sits under', () => {
    expect(campaignPath('movieboyz', 2026)).toBe('league/movieboyz/2026/');
  });

  // The slug arrives off the Manifest and goes into a path segment, so it is
  // encoded as one.
  it('encodes a slug that is not URL safe', () => {
    expect(campaignPath('a b', 2026)).toBe('league/a%20b/2026/');
  });
});

describe('campaignHref', () => {
  it('hangs the Campaign off the site root', () => {
    expect(campaignHref('/', 'movieboyz', 2026)).toBe('/league/movieboyz/2026/');
  });

  it('carries a prefix the site is served under', () => {
    expect(campaignHref('/movieboyz-web/', 'movieboyz', 2026))
      .toBe('/movieboyz-web/league/movieboyz/2026/');
  });
});

// A Movie is a query parameter on one page rather than a directory of its own,
// because a Movie can be published between deploys and a directory that does
// not exist yet 404s (ADR 0010).
describe('moviePath', () => {
  it('is the one detail page carrying the identifier', () => {
    expect(moviePath('tt0068646')).toBe('movies/movie/?id=tt0068646');
  });

  it('encodes an identifier that is not URL safe', () => {
    expect(moviePath('tt 1&2')).toBe('movies/movie/?id=tt%201%262');
  });
});

describe('movieHref', () => {
  it('hangs the Movie page off the site root', () => {
    expect(movieHref('/', 'tt0068646')).toBe('/movies/movie/?id=tt0068646');
  });

  it('carries a prefix the site is served under', () => {
    expect(movieHref('/movieboyz-web/', 'tt0068646'))
      .toBe('/movieboyz-web/movies/movie/?id=tt0068646');
  });
});

// The read side of the same address. The detail page is one file serving every
// Movie, so the identifier off the query string is the whole of what it knows
// about which Movie it is showing.
describe('movieIdFromSearch', () => {
  it('reads the identifier off the query string', () => {
    expect(movieIdFromSearch('?id=tt0068646')).toBe('tt0068646');
  });

  it('reads it from among other parameters', () => {
    expect(movieIdFromSearch('?utm=x&id=tt0068646')).toBe('tt0068646');
  });

  it('decodes an encoded identifier', () => {
    expect(movieIdFromSearch('?id=tt%201')).toBe('tt 1');
  });

  it('trims whitespace a reader pasted with it', () => {
    expect(movieIdFromSearch('?id=%20tt0068646%20')).toBe('tt0068646');
  });

  // Each of these is a page with no Movie to show rather than a fault, and the
  // page says so. Answering null is what lets it tell them apart from a Movie
  // it simply could not find.
  it('is null where the query string names no Movie', () => {
    expect(movieIdFromSearch('')).toBe(null);
    expect(movieIdFromSearch('?')).toBe(null);
    expect(movieIdFromSearch('?other=1')).toBe(null);
    expect(movieIdFromSearch('?id=')).toBe(null);
    expect(movieIdFromSearch('?id=%20')).toBe(null);
    expect(movieIdFromSearch(null)).toBe(null);
    expect(movieIdFromSearch(undefined)).toBe(null);
  });
});
