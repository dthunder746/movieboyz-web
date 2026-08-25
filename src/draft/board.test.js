import { describe, expect, it } from 'vitest';

import { buildDraftBoard, initialSeason, seasonForDate } from './board.js';

// A Campaign artifact carrying one held Pick, one Movie nobody holds, and a
// holder the roster does not list. Trimmed to the fields the draft page reads.
function campaign(overrides = {}) {
  return {
    league_slug: 'movieboyz',
    league_name: 'MovieBoyz',
    year: 2026,
    state: 'active',
    latest_date: '2026-03-03',
    latest_profit_date: '2026-03-03',
    ruleset: { season_boundaries: { WINTER: '2026-01-01', SUMMER: '2026-05-01', FALL: '2026-09-01' } },
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
        profit_td: 400,
        user_id: 'marcus',
        pick_type: 'seasonal',
        draft_pick: 1,
      },
      {
        imdb_id: 'tt2',
        title: 'Nobody Holds This',
        release_date: '2026-06-01',
        season: 'SUMMER',
        budget: null,
        breakeven: null,
        profit_td: null,
        user_id: null,
        pick_type: null,
        draft_pick: null,
      },
    ],
    ...overrides,
  };
}

describe('buildDraftBoard', () => {
  it('carries every Movie on the Board, held or not', () => {
    expect(buildDraftBoard(campaign()).rows.map((row) => row.imdbId)).toEqual(['tt1', 'tt2']);
  });

  it('names the holder off the roster', () => {
    const [held] = buildDraftBoard(campaign()).rows;
    expect(held.userId).toBe('marcus');
    expect(held.username).toBe('Marcus');
  });

  // The old page said this with the string `none` and its own list of five
  // names. The artifact publishes null, and null is what the renderers ask for.
  it('leaves a Movie nobody holds without a holder or a name', () => {
    const [, unheld] = buildDraftBoard(campaign()).rows;
    expect(unheld.userId).toBeNull();
    expect(unheld.username).toBeNull();
  });

  // The Board is the authority on who holds what, so a holder the roster has
  // dropped still renders. The id stands in for the name nobody published.
  it('falls back to the id for a holder the roster does not list', () => {
    const board = buildDraftBoard(campaign({ roster: [{ user_id: 'connie', username: 'Connie' }] }));
    expect(board.rows[0].username).toBe('marcus');
  });

  it('reads the Pick off the artifact', () => {
    const [held] = buildDraftBoard(campaign()).rows;
    expect(held.pickType).toBe('seasonal');
    expect(held.draftPick).toBe(1);
    expect(held.season).toBe('WINTER');
    expect(held.breakeven).toBe(1000);
    expect(held.profitTd).toBe(400);
  });

  // Every member gets a card on the leaderboard whether or not they hold
  // anything on this board, so an empty Slate reads as an empty Slate.
  it('carries the whole roster rather than the Users holding a Pick', () => {
    expect(buildDraftBoard(campaign()).users).toEqual([
      { userId: 'marcus', username: 'Marcus' },
      { userId: 'connie', username: 'Connie' },
    ]);
  });

  it('carries the Season boundaries the Campaign froze', () => {
    expect(buildDraftBoard(campaign()).seasonBoundaries).toEqual({
      WINTER: '2026-01-01',
      SUMMER: '2026-05-01',
      FALL: '2026-09-01',
    });
  });

  // The catch-all renders any Campaign path, so a Campaign that could not be
  // read has to leave a Board the page can still draw an empty state from.
  it('builds an empty Board from nothing at all', () => {
    const board = buildDraftBoard(undefined);
    expect(board.rows).toEqual([]);
    expect(board.users).toEqual([]);
    expect(board.seasonBoundaries).toBeNull();
  });
});

// Which Season tab opens first. The boundaries are the Campaign's to set and it
// freezes them at finalize, so this asks them rather than the calendar.
describe('seasonForDate', () => {
  const boundaries = { WINTER: '2026-01-01', SUMMER: '2026-05-01', FALL: '2026-09-01' };

  it('is the Season whose boundary the date has passed', () => {
    expect(seasonForDate('2026-06-15', boundaries)).toBe('SUMMER');
  });

  it('is the Season starting on the boundary date itself', () => {
    expect(seasonForDate('2026-09-01', boundaries)).toBe('FALL');
  });

  it('is the first Season for a date before every boundary', () => {
    expect(seasonForDate('2025-12-31', boundaries)).toBe('WINTER');
  });

  // The keys are read in Season order, so a Ruleset that lists them in some
  // other order still answers with the Season it published.
  it('does not depend on the order the boundaries are listed in', () => {
    expect(seasonForDate('2026-06-15', { FALL: '2026-09-01', WINTER: '2026-01-01', SUMMER: '2026-05-01' }))
      .toBe('SUMMER');
  });

  // A Ruleset can publish fewer boundaries than there are Seasons. What is
  // there still orders the year.
  it('uses the boundaries it has', () => {
    expect(seasonForDate('2026-06-15', { WINTER: '2026-01-01' })).toBe('WINTER');
    expect(seasonForDate('2026-10-01', { WINTER: '2026-01-01', FALL: '2026-09-01' })).toBe('FALL');
  });

  // The old page's month rule, kept for a Campaign whose Ruleset does not carry
  // boundaries. It answers identically for the ones every published Campaign
  // has used so far.
  it('falls back to the month for a Campaign with no boundaries', () => {
    expect(seasonForDate('2026-03-01', null)).toBe('WINTER');
    expect(seasonForDate('2026-06-01', null)).toBe('SUMMER');
    expect(seasonForDate('2026-10-01', null)).toBe('FALL');
  });

  // The months the fallback turns on, which are the ones every published
  // Campaign's boundaries have so far agreed with.
  it('falls back on the same months the published boundaries use', () => {
    expect(seasonForDate('2026-04-30', null)).toBe('WINTER');
    expect(seasonForDate('2026-05-01', null)).toBe('SUMMER');
    expect(seasonForDate('2026-08-31', null)).toBe('SUMMER');
    expect(seasonForDate('2026-09-01', null)).toBe('FALL');
  });

  it('opens on the first Season when there is no date at all', () => {
    expect(seasonForDate(null, boundaries)).toBe('WINTER');
  });
});

// Which tab the page opens on. The reader's last choice wins over the calendar,
// which is what the old page's cookie was for; the date only answers the first
// visit.
describe('initialSeason', () => {
  const boundaries = { WINTER: '2026-01-01', SUMMER: '2026-05-01', FALL: '2026-09-01' };

  it('is the Season the reader last had open', () => {
    expect(initialSeason('FALL', '2026-06-15', boundaries)).toBe('FALL');
  });

  it("falls back to the Board's own date when nothing was saved", () => {
    expect(initialSeason(null, '2026-06-15', boundaries)).toBe('SUMMER');
  });

  // The saved value comes off a cookie, which anything can write.
  it('ignores a saved value that names no Season', () => {
    expect(initialSeason('AUTUMN', '2026-06-15', boundaries)).toBe('SUMMER');
    expect(initialSeason('', '2026-06-15', boundaries)).toBe('SUMMER');
  });
});
