import { describe, expect, it } from 'vitest';

import { buildStandings, totalSeries } from './standings.js';

// A Campaign artifact trimmed to the fields the Standings read. Two Users, one
// of whom holds the bomb, plus a rostered User with an empty Slate.
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
        gross_td: 1400,
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
        gross_td: null,
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
        gross_td: 400,
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
        gross_td: 2900,
        profit_td: 900,
        profit: {},
      },
    ],
    ...overrides,
  };
}

function rowFor(standings, userId) {
  return standings.rows.find((row) => row.userId === userId);
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
    const { rows } = buildStandings(campaign());
    expect(rows.map((row) => row.userId)).toEqual(['connie', 'marcus', 'chris']);
    expect(rows.map((row) => row.rank)).toEqual([1, 2, 3]);
  });

  it('carries the published total rather than recomputing it', () => {
    expect(rowFor(buildStandings(campaign()), 'marcus').total).toBe(375);
  });

  it('reads Slate Profit and Bomb Impact at the latest profit date', () => {
    const row = rowFor(buildStandings(campaign()), 'marcus');
    expect(row.slateProfit).toBe(400);
    expect(row.bombImpact).toBe(-25);
  });

  it('denormalizes the username from the roster', () => {
    expect(rowFor(buildStandings(campaign()), 'connie').username).toBe('Connie');
  });

  it('keeps a rostered User with an empty Slate', () => {
    const row = rowFor(buildStandings(campaign()), 'chris');
    expect(row.username).toBe('Chris');
    expect(row.released).toEqual([]);
    expect(row.nextPick).toBeNull();
  });

  it('lists released Picks oldest first, excluding the unreleased', () => {
    const row = rowFor(buildStandings(campaign()), 'connie');
    expect(row.released.map((pick) => pick.title)).toEqual(['The Bomb', 'Released Late']);
  });

  it('carries the display fields each released Pick renders', () => {
    const [pick] = rowFor(buildStandings(campaign()), 'marcus').released;
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

  it('carries the published Season rather than deriving one from the date', () => {
    const artifact = campaign();
    // A Campaign whose boundaries put early March in SUMMER must render SUMMER,
    // whatever the month alone would suggest.
    artifact.movies[0].season = 'SUMMER';
    expect(rowFor(buildStandings(artifact), 'marcus').released[0].season).toBe('SUMMER');
  });

  it('leaves the Season null when the artifact publishes none', () => {
    const artifact = campaign();
    delete artifact.movies[0].season;
    expect(rowFor(buildStandings(artifact), 'marcus').released[0].season).toBeNull();
  });

  it('names the next unreleased Pick and the days until it', () => {
    const row = rowFor(buildStandings(campaign()), 'marcus');
    expect(row.nextPick.title).toBe('Still To Come');
    expect(row.nextPick.daysUntil).toBe(10);
  });

  it('has no next Pick once every Pick has released', () => {
    expect(rowFor(buildStandings(campaign()), 'connie').nextPick).toBeNull();
  });

  it('computes ROI over the Breakeven of non-bomb Picks only', () => {
    // Connie's Slate is the bomb (500) plus Released Late (2000). Only the
    // latter counts, so 900 / 2000.
    expect(rowFor(buildStandings(campaign()), 'connie').roi).toBeCloseTo(45);
  });

  it('excludes a Pick with no published Breakeven from the ROI denominator', () => {
    const artifact = campaign();
    artifact.movies[1].breakeven = null; // Marcus's unreleased Pick
    // Leaves only Released Early's 1000 against a Slate Profit of 400.
    expect(rowFor(buildStandings(artifact), 'marcus').roi).toBeCloseTo(40);
  });

  it('has no ROI when the Slate carries no Breakeven at all', () => {
    expect(rowFor(buildStandings(campaign()), 'chris').roi).toBeNull();
  });

  it('counts released Picks against the whole Slate', () => {
    const row = rowFor(buildStandings(campaign()), 'marcus');
    expect(row.releasedCount).toBe(1);
    expect(row.pickCount).toBe(2);
  });

  it('treats a Pick with no release date as unreleased and never as next', () => {
    const artifact = campaign();
    artifact.movies[1].release_date = null;
    const row = rowFor(buildStandings(artifact), 'marcus');
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
    const row = rowFor(buildStandings(artifact), 'marcus');
    expect(row.releasedCount).toBe(1);
    expect(row.nextPick.title).toBe('Still To Come');
  });
});
