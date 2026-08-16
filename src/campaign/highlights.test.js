import { describe, expect, it } from 'vitest';

import { buildBoard } from './board.js';
import { buildHighlights } from './highlights.js';

// A Campaign spanning the six tabs: one Pick still to open, two that have
// opened either side of break-even, one held from the year before, and one
// Movie nobody holds.
function campaign(overrides = {}) {
  return {
    year: 2026,
    latest_date: '2026-03-10',
    latest_profit_date: '2026-03-10',
    roster: [{ user_id: 'marcus', username: 'Marcus' }],
    movies: [
      {
        imdb_id: 'tt1',
        title: 'In Profit',
        release_date: '2026-03-01',
        season: 'WINTER',
        breakeven: 1000,
        user_id: 'marcus',
        pick_type: 'hit',
        profit: {},
        profit_td: 400,
      },
      {
        imdb_id: 'tt2',
        title: 'In The Red',
        release_date: '2026-03-02',
        season: 'WINTER',
        breakeven: 2000,
        user_id: null,
        pick_type: null,
        profit: {},
        profit_td: -600,
      },
      {
        imdb_id: 'tt3',
        title: 'Still To Come',
        release_date: '2026-06-01',
        season: 'SUMMER',
        breakeven: 3000,
        user_id: 'marcus',
        pick_type: 'seasonal',
        profit: {},
        profit_td: null,
      },
      {
        imdb_id: 'tt4',
        title: 'Held From Last Year',
        release_date: '2025-11-01',
        season: 'FALL',
        breakeven: 500,
        user_id: 'marcus',
        pick_type: 'hit',
        profit: {},
        profit_td: 50,
      },
    ],
    ...overrides,
  };
}

// 2026-03-10 is a Tuesday, in ISO week 11. The week before runs 2026-03-02 to
// 2026-03-08, and the same weekday a week back is 2026-03-03.
function slice(overrides = {}) {
  return {
    release_year: 2026,
    latest_date: '2026-03-10',
    movies: [
      {
        imdb_id: 'tt1',
        gross_td: 1400,
        days_running: 10,
        daily_change: {
          '2026-03-02': 100,
          '2026-03-03': 200,
          '2026-03-09': 50,
          '2026-03-10': 100,
        },
        weekly_gross: { '2026-W10': 300, '2026-W11': 150 },
        ratings: { letterboxd: { score: 80, votes: 12 } },
        released_digital: '2026-05-01',
        status: null,
      },
      {
        imdb_id: 'tt2',
        gross_td: 800,
        days_running: 9,
        daily_change: { '2026-03-03': 400, '2026-03-10': 200 },
        weekly_gross: { '2026-W10': 400, '2026-W11': 200 },
        ratings: null,
        released_digital: '2026-03-05',
        status: null,
      },
      {
        imdb_id: 'tt3',
        gross_td: null,
        days_running: null,
        daily_change: {},
        weekly_gross: {},
        ratings: null,
        released_digital: null,
        status: null,
      },
    ],
    ...overrides,
  };
}

function slice2025(overrides = {}) {
  return {
    release_year: 2025,
    latest_date: '2026-03-10',
    movies: [
      {
        imdb_id: 'tt4',
        gross_td: 900,
        days_running: 130,
        daily_change: {},
        weekly_gross: {},
        ratings: null,
        released_digital: '2026-01-15',
        status: null,
      },
    ],
    ...overrides,
  };
}

function highlights(artifact = campaign(), slices = [slice(), slice2025()]) {
  return buildHighlights(buildBoard(artifact, slices));
}

function titles(rows) {
  return rows.map((row) => row.title ?? row.movie.title);
}

describe('buildHighlights', () => {
  describe('upcoming', () => {
    it('lists what has not opened yet, soonest first', () => {
      expect(titles(highlights().upcoming)).toEqual(['Still To Come']);
    });

    it('leaves out a Movie already measured, whatever its date says', () => {
      // Days running is the measurement that says a Movie has opened. A date in
      // the future with a run behind it is a re-release or a bad date, and
      // either way it does not belong under Upcoming.
      const early = slice({
        movies: slice().movies.map((movie) => (
          movie.imdb_id === 'tt3' ? { ...movie, days_running: 2 } : movie
        )),
      });
      expect(highlights(campaign(), [early, slice2025()]).upcoming).toEqual([]);
    });

    it('leaves out a Movie with no release date', () => {
      const artifact = campaign();
      artifact.movies[2].release_date = null;
      expect(highlights(artifact).upcoming).toEqual([]);
    });
  });

  describe('profitable and worst', () => {
    it('ranks the Movies in profit, biggest first', () => {
      expect(titles(highlights().profitable)).toEqual(['In Profit', 'Held From Last Year']);
    });

    it('ranks the Movies in the red, deepest first', () => {
      expect(titles(highlights().worst)).toEqual(['In The Red']);
    });

    it('leaves a Movie with no published profit out of both', () => {
      const all = highlights();
      expect(titles(all.profitable)).not.toContain('Still To Come');
      expect(titles(all.worst)).not.toContain('Still To Come');
    });

    it('leaves a Movie sitting exactly on break-even out of both', () => {
      const artifact = campaign();
      artifact.movies[0].profit_td = 0;
      const all = highlights(artifact);
      expect(titles(all.profitable)).not.toContain('In Profit');
      expect(titles(all.worst)).not.toContain('In Profit');
    });
  });

  describe('streaming', () => {
    it('splits digital releases into what is out and what is coming', () => {
      const { streaming } = highlights();
      expect(titles(streaming.upcomingDigital)).toEqual(['In Profit']);
      expect(titles(streaming.availableNow)).toEqual(['In The Red', 'Held From Last Year']);
    });

    it('orders what is coming soonest first and what is out most recent first', () => {
      const { streaming } = highlights();
      expect(streaming.availableNow.map((row) => row.releasedDigital))
        .toEqual(['2026-03-05', '2026-01-15']);
    });

    it('keeps a held Pick from an earlier year', () => {
      // A Pick is on the Board because somebody holds it, so its digital
      // release is news whatever year it opened in.
      expect(titles(highlights().streaming.availableNow)).toContain('Held From Last Year');
    });

    it('drops an unheld Movie that did not open in the Campaign year', () => {
      const artifact = campaign();
      artifact.movies[1].release_date = '2025-11-01';
      expect(titles(highlights(artifact).streaming.availableNow)).not.toContain('In The Red');
    });

    it('drops an unheld Movie whose digital date precedes its theatrical one', () => {
      // Nobody holds it and the dates contradict each other, so the digital
      // date is upstream noise rather than a release worth announcing.
      const artifact = campaign();
      const early = slice({
        movies: slice().movies.map((movie) => (
          movie.imdb_id === 'tt2' ? { ...movie, released_digital: '2026-01-01' } : movie
        )),
      });
      const { streaming } = buildHighlights(buildBoard(artifact, [early, slice2025()]));
      expect(titles(streaming.availableNow)).not.toContain('In The Red');
    });

    it('drops a Movie with no digital date at all', () => {
      const { streaming } = highlights();
      expect(titles([...streaming.upcomingDigital, ...streaming.availableNow]))
        .not.toContain('Still To Come');
    });

    it('measures the theatrical-to-digital window in days', () => {
      const [row] = highlights().streaming.upcomingDigital;
      expect(row.digitalWindowDays).toBe(61); // 2026-03-01 to 2026-05-01
    });

    it('has no window when there is no theatrical date to measure from', () => {
      const artifact = campaign();
      artifact.movies[0].release_date = null;
      const [row] = highlights(artifact).streaming.upcomingDigital;
      expect(row.digitalWindowDays).toBeNull();
    });
  });

  describe('daily', () => {
    it('ranks the day’s gross, biggest first', () => {
      const { daily } = highlights();
      expect(titles(daily.rows)).toEqual(['In The Red', 'In Profit']);
      expect(daily.rows.map((row) => row.gross)).toEqual([200, 100]);
    });

    it('compares against yesterday and against the same weekday last week', () => {
      // In Profit took 100 today, 50 yesterday and 200 the same weekday a week
      // back: doubled on the day, down 50% on the week.
      const row = highlights().daily.rows.find((r) => r.movie.title === 'In Profit');
      expect(row.pctYd).toBeCloseTo(100);
      expect(row.pctLw).toBeCloseTo(-50);
    });

    it('has no comparison where the baseline is missing or zero', () => {
      // In The Red published nothing yesterday and 400 last week.
      const row = highlights().daily.rows.find((r) => r.movie.title === 'In The Red');
      expect(row.pctYd).toBeNull();
      expect(row.pctLw).toBeCloseTo(-50);
    });

    it('excludes a Movie whose day reads zero', () => {
      // A zero is the API declining to report, not a day nobody bought a
      // ticket, so ranking it alongside real figures would be wrong.
      const flat = slice({
        movies: slice().movies.map((movie) => (
          movie.imdb_id === 'tt2' ? { ...movie, daily_change: { ...movie.daily_change, '2026-03-10': 0 } } : movie
        )),
      });
      expect(titles(highlights(campaign(), [flat, slice2025()]).daily.rows)).toEqual(['In Profit']);
    });

    it('labels the tab with the weekday and date it covers', () => {
      expect(highlights().daily.label).toBe('Top Daily (Tue 10/3)');
    });

    it('reads the day off the slice’s anchor, not the Campaign’s', () => {
      // ADR 0008 anchors a slice's figures on the slice's own latest date. A
      // Campaign that has scored a day further on than the slice has measured
      // would otherwise index `daily_change` at a date no slice carries, and
      // the tab would empty without saying why.
      const artifact = campaign({ latest_date: '2026-03-11' });
      const { daily } = buildHighlights(buildBoard(artifact, [slice(), slice2025()]));
      expect(daily.date).toBe('2026-03-10');
      expect(titles(daily.rows)).toEqual(['In The Red', 'In Profit']);
    });
  });

  describe('weekly', () => {
    it('ranks the current ISO week’s gross, biggest first', () => {
      const { weekly } = highlights();
      expect(weekly.weekKey).toBe('2026-W11');
      expect(titles(weekly.rows)).toEqual(['In The Red', 'In Profit']);
      expect(weekly.rows.map((row) => row.gross)).toEqual([200, 150]);
    });

    it('compares a part week against the same part of the week before', () => {
      // The week to date runs Mon 2026-03-09 to Tue 2026-03-10. Last week's
      // matching part is Mon 2026-03-02 to Tue 2026-03-03, which is 300 for In
      // Profit, against 150 this week.
      const row = highlights().weekly.rows.find((r) => r.movie.title === 'In Profit');
      expect(row.pctLw).toBeCloseTo(-50);
    });

    it('ignores the days last week that this week has not reached yet', () => {
      // The point of the part-week comparison. In Profit took 600 on the
      // Saturday of last week, a day this week has not arrived at. Counting it
      // would measure two days against seven and show the Movie collapsing.
      const bigSaturday = slice({
        movies: slice().movies.map((movie) => (
          movie.imdb_id === 'tt1'
            ? { ...movie, daily_change: { ...movie.daily_change, '2026-03-07': 600 } }
            : movie
        )),
      });
      const { weekly } = buildHighlights(buildBoard(campaign(), [bigSaturday, slice2025()]));
      // 150 this week against last week's 300 to the same weekday, not its 900
      // for the full week.
      expect(weekly.rows.find((r) => r.movie.title === 'In Profit').pctLw).toBeCloseTo(-50);
    });

    it('has no comparison when the Movie had not opened last week', () => {
      const artifact = campaign();
      const newThisWeek = slice({
        movies: slice().movies.map((movie) => (
          movie.imdb_id === 'tt2' ? { ...movie, daily_change: { '2026-03-10': 200 } } : movie
        )),
      });
      const { weekly } = buildHighlights(buildBoard(artifact, [newThisWeek, slice2025()]));
      expect(weekly.rows.find((r) => r.movie.title === 'In The Red').pctLw).toBeNull();
    });

    it('labels the tab with the week it covers', () => {
      expect(highlights().weekly.label).toBe('Top Weekly (Mar 9–15)');
    });

    it('reads the week off the slice’s anchor, not the Campaign’s', () => {
      // Same anchor rule as the daily tab. A Campaign date a week ahead of the
      // slice would pick an ISO week the slice has no gross in at all.
      const artifact = campaign({ latest_date: '2026-03-17' });
      const { weekly } = buildHighlights(buildBoard(artifact, [slice(), slice2025()]));
      expect(weekly.weekKey).toBe('2026-W11');
      expect(titles(weekly.rows)).toEqual(['In The Red', 'In Profit']);
    });
  });

  it('renders empty rather than throwing when nothing has been captured', () => {
    const empty = buildHighlights(buildBoard({ year: 2026, movies: [] }, []));
    expect(empty.upcoming).toEqual([]);
    expect(empty.profitable).toEqual([]);
    expect(empty.worst).toEqual([]);
    expect(empty.streaming.availableNow).toEqual([]);
    expect(empty.daily.rows).toEqual([]);
    expect(empty.weekly.rows).toEqual([]);
    expect(empty.daily.label).toBe('Top Daily');
    expect(empty.weekly.label).toBe('Top Weekly');
  });
});
