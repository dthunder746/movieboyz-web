import { describe, expect, it } from 'vitest';

import { buildCompactMenu, buildNav } from './nav.js';

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

const THREE_LEAGUES = {
  leagues: [
    ...TWO_LEAGUES.leagues,
    { slug: 'reelboyz', name: 'Reel Boyz', campaigns: [{ year: 2026, state: 'drafting' }] },
  ],
};

// Ten is the top of the range the league expects to publish, and the bar it
// renders is the thing the ticket is about (#170).
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
const DRAFT_PATH = '/league/movieboyz/2026/draft/';
const LANDING_PATH = '/league/movieboyz/';
const OTHER_CAMPAIGN_PATH = '/league/filmfellas/2026/';
const MOVIES_PATH = '/movies/';

// The bar as the reader reads it, left to right. `entries` is the view model's
// own answer rather than a copy of it assembled here, so the two entry bar and
// its order are pinned where `mountNav` reads them.
function bar(nav) {
  return nav.entries.map((entry) => entry.label);
}

// The rows of the menu's first level: every published League, by name.
function firstLevel(nav) {
  return (nav.leagues?.items ?? []).map((league) => league.name);
}

// The rows of one League's second level, in the order they are drawn.
function secondLevel(nav, slug) {
  const league = nav.leagues.items.find((entry) => entry.slug === slug);
  return ['Overview', ...league.years.map((year) => year.label)];
}

// The first level row that says which League the reader is inside. It is the
// level one mark, and there is never more than one of it.
function insideRows(nav) {
  return (nav.leagues?.items ?? []).filter((league) => league.inside).map((league) => league.name);
}

// Every second level row marked as the page the reader is on, across every
// League. Exactly one of these exists in any reading, or none where the path
// names no page the menu lists.
function markedRows(nav) {
  const rows = [];

  for (const league of nav.leagues?.items ?? []) {
    if (league.overviewCurrent) rows.push('Overview');
    for (const year of league.years) if (year.current) rows.push(year.label);
  }
  if (nav.movies.current) rows.push('Movies');

  return rows;
}

describe('buildNav', () => {
  // Decision 20 of the parent spec (#58), as amended by #168. The bar holds
  // Leagues and Movies and nothing else, however many Leagues are published:
  // the count lives two levels inside the menu rather than in the bar, so the
  // bar is the same width at one League and at ten.
  describe('the entries the bar renders', () => {
    it('holds Leagues and Movies only, at one League', () => {
      expect(bar(buildNav(ONE_LEAGUE, CAMPAIGN_PATH))).toEqual(['Leagues', 'Movies']);
    });

    it('holds Leagues and Movies only, at three Leagues', () => {
      expect(bar(buildNav(THREE_LEAGUES, CAMPAIGN_PATH))).toEqual(['Leagues', 'Movies']);
    });

    it('holds Leagues and Movies only, at ten Leagues', () => {
      expect(bar(buildNav(TEN_LEAGUES, CAMPAIGN_PATH))).toEqual(['Leagues', 'Movies']);
    });

    it('reads the same on every page, whatever the Manifest holds', () => {
      for (const manifest of [ONE_LEAGUE, THREE_LEAGUES, TEN_LEAGUES]) {
        for (const path of [CAMPAIGN_PATH, DRAFT_PATH, LANDING_PATH, MOVIES_PATH, '/']) {
          expect(bar(buildNav(manifest, path))).toEqual(['Leagues', 'Movies']);
        }
      }
    });

    it('names each entry by kind and by the label it carries', () => {
      expect(buildNav(TWO_LEAGUES, CAMPAIGN_PATH).entries).toEqual([
        { kind: 'leagues', label: 'Leagues', current: true },
        { kind: 'movies', label: 'Movies', current: false },
      ]);
    });

    // Nothing published is no menu to open, so the lookup is the whole bar.
    it('drops the Leagues entry when nothing is published', () => {
      expect(bar(buildNav({ leagues: [] }, MOVIES_PATH))).toEqual(['Movies']);
      expect(bar(buildNav(null, MOVIES_PATH))).toEqual(['Movies']);
    });
  });

  // The first level of the menu: every published League, in the order the
  // Manifest lists them, at every count. The League name is not a link here,
  // so the view model gives the row no `href` of its own; the second level's
  // Overview row is where the landing page is reached.
  describe('the first level of the menu', () => {
    it('lists every published League by name in Manifest order', () => {
      expect(firstLevel(buildNav(THREE_LEAGUES, CAMPAIGN_PATH))).toEqual([
        'MovieBoyz',
        'Film Fellas',
        'Reel Boyz',
      ]);
    });

    it('holds all ten in Manifest order at ten Leagues', () => {
      const nav = buildNav(TEN_LEAGUES, CAMPAIGN_PATH);

      expect(nav.leagues.items).toHaveLength(10);
      expect(nav.leagues.items.map((league) => league.slug)).toEqual(
        TEN_LEAGUES.leagues.map((league) => league.slug),
      );
    });

    // One League is a first level of a single row. Accepted: the shape is the
    // same at one and at ten, which is the whole of what #168 settled.
    it('is a single row while one League is published', () => {
      expect(firstLevel(buildNav(ONE_LEAGUE, MOVIES_PATH))).toEqual(['MovieBoyz']);
    });

    it('is absent when no League is published', () => {
      expect(buildNav({ leagues: [] }, MOVIES_PATH).leagues).toBeNull();
      expect(buildNav(null, MOVIES_PATH).leagues).toBeNull();
    });

    it('lists a League that has run no Campaign yet', () => {
      const manifest = {
        leagues: [TWO_LEAGUES.leagues[0], { slug: 'newboyz', name: 'New Boyz' }],
      };
      const nav = buildNav(manifest, '/league/newboyz/');

      expect(firstLevel(nav)).toEqual(['MovieBoyz', 'New Boyz']);
      expect(secondLevel(nav, 'newboyz')).toEqual(['Overview']);
    });
  });

  // The second level, which opens in place off a League row: Overview, then one
  // row per year newest first, the year alone linking to the Campaign page
  // (#83).
  describe('the second level of a League', () => {
    it('leads with Overview and then the years, newest first', () => {
      expect(secondLevel(buildNav(ONE_LEAGUE, CAMPAIGN_PATH), 'movieboyz')).toEqual([
        'Overview',
        '2027',
        '2026',
        '2025',
      ]);
    });

    it('reads the years newest first whatever order the Manifest wrote them', () => {
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

      expect(secondLevel(buildNav(jumbled, CAMPAIGN_PATH), 'movieboyz')).toEqual([
        'Overview',
        '2027',
        '2026',
        '2025',
      ]);
    });

    it('gives every League an Overview link to its own landing page', () => {
      const nav = buildNav(TWO_LEAGUES, MOVIES_PATH);

      expect(nav.leagues.items.map((league) => league.href)).toEqual([
        '/league/movieboyz/',
        '/league/filmfellas/',
      ]);
    });

    it('links each year at its own Campaign path', () => {
      const nav = buildNav(ONE_LEAGUE, CAMPAIGN_PATH);

      expect(nav.leagues.items[0].years.map((year) => year.href)).toEqual([
        '/league/movieboyz/2027/',
        '/league/movieboyz/2026/',
        '/league/movieboyz/2025/',
      ]);
    });

    // Every League's years are built, not just the reader's, because the menu
    // opens any of them without going anywhere first.
    it('builds the years of a League the reader is not inside', () => {
      const nav = buildNav(TWO_LEAGUES, CAMPAIGN_PATH);

      expect(secondLevel(nav, 'filmfellas')).toEqual(['Overview', '2026']);
      expect(nav.leagues.items[1].years[0].href).toBe('/league/filmfellas/2026/');
    });

    // Each year is badged with its Lifecycle state, so a drafting year reads
    // differently from an active one and from a final one before anybody clicks.
    it('carries each year’s Lifecycle state and its label', () => {
      const nav = buildNav(ONE_LEAGUE, CAMPAIGN_PATH);

      expect(nav.leagues.items[0].years.map((year) => [year.state, year.stateLabel])).toEqual([
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

      expect(buildNav(manifest, CAMPAIGN_PATH).leagues.items[0].years[0].stateLabel).toBe(
        'settling',
      );
    });

    it('falls back to the slug when the Manifest names no League', () => {
      const manifest = { leagues: [{ slug: 'movieboyz', campaigns: [] }] };

      expect(firstLevel(buildNav(manifest, MOVIES_PATH))).toEqual(['movieboyz']);
    });
  });

  // Every link is written from the site root, so the same build serves from the
  // domain apex and from the Pages project path that prefixes everything.
  describe('the links it writes', () => {
    it('escapes a League slug before it reaches a link', () => {
      const nav = buildNav(
        { leagues: [{ slug: 'a"b', name: 'Odd', campaigns: [{ year: 2026, state: 'active' }] }] },
        '/league/a"b/2026/',
      );

      expect(nav.leagues.items[0].href).toBe('/league/a%22b/');
      expect(nav.leagues.items[0].years[0].href).toBe('/league/a%22b/2026/');
    });

    // The catch-all page knows its root from the `<base>` its bootstrap wrote,
    // because the path it was served for names nothing reliable.
    it('builds its links from an explicit root when the page has one', () => {
      const nav = buildNav(ONE_LEAGUE, '/typo/', '/');

      expect(nav.brandHref).toBe('/');
      expect(nav.leagues.items[0].years[0].href).toBe('/league/movieboyz/2027/');
      expect(nav.movies.href).toBe('/movies/');
    });

    it('carries the Pages project path into every link', () => {
      const nav = buildNav(ONE_LEAGUE, '/movieboyz-web/league/movieboyz/2026/');

      expect(nav.brandHref).toBe('/movieboyz-web/');
      expect(nav.leagues.items[0].href).toBe('/movieboyz-web/league/movieboyz/');
      expect(nav.leagues.items[0].years[1].href).toBe('/movieboyz-web/league/movieboyz/2026/');
      expect(nav.movies.href).toBe('/movieboyz-web/movies/');
    });

    it('links the Movies lookup and marks it when the reader is there', () => {
      const nav = buildNav(ONE_LEAGUE, MOVIES_PATH);

      expect(nav.movies.href).toBe('/movies/');
      expect(nav.movies.current).toBe(true);
    });
  });

  // Where the reader is told they are. The Leagues toggle carries the bar's
  // highlight anywhere inside a League; inside the menu the League row is
  // marked at level one and the page row at level two.
  describe('marking where the reader is', () => {
    it('highlights the Leagues toggle anywhere inside a League', () => {
      for (const path of [CAMPAIGN_PATH, DRAFT_PATH, LANDING_PATH, OTHER_CAMPAIGN_PATH]) {
        expect(buildNav(TWO_LEAGUES, path).entries[0]).toEqual({
          kind: 'leagues',
          label: 'Leagues',
          current: true,
        });
      }
    });

    it('highlights nothing but Movies on the Movies page', () => {
      const nav = buildNav(TWO_LEAGUES, MOVIES_PATH);

      expect(nav.entries.map((entry) => entry.current)).toEqual([false, true]);
      expect(insideRows(nav)).toEqual([]);
      expect(markedRows(nav)).toEqual(['Movies']);
    });

    it('highlights nothing at all at the site root', () => {
      const nav = buildNav(TWO_LEAGUES, '/');

      expect(nav.entries.map((entry) => entry.current)).toEqual([false, false]);
      expect(insideRows(nav)).toEqual([]);
      expect(markedRows(nav)).toEqual([]);
    });

    it('marks the one League row the reader is inside, and no other', () => {
      expect(insideRows(buildNav(TEN_LEAGUES, CAMPAIGN_PATH))).toEqual(['MovieBoyz']);
      expect(insideRows(buildNav(TWO_LEAGUES, OTHER_CAMPAIGN_PATH))).toEqual(['Film Fellas']);
      expect(insideRows(buildNav(TWO_LEAGUES, LANDING_PATH))).toEqual(['MovieBoyz']);
    });

    it('marks exactly one page row per reading', () => {
      expect(markedRows(buildNav(TEN_LEAGUES, CAMPAIGN_PATH))).toEqual(['2026']);
      expect(markedRows(buildNav(TEN_LEAGUES, LANDING_PATH))).toEqual(['Overview']);
      expect(markedRows(buildNav(TEN_LEAGUES, MOVIES_PATH))).toEqual(['Movies']);
    });

    // A Campaign marks its year rather than its League's Overview, so exactly
    // one page row is ever marked.
    it('leaves Overview unmarked on a Campaign page, where the year is marked', () => {
      const nav = buildNav(ONE_LEAGUE, CAMPAIGN_PATH);

      expect(nav.leagues.items[0].overviewCurrent).toBe(false);
      expect(markedRows(nav)).toEqual(['2026']);
    });

    // A Campaign's draft page keeps that Campaign's year marked, because the
    // year is the row that leads to both pages and the draft is reached from
    // the Campaign rather than from the menu (#83, #85).
    it('marks the year the reader is on the draft page of', () => {
      const nav = buildNav(ONE_LEAGUE, DRAFT_PATH);

      expect(markedRows(nav)).toEqual(['2026']);
      expect(insideRows(nav)).toEqual(['MovieBoyz']);
      expect(nav.leagues.items[0].overviewCurrent).toBe(false);
    });

    // A path can name a year, or a League, the Manifest has never heard of,
    // which is what the catch-all page renders under. It is nobody's row.
    it('marks nothing when the path names a year the Manifest does not list', () => {
      const nav = buildNav(ONE_LEAGUE, '/league/movieboyz/2028/');

      expect(markedRows(nav)).toEqual([]);
      expect(insideRows(nav)).toEqual(['MovieBoyz']);
    });

    it('marks nothing when the path names a League the Manifest does not list', () => {
      const nav = buildNav(TWO_LEAGUES, '/league/ghostboyz/2026/');

      expect(insideRows(nav)).toEqual([]);
      expect(markedRows(nav)).toEqual([]);
      expect(nav.entries[0].current).toBe(false);
    });

    // Two Leagues can hold the same year, and only the reader's is marked.
    it('marks the year of the reader’s League and not the same year elsewhere', () => {
      const nav = buildNav(TWO_LEAGUES, OTHER_CAMPAIGN_PATH);

      expect(markedRows(nav)).toEqual(['2026']);
      expect(nav.leagues.items[0].years.some((year) => year.current)).toBe(false);
      expect(nav.leagues.items[1].years[0].current).toBe(true);
    });
  });

  // The acceptance criterion the ticket asks to be covered by a test rather
  // than by inspection: publishing a second League changes the menu, and
  // nothing in this file changes for it. Every test here reads a Manifest and
  // nothing else.
  describe('when the Manifest carries a second League, with no code change', () => {
    it('adds its row to the first level and leaves the bar alone', () => {
      const one = buildNav(ONE_LEAGUE, CAMPAIGN_PATH);
      const two = buildNav(TWO_LEAGUES, CAMPAIGN_PATH);

      expect(bar(two)).toEqual(bar(one));
      expect(firstLevel(one)).toEqual(['MovieBoyz']);
      expect(firstLevel(two)).toEqual(['MovieBoyz', 'Film Fellas']);
    });

    it('follows the reader into a Campaign of the second League', () => {
      const nav = buildNav(TWO_LEAGUES, OTHER_CAMPAIGN_PATH);

      expect(bar(nav)).toEqual(['Leagues', 'Movies']);
      expect(insideRows(nav)).toEqual(['Film Fellas']);
      expect(secondLevel(nav, 'filmfellas')).toEqual(['Overview', '2026']);
      expect(markedRows(nav)).toEqual(['2026']);
    });
  });

  // Before the platform has published anything, and on the failure path where
  // the Manifest itself did not load. The navigation is still the thing that
  // stops a page being a dead end, so it renders what it has.
  it('still offers the Movies lookup when no League is published', () => {
    const nav = buildNav({ leagues: [] }, MOVIES_PATH);

    expect(nav.leagues).toBeNull();
    expect(nav.movies.href).toBe('/movies/');
  });

  it('survives a Manifest that did not load at all', () => {
    const nav = buildNav(null, MOVIES_PATH);

    expect(nav.leagues).toBeNull();
    expect(nav.movies.href).toBe('/movies/');
  });
});

// Below 992px the bar is one button (#165) and the same cascade lives inside
// the overlay it opens, with the second level inline and indented rather than
// off to the right. It is a reading of `buildNav` rather than a second reading
// of the Manifest, so what the bar holds is what the overlay holds, in the same
// order.
describe('buildCompactMenu', () => {
  // The rows down the overlay, a League's second level indented under it, which
  // is the shape the reader reads.
  function lines(nav) {
    const out = [];

    for (const row of buildCompactMenu(nav)) {
      if (row.kind !== 'league') {
        out.push(row.label);
        continue;
      }
      out.push(row.name);
      out.push('  Overview');
      for (const year of row.years) out.push(`  ${year.label}`);
    }

    return out;
  }

  it('holds the same cascade as the bar, with Movies on the end', () => {
    expect(lines(buildNav(TWO_LEAGUES, CAMPAIGN_PATH))).toEqual([
      'MovieBoyz',
      '  Overview',
      '  2027',
      '  2026',
      '  2025',
      'Film Fellas',
      '  Overview',
      '  2026',
      'Movies',
    ]);
  });

  it('is the same shape while one League is published', () => {
    expect(lines(buildNav(ONE_LEAGUE, CAMPAIGN_PATH))).toEqual([
      'MovieBoyz',
      '  Overview',
      '  2027',
      '  2026',
      '  2025',
      'Movies',
    ]);
  });

  it('reads the Leagues in Manifest order, all ten of them', () => {
    const leagues = buildCompactMenu(buildNav(TEN_LEAGUES, CAMPAIGN_PATH)).filter(
      (row) => row.kind === 'league',
    );

    expect(leagues.map((row) => row.slug)).toEqual(TEN_LEAGUES.leagues.map((league) => league.slug));
  });

  // Exactly one row is marked as the page, as in the bar: a Campaign marks its
  // year, the landing page marks Overview, and the Movies page marks Movies.
  it('marks the one page the reader is standing on', () => {
    const marks = (manifest, path) => {
      const rows = [];

      for (const row of buildCompactMenu(buildNav(manifest, path))) {
        if (row.kind !== 'league') {
          if (row.marked) rows.push(row.label);
          continue;
        }
        if (row.overviewCurrent) rows.push('Overview');
        for (const year of row.years) if (year.current) rows.push(year.label);
      }

      return rows;
    };

    expect(marks(TWO_LEAGUES, CAMPAIGN_PATH)).toEqual(['2026']);
    expect(marks(TWO_LEAGUES, LANDING_PATH)).toEqual(['Overview']);
    expect(marks(TWO_LEAGUES, MOVIES_PATH)).toEqual(['Movies']);
    expect(marks(TWO_LEAGUES, '/')).toEqual([]);
  });

  it('marks the one League row the reader is inside', () => {
    const inside = buildCompactMenu(buildNav(TWO_LEAGUES, OTHER_CAMPAIGN_PATH)).filter(
      (row) => row.kind === 'league' && row.inside,
    );

    expect(inside.map((row) => row.name)).toEqual(['Film Fellas']);
  });

  // The badges are the bar's own, carried through rather than rebuilt, so a
  // drafting year reads the same in the overlay as in the menu it came from.
  it('carries each year’s Lifecycle badge through', () => {
    const [league] = buildCompactMenu(buildNav(ONE_LEAGUE, CAMPAIGN_PATH));

    expect(league.years.map((year) => [year.label, year.state, year.stateLabel])).toEqual([
      ['2027', 'drafting', 'Drafting'],
      ['2026', 'active', 'Active'],
      ['2025', 'final', 'Final'],
    ]);
  });

  // A path naming no League, and a Manifest that never loaded. The lookup is
  // the one thing every reader can still reach, so it is what the list holds.
  it('falls back to the Movies lookup alone when nothing else is known', () => {
    expect(lines(buildNav(null, MOVIES_PATH))).toEqual(['Movies']);
  });
});
