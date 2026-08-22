import { describe, expect, it } from 'vitest';

import { campaignFromPath, defaultViewPath, isMoviesPath, siteRoot } from './route.js';

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

  it('is false at the root', () => {
    expect(isMoviesPath('/')).toBe(false);
  });
});
