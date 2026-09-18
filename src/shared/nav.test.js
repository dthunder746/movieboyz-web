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

// Ten is the top of the range the league expects to publish, and the bar it
// renders is the thing the ticket is about (#157).
const TEN_LEAGUES = {
  leagues: [
    ONE_LEAGUE.leagues[0],
    ...Array.from({ length: 9 }, (unused, index) => ({
      slug: `league-${index}`,
      name: `League ${index}`,
      campaigns: [{ year: 2026, state: 'active' }],
    })),
  ],
};

const CAMPAIGN_PATH = '/league/movieboyz/2026/';
const LANDING_PATH = '/league/movieboyz/';
const OTHER_CAMPAIGN_PATH = '/league/filmfellas/2026/';
const MOVIES_PATH = '/movies/';

// The entries the bar renders, in order. The count is the ticket's own
// acceptance criterion and it is read off the view model rather than off the
// markup, because the view model is the half with tests beside it.
function barEntries(nav) {
  return [
    ...(nav.leagues ? ['Leagues'] : []),
    ...(nav.league ? [nav.league.name] : []),
    'Movies',
  ];
}

// Everything the bar marks as where the reader is. The Leagues toggle is never
// one of them, and neither is the current League's toggle: that is highlighted
// as the menu the marked entry hangs under, which is a different job.
function marked(nav) {
  return [
    ...(nav.league?.landing ? ['Overview'] : []),
    ...(nav.league?.years ?? []).filter((year) => year.current).map((year) => year.label),
    ...(nav.movies.current ? ['Movies'] : []),
  ];
}

describe('buildNav', () => {
  // Decision 20 of the parent spec (#58), as amended by #157. One published
  // League means no Leagues menu, because a menu with a single entry is a click
  // that answers nothing. The League's own years live in its own menu either
  // way, so the one League bar and the several League bar read the same.
  it('gives the one League its own menu and no Leagues menu', () => {
    const nav = buildNav(ONE_LEAGUE, CAMPAIGN_PATH);

    expect(nav.leagues).toBeNull();
    expect(nav.league.name).toBe('MovieBoyz');
    expect(nav.league.years.map((entry) => entry.year)).toEqual([2027, 2026, 2025]);
    expect(barEntries(nav)).toEqual(['MovieBoyz', 'Movies']);
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

    expect(buildNav(jumbled, CAMPAIGN_PATH).league.years.map((entry) => entry.year)).toEqual([
      2027, 2026, 2025,
    ]);
  });

  // Each year is badged with its Lifecycle state, so a drafting year reads
  // differently from an active one and from a final one before anybody clicks.
  it('carries each year’s Lifecycle state and its label', () => {
    const nav = buildNav(ONE_LEAGUE, CAMPAIGN_PATH);

    expect(nav.league.years.map((entry) => [entry.state, entry.stateLabel])).toEqual([
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

    expect(buildNav(manifest, CAMPAIGN_PATH).league.years[0].stateLabel).toBe('settling');
  });

  it('links each year at its own Campaign path', () => {
    const nav = buildNav(ONE_LEAGUE, CAMPAIGN_PATH);

    expect(nav.league.years.map((entry) => entry.href)).toEqual([
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
      '/league/a"b/2026/',
    );

    expect(nav.league.years[0].href).not.toContain('"');
    expect(nav.league.years[0].href).toBe('/league/a%22b/2026/');
  });

  // The catch-all page knows its root from the `<base>` its bootstrap wrote,
  // because the path it was served for names nothing reliable.
  it('builds its links from an explicit root when the page has one', () => {
    const nav = buildNav(ONE_LEAGUE, '/typo/', '/');

    expect(nav.brandHref).toBe('/');
    expect(nav.movies.href).toBe('/movies/');
  });

  it('carries the Pages project path into every link', () => {
    const nav = buildNav(ONE_LEAGUE, '/movieboyz-web/league/movieboyz/2026/');

    expect(nav.brandHref).toBe('/movieboyz-web/');
    expect(nav.league.years[1].href).toBe('/movieboyz-web/league/movieboyz/2026/');
    expect(nav.movies.href).toBe('/movieboyz-web/movies/');
  });

  it('marks the Campaign the reader is already on', () => {
    const nav = buildNav(ONE_LEAGUE, CAMPAIGN_PATH);

    expect(marked(nav)).toEqual(['2026']);
  });

  // A year reachable by path that the Manifest does not list, which is what the
  // catch-all page renders under. It is nobody's entry, so nothing is marked.
  it('marks nothing when the path names a year the Manifest does not list', () => {
    const nav = buildNav(ONE_LEAGUE, '/league/movieboyz/2028/');

    expect(marked(nav)).toEqual([]);
  });

  // A Campaign's draft page keeps that Campaign's year marked, because the year
  // is the entry that leads to both pages and the draft is reached from the
  // Campaign rather than from the menu (#83, #85). It works because
  // `campaignFromPath` ignores the segment after the year; `route.test.js` pins
  // that, and this pins what depends on it.
  it('marks the year the reader is on the draft page of', () => {
    const nav = buildNav(ONE_LEAGUE, '/league/movieboyz/2026/draft/');

    expect(marked(nav)).toEqual(['2026']);
    expect(nav.league.current).toBe(true);
  });

  it('leaves Overview unmarked on a draft page, as on a Campaign page', () => {
    const nav = buildNav(ONE_LEAGUE, '/league/movieboyz/2026/draft/');

    expect(nav.league.landing).toBe(false);
  });

  // The League entry (#67, reshaped by #157). It is the League the reader is
  // inside, whichever address took them there, and it is the only League that
  // gets an entry in the bar.
  describe('the League the reader is inside', () => {
    it('names the League and links its landing page', () => {
      const nav = buildNav(ONE_LEAGUE, CAMPAIGN_PATH);

      expect(nav.league.name).toBe('MovieBoyz');
      expect(nav.league.href).toBe('/league/movieboyz/');
    });

    // Two entries marked at once would say the reader is in two places. The
    // year is where they are; the League is where the year is, which is why its
    // toggle is highlighted rather than marked.
    it('leaves Overview unmarked on a Campaign page, where the year is marked instead', () => {
      const nav = buildNav(ONE_LEAGUE, CAMPAIGN_PATH);

      expect(nav.league.landing).toBe(false);
      expect(nav.league.current).toBe(true);
      expect(marked(nav)).toEqual(['2026']);
    });

    it('marks Overview on the landing page, where no year is', () => {
      const nav = buildNav(ONE_LEAGUE, LANDING_PATH);

      expect(nav.league.landing).toBe(true);
      expect(marked(nav)).toEqual(['Overview']);
    });

    it('carries the Pages project path into the landing link', () => {
      const nav = buildNav(ONE_LEAGUE, '/movieboyz-web/league/movieboyz/');

      expect(nav.league.href).toBe('/movieboyz-web/league/movieboyz/');
      expect(nav.league.landing).toBe(true);
    });

    it('escapes a League slug before it reaches the landing link', () => {
      const nav = buildNav(
        { leagues: [{ slug: 'a"b', name: 'Odd', campaigns: [] }] },
        '/league/a"b/',
      );

      expect(nav.league.href).toBe('/league/a%22b/');
    });

    // The Movies page names no League, so no League is the reader's, and with
    // one published League there is no Leagues menu either. The bar is Movies
    // alone rather than a menu for a League the reader is not in.
    it('is absent on the Movies page, leaving the one League bar as Movies alone', () => {
      const nav = buildNav(ONE_LEAGUE, MOVIES_PATH);

      expect(nav.league).toBeNull();
      expect(nav.leagues).toBeNull();
      expect(barEntries(nav)).toEqual(['Movies']);
      expect(marked(nav)).toEqual(['Movies']);
    });

    it('is absent at the site root, which names no League either', () => {
      expect(buildNav(ONE_LEAGUE, '/').league).toBeNull();
    });

    it('is absent when no League is published', () => {
      expect(buildNav({ leagues: [] }, MOVIES_PATH).league).toBeNull();
      expect(buildNav(null, MOVIES_PATH).league).toBeNull();
    });

    // A path can name a League the Manifest has never heard of, which is what
    // the catch-all page renders under. It is nobody's League, so the bar
    // carries no League entry for it.
    it('is absent when the path names a League the Manifest does not list', () => {
      expect(buildNav(ONE_LEAGUE, '/league/ghostboyz/').league).toBeNull();
      expect(buildNav(TWO_LEAGUES, '/league/ghostboyz/2026/').league).toBeNull();
    });
  });

  it('links the Movies lookup and marks it when the reader is there', () => {
    const nav = buildNav(ONE_LEAGUE, MOVIES_PATH);

    expect(nav.movies.href).toBe('/movies/');
    expect(nav.movies.current).toBe(true);
  });

  // The acceptance criterion the ticket asks to be covered by a test rather
  // than by inspection: publishing a second League adds the Leagues menu, and
  // nothing in this file changes for it. Every test below reads a Manifest and
  // nothing else.
  describe('when the Manifest carries a second League, with no code change', () => {
    it('leads the bar with a Leagues menu and keeps it to three entries', () => {
      const nav = buildNav(TWO_LEAGUES, CAMPAIGN_PATH);

      expect(barEntries(nav)).toEqual(['Leagues', 'MovieBoyz', 'Movies']);
    });

    it('lists every published League by name in Manifest order', () => {
      const nav = buildNav(TWO_LEAGUES, CAMPAIGN_PATH);

      expect(nav.leagues.items.map((league) => league.name)).toEqual(['MovieBoyz', 'Film Fellas']);
      expect(nav.leagues.items.map((league) => league.href)).toEqual([
        '/league/movieboyz/',
        '/league/filmfellas/',
      ]);
    });

    // The site root is already the directory of every League and year (#81,
    // #84), so the menu ends by pointing at it rather than repeating it.
    it('ends the menu with a Show all link to the site root', () => {
      expect(buildNav(TWO_LEAGUES, CAMPAIGN_PATH).leagues.showAllHref).toBe('/');
      expect(
        buildNav(TWO_LEAGUES, '/movieboyz-web/league/movieboyz/2026/').leagues.showAllHref,
      ).toBe('/movieboyz-web/');
    });

    it('shows the League the reader is inside in bold and no other', () => {
      const nav = buildNav(TWO_LEAGUES, CAMPAIGN_PATH);

      expect(nav.leagues.items.map((league) => league.current)).toEqual([true, false]);
    });

    // The Leagues toggle leads to every League and is where none of them is, so
    // it is never the entry marked as where the reader is.
    it('never marks the Leagues toggle itself', () => {
      for (const path of [CAMPAIGN_PATH, LANDING_PATH, MOVIES_PATH, '/']) {
        expect(buildNav(TWO_LEAGUES, path).leagues.current).toBeUndefined();
      }
    });

    it('keeps the reader’s League as the second entry, with its own years', () => {
      const nav = buildNav(TWO_LEAGUES, CAMPAIGN_PATH);

      expect(nav.league.slug).toBe('movieboyz');
      expect(nav.league.years.map((entry) => entry.year)).toEqual([2027, 2026, 2025]);
      expect(marked(nav)).toEqual(['2026']);
    });

    // The second League is reached the same way the first is, which is the
    // point: the bar is read off the path and the Manifest, not off a position.
    it('follows the reader into a Campaign of the second League', () => {
      const nav = buildNav(TWO_LEAGUES, OTHER_CAMPAIGN_PATH);

      expect(barEntries(nav)).toEqual(['Leagues', 'Film Fellas', 'Movies']);
      expect(nav.leagues.items.map((league) => league.current)).toEqual([false, true]);
      expect(nav.league.years.map((entry) => entry.href)).toEqual(['/league/filmfellas/2026/']);
      expect(marked(nav)).toEqual(['2026']);
    });

    it('marks Overview on the landing page of the League the reader is inside', () => {
      const nav = buildNav(TWO_LEAGUES, LANDING_PATH);

      expect(nav.league.slug).toBe('movieboyz');
      expect(nav.league.landing).toBe(true);
      expect(marked(nav)).toEqual(['Overview']);
    });

    // On the Movies page no League is the reader's, so the bar is the Leagues
    // menu and Movies, which is how they get back into a League from there.
    it('drops the League entry on the Movies page', () => {
      const nav = buildNav(TWO_LEAGUES, MOVIES_PATH);

      expect(barEntries(nav)).toEqual(['Leagues', 'Movies']);
      expect(nav.league).toBeNull();
      expect(nav.leagues.items.some((league) => league.current)).toBe(false);
      expect(marked(nav)).toEqual(['Movies']);
    });

    it('drops the League entry at the site root', () => {
      const nav = buildNav(TWO_LEAGUES, '/');

      expect(barEntries(nav)).toEqual(['Leagues', 'Movies']);
      expect(marked(nav)).toEqual([]);
    });

    it('lists a League that has run no Campaign yet', () => {
      const manifest = {
        leagues: [TWO_LEAGUES.leagues[0], { slug: 'newboyz', name: 'New Boyz' }],
      };
      const nav = buildNav(manifest, '/league/newboyz/');

      expect(nav.leagues.items.map((league) => league.name)).toEqual(['MovieBoyz', 'New Boyz']);
      expect(nav.league.years).toEqual([]);
      expect(marked(nav)).toEqual(['Overview']);
    });
  });

  // The whole of the ticket in one test: the bar is the same width whatever the
  // Manifest holds, because the Leagues count lives inside a menu rather than
  // in the bar (#157).
  describe('when the Manifest carries ten Leagues', () => {
    it('renders the same bar as two do', () => {
      const ten = buildNav(TEN_LEAGUES, CAMPAIGN_PATH);
      const two = buildNav(TWO_LEAGUES, CAMPAIGN_PATH);

      expect(barEntries(ten)).toEqual(barEntries(two));
      expect(barEntries(ten)).toEqual(['Leagues', 'MovieBoyz', 'Movies']);
    });

    it('holds all ten inside the Leagues menu, in Manifest order', () => {
      const nav = buildNav(TEN_LEAGUES, CAMPAIGN_PATH);

      expect(nav.leagues.items).toHaveLength(10);
      expect(nav.leagues.items.map((league) => league.slug)).toEqual(
        TEN_LEAGUES.leagues.map((league) => league.slug),
      );
    });

    it('still marks exactly one entry', () => {
      expect(marked(buildNav(TEN_LEAGUES, CAMPAIGN_PATH))).toEqual(['2026']);
      expect(marked(buildNav(TEN_LEAGUES, LANDING_PATH))).toEqual(['Overview']);
      expect(marked(buildNav(TEN_LEAGUES, MOVIES_PATH))).toEqual(['Movies']);
    });
  });

  // Before the platform has published anything, and on the failure path where
  // the Manifest itself did not load. The navigation is still the thing that
  // stops a page being a dead end, so it renders what it has.
  it('still offers the Movies lookup when no League is published', () => {
    const nav = buildNav({ leagues: [] }, MOVIES_PATH);

    expect(nav.leagues).toBeNull();
    expect(nav.league).toBeNull();
    expect(nav.movies.href).toBe('/movies/');
  });

  it('survives a Manifest that did not load at all', () => {
    const nav = buildNav(null, MOVIES_PATH);

    expect(nav.leagues).toBeNull();
    expect(nav.league).toBeNull();
    expect(nav.movies.href).toBe('/movies/');
  });
});
