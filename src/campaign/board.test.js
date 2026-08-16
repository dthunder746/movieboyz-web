import { describe, expect, it } from 'vitest';

import { buildBoard, sliceYearsToFetch } from './board.js';

// A Campaign artifact carrying one held Pick, one Pick released the year
// before, and one Movie nobody holds. Trimmed to the fields the join reads.
function campaign(overrides = {}) {
  return {
    latest_date: '2026-03-03',
    latest_profit_date: '2026-03-03',
    roster: [
      { user_id: 'marcus', username: 'Marcus' },
      { user_id: 'connie', username: 'Connie' },
    ],
    movies: [
      {
        imdb_id: 'tt1',
        title: 'Held',
        release_date: '2026-03-01',
        season: 'WINTER',
        budget: 500,
        breakeven: 1000,
        user_id: 'marcus',
        pick_type: 'hit',
        draft_pick: 1,
        profit: { '2026-03-01': 0, '2026-03-03': 400 },
        profit_td: 400,
      },
      {
        imdb_id: 'tt2',
        title: 'Held, Older',
        release_date: '2025-11-01',
        season: 'FALL',
        budget: 200,
        breakeven: 400,
        user_id: 'connie',
        pick_type: 'bomb',
        draft_pick: 2,
        profit: { '2026-03-03': -100 },
        profit_td: -100,
      },
      {
        imdb_id: 'tt3',
        title: 'Nobody Holds This',
        release_date: '2026-06-01',
        season: 'SUMMER',
        budget: null,
        breakeven: null,
        user_id: null,
        pick_type: null,
        draft_pick: null,
        profit: {},
        profit_td: null,
      },
    ],
    ...overrides,
  };
}

// One year's Movie slice. Only tt1 and tt3 are 2026 releases, so tt2's
// measurements live in the 2025 slice.
function slice2026(overrides = {}) {
  return {
    release_year: 2026,
    latest_date: '2026-03-03',
    movies: [
      {
        imdb_id: 'tt1',
        gross_td: 1400,
        days_running: 3,
        daily_change: { '2026-03-01': 900, '2026-03-02': 300, '2026-03-03': 200 },
        weekly_gross: { '2026-W09': 1400 },
        ratings: { letterboxd: { score: 80, votes: 12 } },
        released_digital: '2026-05-01',
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

describe('sliceYearsToFetch', () => {
  it('asks for every release year the Board covers', () => {
    expect(sliceYearsToFetch(campaign(), [2025, 2026, 2027])).toEqual([2025, 2026]);
  });

  it('leaves out a year the manifest does not publish', () => {
    // A Pick released in a year with no slice must not become a 404. The
    // manifest is the authority on what exists, not the Board's dates.
    expect(sliceYearsToFetch(campaign(), [2026])).toEqual([2026]);
  });

  it('is empty when the manifest publishes no slices at all', () => {
    expect(sliceYearsToFetch(campaign(), [])).toEqual([]);
  });

  it('ignores a Movie with no release date', () => {
    const withUndated = campaign({
      movies: [{ imdb_id: 'tt9', title: 'Undated', release_date: null, profit: {} }],
    });
    expect(sliceYearsToFetch(withUndated, [2026])).toEqual([]);
  });
});

describe('buildBoard', () => {
  it('joins a Movie’s scored figures to its measurements on imdb_id', () => {
    const board = buildBoard(campaign(), [slice2026()]);
    const held = board.byId.get('tt1');

    expect(held.title).toBe('Held');
    expect(held.breakeven).toBe(1000);
    expect(held.profitTd).toBe(400);
    // From the slice, not the Campaign artifact (ADR 0008).
    expect(held.grossTd).toBe(1400);
    expect(held.daysRunning).toBe(3);
    expect(held.weeklyGross).toEqual({ '2026-W09': 1400 });
    expect(held.ratings.letterboxd.score).toBe(80);
    expect(held.releasedDigital).toBe('2026-05-01');
  });

  it('names the User who holds a Pick, and leaves the rest unheld', () => {
    const board = buildBoard(campaign(), [slice2026()]);

    expect(board.byId.get('tt1').username).toBe('Marcus');
    expect(board.byId.get('tt1').userId).toBe('marcus');
    expect(board.byId.get('tt3').username).toBe(null);
    expect(board.byId.get('tt3').userId).toBe(null);
  });

  it('carries a Movie whose slice has not landed, with its measurements empty', () => {
    // Standings render from the Campaign artifact alone and the table fills in
    // when the slice arrives, so a missing slice is a normal intermediate
    // state rather than an error.
    const board = buildBoard(campaign(), []);
    const held = board.byId.get('tt1');

    expect(held.title).toBe('Held');
    expect(held.profitTd).toBe(400);
    expect(held.grossTd).toBe(null);
    expect(held.daysRunning).toBe(null);
    expect(held.dailyChange).toEqual({});
    expect(held.weeklyGross).toEqual({});
    expect(held.ratings).toBe(null);
  });

  it('computes ROI against Breakeven, and none without one', () => {
    const board = buildBoard(campaign(), [slice2026()]);

    expect(board.byId.get('tt1').roi).toBe(40);
    expect(board.byId.get('tt3').roi).toBe(null);
  });

  it('keeps every Movie on the Board, held or not', () => {
    const board = buildBoard(campaign(), [slice2026()]);
    expect(board.rows).toHaveLength(3);
    expect(board.rows.map((row) => row.imdbId).sort()).toEqual(['tt1', 'tt2', 'tt3']);
  });

  it('ignores a slice row for a Movie the Board does not carry', () => {
    // The slice is everybody's year and the Board is one League's, so a slice
    // routinely covers Movies this Campaign never scored.
    const stray = slice2026({
      movies: [...slice2026().movies, { imdb_id: 'tt404', gross_td: 5 }],
    });
    expect(buildBoard(campaign(), [stray]).rows).toHaveLength(3);
  });

  it('carries the Pick’s draft details and the Movie’s own facts', () => {
    // The toolbar filters and the table columns read these straight off a row,
    // so the join has to carry them rather than send the view back to the
    // Campaign artifact for a second lookup.
    const board = buildBoard(campaign(), [slice2026()]);
    const held = board.byId.get('tt1');

    expect(held.releaseDate).toBe('2026-03-01');
    expect(held.season).toBe('WINTER');
    expect(held.budget).toBe(500);
    expect(held.pickType).toBe('hit');
    expect(held.draftPick).toBe(1);
    expect(held.profit).toEqual({ '2026-03-01': 0, '2026-03-03': 400 });
    expect(held.dailyChange).toEqual({
      '2026-03-01': 900, '2026-03-02': 300, '2026-03-03': 200,
    });
    expect(held.status).toBe(null);
  });

  it('reads the anchor dates off the Campaign artifact', () => {
    const board = buildBoard(campaign(), [slice2026()]);
    expect(board.latestDate).toBe('2026-03-03');
    expect(board.latestProfitDate).toBe('2026-03-03');
  });

  // ADR 0008: "'To date' on the slice is anchored to the last gross date the
  // slice itself carries, not to a Campaign's `latest_date`." The two coincide
  // while the Board and the slice cover the same population; when they do not,
  // reading a measurement at the Campaign's date silently finds nothing.
  describe('the measurement anchor', () => {
    it('comes off the slice, not the Campaign artifact', () => {
      const artifact = campaign({ latest_date: '2026-03-04' });
      const board = buildBoard(artifact, [slice2026({ latest_date: '2026-03-03' })]);
      expect(board.latestDate).toBe('2026-03-04');
      expect(board.measurementDate).toBe('2026-03-03');
    });

    it('takes the newest date when the Board spans several slices', () => {
      const older = slice2026({ release_year: 2025, latest_date: '2026-03-01' });
      const board = buildBoard(campaign(), [older, slice2026({ latest_date: '2026-03-03' })]);
      expect(board.measurementDate).toBe('2026-03-03');
    });

    it('falls back to the Campaign’s date when no slice has landed', () => {
      // There are no measurements to anchor at all in this state, so the
      // fallback only keeps the anchor a date rather than a null.
      expect(buildBoard(campaign(), []).measurementDate).toBe('2026-03-03');
    });

    it('ignores a slice that publishes no date of its own', () => {
      const undated = slice2026({ latest_date: undefined });
      expect(buildBoard(campaign(), [undated]).measurementDate).toBe('2026-03-03');
    });
  });

  it('carries the Campaign’s year', () => {
    // The Board holds Picks from earlier years alongside the Campaign year's
    // own releases, so a view that wants to tell the two apart cannot read the
    // year off the rows. It has to come from the Campaign artifact.
    expect(buildBoard(campaign({ year: 2026 }), []).year).toBe(2026);
    expect(buildBoard(campaign(), []).year).toBe(null);
  });
});
