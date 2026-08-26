import { describe, expect, it } from 'vitest';

import { buildNav } from './nav.js';

const ONE_LEAGUE = {
  leagues: [
    {
      slug: 'movieboyz',
      name: 'MovieBoyz',
      campaigns: [
        { year: 2025, state: 'final' },
        { year: 2026, state: 'active' },
        { year: 2027, state: 'drafting' },
      ],
    },
  ],
};

const TWO_LEAGUES = {
  leagues: [
    ONE_LEAGUE.leagues[0],
    {
      slug: 'filmfellas',
      name: 'Film Fellas',
      campaigns: [{ year: 2026, state: 'active' }],
    },
  ],
};

const CAMPAIGN_PATH = '/league/movieboyz/2026/';
const LANDING_PATH = '/league/movieboyz/';
const MOVIES_PATH = '/movies/';

describe('buildNav', () => {
  // Decision 20 of the parent spec (#58). One League published means its years
  // are the navigation, because a League menu with a single entry is a click
  // that answers nothing.
  it('lists the one League’s years at the top level', () => {
    const nav = buildNav(ONE_LEAGUE, CAMPAIGN_PATH);

    expect(nav.mode).toBe('years');
    expect(nav.leagues).toEqual([]);
    expect(nav.years.map((entry) => entry.year)).toEqual([2027, 2026, 2025]);
  });

  it('reads the years newest first', () => {
    const jumbled = {
      leagues: [
        {
          slug: 'movieboyz',
          name: 'MovieBoyz',
          campaigns: [
            { year: 2026, state: 'active' },
            { year: 2027, state: 'drafting' },
            { year: 2025, state: 'final' },
          ],
        },
      ],
    };

    expect(buildNav(jumbled, CAMPAIGN_PATH).years.map((entry) => entry.year)).toEqual([
      2027, 2026, 2025,
    ]);
  });

  // Each year is badged with its Lifecycle state, so a drafting year reads
  // differently from an active one and from a final one before anybody clicks.
  it('carries each year’s Lifecycle state and its label', () => {
    const nav = buildNav(ONE_LEAGUE, CAMPAIGN_PATH);

    expect(nav.years.map((entry) => [entry.state, entry.stateLabel])).toEqual([
      ['drafting', 'Drafting'],
      ['active', 'Active'],
      ['final', 'Final'],
    ]);
  });

  // Tolerant reader: a Lifecycle state this build has never heard of is shown
  // as the artifact wrote it rather than dropping the badge or the year.
  it('shows an unknown Lifecycle state as the artifact wrote it', () => {
    const manifest = {
      leagues: [
        { slug: 'movieboyz', name: 'MovieBoyz', campaigns: [{ year: 2026, state: 'settling' }] },
      ],
    };

    expect(buildNav(manifest, CAMPAIGN_PATH).years[0].stateLabel).toBe('settling');
  });

  it('links each year at its own Campaign path', () => {
    const nav = buildNav(ONE_LEAGUE, CAMPAIGN_PATH);

    expect(nav.years.map((entry) => entry.href)).toEqual([
      '/league/movieboyz/2027/',
      '/league/movieboyz/2026/',
      '/league/movieboyz/2025/',
    ]);
  });

  // Every link is written from the site root, so the same build serves from the
  // domain apex and from the Pages project path that prefixes everything.
  // Both halves of a link are somebody else's text: the slug comes off the
  // Manifest and the root is derived from an address the catch-all page lets
  // the reader choose. Every other interpolation in this module is escaped and
  // these are no different.
  it('escapes a League slug before it reaches a link', () => {
    const nav = buildNav(
      { leagues: [{ slug: 'a"b', name: 'Odd', campaigns: [{ year: 2026, state: 'active' }] }] },
      CAMPAIGN_PATH,
    );

    expect(nav.years[0].href).not.toContain('"');
    expect(nav.years[0].href).toBe('/league/a%22b/2026/');
  });

  // The catch-all page knows its root from the `<base>` its bootstrap wrote,
  // because the path it was served for names nothing reliable.
  it('builds its links from an explicit root when the page has one', () => {
    const nav = buildNav(ONE_LEAGUE, '/typo/', '/');

    expect(nav.brandHref).toBe('/');
    expect(nav.years[0].href).toBe('/league/movieboyz/2027/');
    expect(nav.movies.href).toBe('/movies/');
  });

  it('carries the Pages project path into every link', () => {
    const nav = buildNav(ONE_LEAGUE, '/movieboyz-web/league/movieboyz/2026/');

    expect(nav.brandHref).toBe('/movieboyz-web/');
    expect(nav.years[1].href).toBe('/movieboyz-web/league/movieboyz/2026/');
    expect(nav.movies.href).toBe('/movieboyz-web/movies/');
  });

  it('marks the Campaign the reader is already on', () => {
    const nav = buildNav(ONE_LEAGUE, CAMPAIGN_PATH);

    expect(nav.years.filter((entry) => entry.current).map((entry) => entry.year)).toEqual([2026]);
    expect(nav.movies.current).toBe(false);
  });

  // A year reachable by path that the Manifest does not list, which is what the
  // catch-all page renders under. It is nobody's entry, so nothing is marked.
  it('marks nothing when the path names a year the Manifest does not list', () => {
    const nav = buildNav(ONE_LEAGUE, '/league/movieboyz/2028/');

    expect(nav.years.some((entry) => entry.current)).toBe(false);
  });

  // A Campaign's draft page keeps that Campaign's year marked, because the year
  // is the entry that leads to both pages and the draft is reached from the
  // Campaign rather than from the menu (#83, #85). It works because
  // `campaignFromPath` ignores the segment after the year; `route.test.js` pins
  // that, and this pins what depends on it.
  it('marks the year the reader is on the draft page of', () => {
    const nav = buildNav(ONE_LEAGUE, '/league/movieboyz/2026/draft/');

    expect(nav.years.filter((entry) => entry.current).map((entry) => entry.year)).toEqual([2026]);
    expect(nav.movies.current).toBe(false);
  });

  it('leaves the League landing unmarked on a draft page, as on a Campaign page', () => {
    const nav = buildNav(ONE_LEAGUE, '/league/movieboyz/2026/draft/');

    expect(nav.league.landing).toBe(false);
  });

  // The League landing entry (#67). With one League published it sits at the
  // top level beside that League's years, because there is no menu to put it
  // in and the League is the thing the years belong to.
  describe('the League landing entry', () => {
    it('names the League and links its landing page', () => {
      const nav = buildNav(ONE_LEAGUE, CAMPAIGN_PATH);

      expect(nav.league.name).toBe('MovieBoyz');
      expect(nav.league.href).toBe('/league/movieboyz/');
    });

    // Two entries marked at once would say the reader is in two places. The
    // year is where they are; the League is where the year is.
    it('is unmarked on a Campaign page, where the year is marked instead', () => {
      const nav = buildNav(ONE_LEAGUE, CAMPAIGN_PATH);

      expect(nav.league.landing).toBe(false);
      expect(nav.years.filter((entry) => entry.current).map((entry) => entry.year)).toEqual([2026]);
    });

    it('is marked on the landing page, where no year is', () => {
      const nav = buildNav(ONE_LEAGUE, LANDING_PATH);

      expect(nav.league.landing).toBe(true);
      expect(nav.years.some((entry) => entry.current)).toBe(false);
      expect(nav.movies.current).toBe(false);
    });

    it('carries the Pages project path into the landing link', () => {
      const nav = buildNav(ONE_LEAGUE, '/movieboyz-web/league/movieboyz/');

      expect(nav.league.href).toBe('/movieboyz-web/league/movieboyz/');
      expect(nav.league.landing).toBe(true);
    });

    it('escapes a League slug before it reaches the landing link', () => {
      const nav = buildNav(
        { leagues: [{ slug: 'a"b', name: 'Odd', campaigns: [] }] },
        CAMPAIGN_PATH,
      );

      expect(nav.league.href).toBe('/league/a%22b/');
    });

    it('is absent when no League is published', () => {
      expect(buildNav({ leagues: [] }, MOVIES_PATH).league).toBeNull();
      expect(buildNav(null, MOVIES_PATH).league).toBeNull();
    });
  });

  it('links the Movies lookup and marks it when the reader is there', () => {
    const nav = buildNav(ONE_LEAGUE, MOVIES_PATH);

    expect(nav.movies.href).toBe('/movies/');
    expect(nav.movies.current).toBe(true);
    expect(nav.years.some((entry) => entry.current)).toBe(false);
  });

  // The acceptance criterion the ticket asks to be covered by a test rather
  // than by inspection: a second published League turns the years into a League
  // menu, and no code changes for it.
  describe('when the Manifest carries a second League', () => {
    it('renders a League menu instead of top-level years', () => {
      const nav = buildNav(TWO_LEAGUES, CAMPAIGN_PATH);

      expect(nav.mode).toBe('leagues');
      expect(nav.years).toEqual([]);
      expect(nav.leagues.map((league) => league.name)).toEqual(['MovieBoyz', 'Film Fellas']);
    });

    it('keeps each League’s years under it, newest first', () => {
      const nav = buildNav(TWO_LEAGUES, CAMPAIGN_PATH);

      expect(nav.leagues[0].years.map((entry) => entry.year)).toEqual([2027, 2026, 2025]);
      expect(nav.leagues[0].years[0].href).toBe('/league/movieboyz/2027/');
      expect(nav.leagues[1].years.map((entry) => entry.href)).toEqual([
        '/league/filmfellas/2026/',
      ]);
    });

    it('marks the League the reader is inside and the year within it', () => {
      const nav = buildNav(TWO_LEAGUES, CAMPAIGN_PATH);

      expect(nav.leagues.map((league) => league.current)).toEqual([true, false]);
      expect(nav.leagues[0].years.filter((entry) => entry.current).map((e) => e.year)).toEqual([
        2026,
      ]);
      expect(nav.leagues[1].years.some((entry) => entry.current)).toBe(false);
    });

    // With a menu to put it in, each League's landing sits inside that League's
    // own menu rather than at the top level, where two of them would compete
    // with the years for the same bar.
    it('keeps each League’s landing under it', () => {
      const nav = buildNav(TWO_LEAGUES, CAMPAIGN_PATH);

      expect(nav.league).toBeNull();
      expect(nav.leagues.map((league) => league.href)).toEqual([
        '/league/movieboyz/',
        '/league/filmfellas/',
      ]);
    });

    it('marks the League the reader is on the landing page of', () => {
      const nav = buildNav(TWO_LEAGUES, LANDING_PATH);

      expect(nav.leagues.map((league) => league.current)).toEqual([true, false]);
      expect(nav.leagues.map((league) => league.landing)).toEqual([true, false]);
      expect(nav.leagues[0].years.some((entry) => entry.current)).toBe(false);
    });

    // A Campaign puts the reader inside the League without putting them on its
    // landing page, so the menu is marked and the entry inside it is not.
    it('marks the League but not its landing from a Campaign page', () => {
      const nav = buildNav(TWO_LEAGUES, CAMPAIGN_PATH);

      expect(nav.leagues[0].current).toBe(true);
      expect(nav.leagues[0].landing).toBe(false);
    });

    it('marks no League when the reader is on the Movies page', () => {
      const nav = buildNav(TWO_LEAGUES, MOVIES_PATH);

      expect(nav.leagues.some((league) => league.current)).toBe(false);
      expect(nav.movies.current).toBe(true);
    });
  });

  // Before the platform has published anything, and on the failure path where
  // the Manifest itself did not load. The navigation is still the thing that
  // stops a page being a dead end, so it renders what it has.
  it('still offers the Movies lookup when no League is published', () => {
    const nav = buildNav({ leagues: [] }, MOVIES_PATH);

    expect(nav.mode).toBe('years');
    expect(nav.years).toEqual([]);
    expect(nav.movies.href).toBe('/movies/');
  });

  it('survives a Manifest that did not load at all', () => {
    const nav = buildNav(null, MOVIES_PATH);

    expect(nav.years).toEqual([]);
    expect(nav.leagues).toEqual([]);
    expect(nav.movies.href).toBe('/movies/');
  });

  it('lists a League that has run no Campaign yet', () => {
    const manifest = {
      leagues: [TWO_LEAGUES.leagues[0], { slug: 'newboyz', name: 'New Boyz' }],
    };
    const nav = buildNav(manifest, CAMPAIGN_PATH);

    expect(nav.leagues[1].years).toEqual([]);
  });
});
