import { describe, expect, it } from 'vitest';

import { buildBoard } from './board.js';
import { buildStandings, totalSeries } from './standings.js';

// A Campaign artifact trimmed to the fields the Standings read. Two Users, one
// of whom holds the bomb, plus a rostered User with an empty Slate.
//
// Gross and ratings are deliberately absent here: ADR 0008 moved them to the
// Movie slice, so the Standings reach them through the Board join rather than
// off this file. A fixture carrying them would keep passing against a shape
// that no longer ships.
function campaign(overrides = {}) {
  return {
    latest_date: '2026-03-03',
    latest_profit_date: '2026-03-03',
    roster: [
      { user_id: 'marcus', username: 'Marcus' },
      { user_id: 'connie', username: 'Connie' },
      { user_id: 'chris', username: 'Chris' },
    ],
    users: [
      {
        user_id: 'marcus',
        profit: { '2026-03-01': 100, '2026-03-02': 300, '2026-03-03': 400 },
        bomb_impact: { '2026-03-01': -10, '2026-03-02': -20, '2026-03-03': -25 },
        total: 375,
      },
      {
        user_id: 'connie',
        profit: { '2026-03-01': 50, '2026-03-02': 60, '2026-03-03': 900 },
        bomb_impact: { '2026-03-01': 0, '2026-03-02': 0, '2026-03-03': 0 },
        total: 900,
      },
      {
        user_id: 'chris',
        profit: { '2026-03-01': 0, '2026-03-02': 0, '2026-03-03': 0 },
        bomb_impact: { '2026-03-01': -10, '2026-03-02': -20, '2026-03-03': -25 },
        total: -25,
      },
    ],
    movies: [
      {
        imdb_id: 'tt1',
        title: 'Released Early',
        user_id: 'marcus',
        pick_type: 'hit',
        season: 'WINTER',
        release_date: '2026-03-01',
        breakeven: 1000,
        profit_td: 400,
        profit: {},
      },
      {
        imdb_id: 'tt2',
        title: 'Still To Come',
        user_id: 'marcus',
        pick_type: 'seasonal',
        season: 'WINTER',
        release_date: '2026-03-13',
        breakeven: 3000,
        profit_td: null,
        profit: {},
      },
      {
        imdb_id: 'tt3',
        title: 'The Bomb',
        user_id: 'connie',
        pick_type: 'bomb',
        season: 'WINTER',
        release_date: '2026-03-02',
        breakeven: 500,
        profit_td: -100,
        profit: {},
      },
      {
        imdb_id: 'tt4',
        title: 'Released Late',
        user_id: 'connie',
        pick_type: 'hit',
        season: 'WINTER',
        release_date: '2026-03-03',
        breakeven: 2000,
        profit_td: 900,
        profit: {},
      },
    ],
    ...overrides,
  };
}

// The Movie slice for the same year: gross, ratings and days running, which is
// everything the Standings need that the Campaign artifact no longer carries.
// Only the released Picks appear, because an unreleased one has no measurements.
function slice(overrides = {}) {
  return {
    release_year: 2026,
    latest_date: '2026-03-03',
    movies: [
      {
        imdb_id: 'tt1',
        gross_td: 1400,
        days_running: 3,
        ratings: { letterboxd: { score: 80, votes: 12 } },
      },
      {
        imdb_id: 'tt3',
        gross_td: 400,
        days_running: 2,
        ratings: { letterboxd: { score: 40, votes: 8 } },
      },
      {
        imdb_id: 'tt4',
        gross_td: 2900,
        days_running: 1,
        ratings: { letterboxd: { score: 60, votes: 5 } },
      },
    ],
    ...overrides,
  };
}

// The Standings read scored figures off the Campaign artifact and measurements
// off the Board, so every case here goes through the same join the page does.
function standings(artifact = campaign(), slices = [slice()]) {
  return buildStandings(artifact, buildBoard(artifact, slices));
}

function rowFor(result, userId) {
  return result.rows.find((row) => row.userId === userId);
}

describe('totalSeries', () => {
  // The artifact publishes `total` as a single scalar, so the per-day total the
  // chart plots has to come from the two series it does publish. This is a join
  // of published figures, not a re-scoring: the site still computes no Standings.
  it('sums Slate Profit and Bomb Impact per day', () => {
    const [marcus] = campaign().users;
    expect(totalSeries(marcus)).toEqual({
      '2026-03-01': 90,
      '2026-03-02': 280,
      '2026-03-03': 375,
    });
  });

  it('agrees with the published total at the latest profit date', () => {
    const artifact = campaign();
    for (const user of artifact.users) {
      expect(totalSeries(user)[artifact.latest_profit_date]).toBe(user.total);
    }
  });

  it('treats a day missing from Bomb Impact as no impact', () => {
    expect(totalSeries({ profit: { '2026-03-01': 100 }, bomb_impact: {} })).toEqual({
      '2026-03-01': 100,
    });
  });
});

describe('buildStandings', () => {
  it('ranks Users by total, highest first', () => {
    const { rows } = standings();
    expect(rows.map((row) => row.userId)).toEqual(['connie', 'marcus', 'chris']);
    expect(rows.map((row) => row.rank)).toEqual([1, 2, 3]);
  });

  it('carries the published total rather than recomputing it', () => {
    expect(rowFor(standings(), 'marcus').total).toBe(375);
  });

  it('reads Slate Profit and Bomb Impact at the latest profit date', () => {
    const row = rowFor(standings(), 'marcus');
    expect(row.slateProfit).toBe(400);
    expect(row.bombImpact).toBe(-25);
  });

  it('denormalizes the username from the roster', () => {
    expect(rowFor(standings(), 'connie').username).toBe('Connie');
  });

  it('keeps a rostered User with an empty Slate', () => {
    const row = rowFor(standings(), 'chris');
    expect(row.username).toBe('Chris');
    expect(row.released).toEqual([]);
    expect(row.nextPick).toBeNull();
  });

  it('lists released Picks oldest first, excluding the unreleased', () => {
    const row = rowFor(standings(), 'connie');
    expect(row.released.map((pick) => pick.title)).toEqual(['The Bomb', 'Released Late']);
  });

  it('carries the display fields each released Pick renders', () => {
    const [pick] = rowFor(standings(), 'marcus').released;
    expect(pick).toMatchObject({
      imdbId: 'tt1',
      title: 'Released Early',
      pickType: 'hit',
      season: 'WINTER',
      releaseDate: '2026-03-01',
      breakeven: 1000,
      grossTd: 1400,
      profitTd: 400,
    });
  });

  // The defect this replaces: gross_td was read off the Campaign artifact,
  // where ADR 0008 no longer puts it, so it was undefined against real output.
  it('takes gross to date off the Movie slice, not the Campaign artifact', () => {
    const artifact = campaign();
    // A Campaign artifact that wrongly still carried the field must not be
    // where the figure comes from.
    artifact.movies[0].gross_td = 99;
    expect(rowFor(standings(artifact), 'marcus').released[0].grossTd).toBe(1400);
  });

  it('leaves gross to date null while the slice has not landed', () => {
    expect(rowFor(standings(campaign(), []), 'marcus').released[0].grossTd).toBeNull();
  });

  it('carries the published Season rather than deriving one from the date', () => {
    const artifact = campaign();
    // A Campaign whose boundaries put early March in SUMMER must render SUMMER,
    // whatever the month alone would suggest.
    artifact.movies[0].season = 'SUMMER';
    expect(rowFor(standings(artifact), 'marcus').released[0].season).toBe('SUMMER');
  });

  it('leaves the Season null when the artifact publishes none', () => {
    const artifact = campaign();
    delete artifact.movies[0].season;
    expect(rowFor(standings(artifact), 'marcus').released[0].season).toBeNull();
  });

  it('names the next unreleased Pick and the days until it', () => {
    const row = rowFor(standings(), 'marcus');
    expect(row.nextPick.title).toBe('Still To Come');
    expect(row.nextPick.daysUntil).toBe(10);
  });

  it('has no next Pick once every Pick has released', () => {
    expect(rowFor(standings(), 'connie').nextPick).toBeNull();
  });

  it('computes ROI over the Breakeven of non-bomb Picks only', () => {
    // Connie's Slate is the bomb (500) plus Released Late (2000). Only the
    // latter counts, so 900 / 2000.
    expect(rowFor(standings(), 'connie').roi).toBeCloseTo(45);
  });

  it('excludes a Pick with no published Breakeven from the ROI denominator', () => {
    const artifact = campaign();
    artifact.movies[1].breakeven = null; // Marcus's unreleased Pick
    // Leaves only Released Early's 1000 against a Slate Profit of 400.
    expect(rowFor(standings(artifact), 'marcus').roi).toBeCloseTo(40);
  });

  it('has no ROI when the Slate carries no Breakeven at all', () => {
    expect(rowFor(standings(), 'chris').roi).toBeNull();
  });

  it('excludes a bomb whatever case the artifact published its type in', () => {
    const artifact = campaign();
    artifact.movies[2].pick_type = 'BOMB'; // Connie's bomb
    // Still only Released Late's 2000 against a Slate Profit of 900.
    expect(rowFor(standings(artifact), 'connie').roi).toBeCloseTo(45);
  });

  it('counts a Pick with no published type toward the ROI denominator', () => {
    // Only a bomb is excluded, and an untyped Pick is not one. Dropping it would
    // measure the Slate Profit against less than the Slate actually risked.
    const artifact = campaign();
    artifact.movies[2].pick_type = null; // Connie's bomb, now untyped
    // Both Picks count: 900 / (500 + 2000).
    expect(rowFor(standings(artifact), 'connie').roi).toBeCloseTo(36);
  });

  // The scorecard's "Avg. Rating" cell. Letterboxd only, averaged across the
  // Picks that have actually opened: an unreleased Pick carries no audience yet,
  // and letting one in would drag the figure toward whatever pre-release noise
  // the ratings source happened to publish.
  describe('average Letterboxd', () => {
    it('averages the score across a Slate’s released Picks', () => {
      // Connie holds the bomb at 40 and Released Late at 60.
      expect(rowFor(standings(), 'connie').avgLetterboxd).toBeCloseTo(50);
    });

    it('counts a Pick as released by its measurements, not by its date', () => {
      // Days running is what says a Movie has opened and been measured. A Pick
      // whose slice row has none has nothing to average in yet.
      const withoutRun = slice({
        movies: slice().movies.map((movie) => (
          movie.imdb_id === 'tt3' ? { ...movie, days_running: null } : movie
        )),
      });
      expect(rowFor(standings(campaign(), [withoutRun]), 'connie').avgLetterboxd).toBeCloseTo(60);
    });

    it('skips a released Pick with no Letterboxd score rather than scoring it zero', () => {
      const unrated = slice({
        movies: slice().movies.map((movie) => (
          movie.imdb_id === 'tt3' ? { ...movie, ratings: null } : movie
        )),
      });
      expect(rowFor(standings(campaign(), [unrated]), 'connie').avgLetterboxd).toBeCloseTo(60);
    });

    it('has no average when nothing on the Slate has been rated', () => {
      expect(rowFor(standings(), 'chris').avgLetterboxd).toBeNull();
      expect(rowFor(standings(campaign(), []), 'marcus').avgLetterboxd).toBeNull();
    });
  });

  it('counts released Picks against the whole Slate', () => {
    const row = rowFor(standings(), 'marcus');
    expect(row.releasedCount).toBe(1);
    expect(row.pickCount).toBe(2);
  });

  it('treats a Pick with no release date as unreleased and never as next', () => {
    const artifact = campaign();
    artifact.movies[1].release_date = null;
    const row = rowFor(standings(artifact), 'marcus');
    expect(row.releasedCount).toBe(1);
    expect(row.pickCount).toBe(2);
    expect(row.nextPick).toBeNull();
  });

  it('treats an undated Pick as unreleased and never as next', () => {
    // 'TBA' sorts above any real date as a string, so an undated Pick would
    // otherwise become the next release and count down to a date that is not
    // one. The Board rule should keep these off a Campaign now; the old site
    // excluded them explicitly and this stays tolerant of one arriving.
    const artifact = campaign();
    artifact.movies[1].release_date = 'TBA';
    const row = rowFor(standings(artifact), 'marcus');
    expect(row.releasedCount).toBe(1);
    expect(row.pickCount).toBe(2);
    expect(row.nextPick).toBeNull();
  });

  it('measures release against the latest profit date, not the gross date', () => {
    // The two diverge when the newest capture carries gross that has not been
    // scored yet. The old site anchors the Standings on the profit date, and a
    // Pick counted as released before its profit lands would show a released
    // Pick contributing nothing.
    const artifact = campaign({ latest_date: '2026-03-13', latest_profit_date: '2026-03-03' });
    const row = rowFor(standings(artifact), 'marcus');
    expect(row.releasedCount).toBe(1);
    expect(row.nextPick.title).toBe('Still To Come');
  });
});
