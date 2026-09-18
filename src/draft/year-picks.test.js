import { describe, expect, it } from 'vitest';

import {
  TAB_ORDER,
  YEAR_TAB,
  YEAR_TAB_LABEL,
  draftDateSeasonFor,
  initialTab,
  isYearTab,
  lockedOnBoard,
  profitRanksEverySeason,
  yearLongPicks,
  yearReleasedCandidates,
  yearUnreleasedCandidates,
} from './year-picks.js';

import { applyToRows } from './whatif-store.js';
import {
  leaderboardForDraft,
  picksForDraft,
  snapshotForSeason,
  unpickedUnreleasedForDraft,
} from './season-helpers.js';
import { whatifStandings } from './standings.js';

function row(overrides = {}) {
  return {
    imdbId: 'tt0',
    title: 'A Movie',
    releaseDate: '2026-06-01',
    season: 'SUMMER',
    breakeven: 100,
    profitTd: null,
    userId: null,
    username: null,
    pickType: null,
    draftPick: null,
    ...overrides,
  };
}

function view(rows, { users = [], ghostSlots = [], ...rest } = {}) {
  return { rows, users, ghostSlots, ...rest };
}

describe('the tab key', () => {
  it('is not one of the Seasons', () => {
    expect(YEAR_TAB).toBe('YEAR');
    expect(isYearTab(YEAR_TAB)).toBe(true);
    expect(isYearTab('WINTER')).toBe(false);
    expect(YEAR_TAB_LABEL).toBe('Hits & Bombs');
  });

  // The year-long Picks were all taken at the Winter draft, so the date that
  // says what was available to take is Winter's.
  it('borrows the Winter draft date', () => {
    expect(draftDateSeasonFor(YEAR_TAB)).toBe('WINTER');
    expect(draftDateSeasonFor('FALL')).toBe('FALL');
  });
});

describe('initialTab', () => {
  const boundaries = { WINTER: '2026-01-01', SUMMER: '2026-05-01', FALL: '2026-09-01' };

  it('puts the year tab after the three Seasons', () => {
    expect(TAB_ORDER).toEqual(['WINTER', 'SUMMER', 'FALL', 'YEAR']);
  });

  it('opens on the year tab when that is what the reader last had open', () => {
    expect(initialTab('YEAR', '2026-06-15', boundaries)).toBe('YEAR');
  });

  it('leaves the Season logic alone for everything else', () => {
    expect(initialTab('FALL', '2026-06-15', boundaries)).toBe('FALL');
    expect(initialTab('AUTUMN', '2026-06-15', boundaries)).toBe('SUMMER');
  });
});

describe('lockedOnBoard', () => {
  it('locks a year-long Pick on a Season board', () => {
    expect(lockedOnBoard(row({ pickType: 'hit' }), 'WINTER')).toBe(true);
    expect(lockedOnBoard(row({ pickType: 'bomb' }), 'WINTER')).toBe(true);
  });

  it('leaves the same Pick editable on the year tab', () => {
    expect(lockedOnBoard(row({ pickType: 'hit' }), YEAR_TAB)).toBe(false);
    expect(lockedOnBoard(row({ pickType: 'bomb' }), YEAR_TAB)).toBe(false);
  });

  it('never locks a Season Pick', () => {
    expect(lockedOnBoard(row({ pickType: 'seasonal' }), 'WINTER')).toBe(false);
    expect(lockedOnBoard(row({ pickType: 'alt' }), 'SUMMER')).toBe(false);
  });
});

describe('yearLongPicks', () => {
  // Two hits and two bombs taken at the Winter draft, interleaved the way the
  // real draft order interleaves them, plus a seasonal that has no business
  // here.
  const rows = [
    row({ imdbId: 'ttH2', pickType: 'hit', draftPick: 4, userId: 'b', season: 'SUMMER' }),
    row({ imdbId: 'ttB1', pickType: 'bomb', draftPick: 7, userId: 'a', season: 'WINTER' }),
    row({ imdbId: 'ttH1', pickType: 'hit', draftPick: 1, userId: 'a', season: 'FALL' }),
    row({ imdbId: 'ttS1', pickType: 'seasonal', draftPick: 6, userId: 'a', season: 'WINTER' }),
    row({ imdbId: 'ttB2', pickType: 'bomb', draftPick: 10, userId: 'b', season: 'FALL' }),
  ];

  it('is the hits then the bombs, each in draft order', () => {
    expect(yearLongPicks(view(rows)).map((pick) => pick.imdbId)).toEqual([
      'ttH1', 'ttH2', 'ttB1', 'ttB2',
    ]);
  });

  it('carries the Season the Movie opens in, which is what differs from Winter', () => {
    const picks = yearLongPicks(view(rows));
    expect(picks.map((pick) => pick.season)).toEqual(['FALL', 'SUMMER', 'WINTER', 'FALL']);
  });

  it('keeps an emptied slot in its place so it can be filled again', () => {
    const ghosts = [{
      userId: 'b', username: 'Bee', pickType: 'hit', draftPick: 2, season: 'SUMMER',
      clearedImdbId: 'ttX', clearedTitle: 'Gone',
    }];
    const picks = yearLongPicks(view(rows, { ghostSlots: ghosts }));
    expect(picks.map((pick) => pick.imdbId ?? 'ghost')).toEqual([
      'ttH1', 'ghost', 'ttH2', 'ttB1', 'ttB2',
    ]);
    expect(picks[1].ghost).toBe(true);
  });

  it('ignores a ghost left by a Season Pick', () => {
    const ghosts = [{
      userId: 'a', username: 'Ay', pickType: 'seasonal', draftPick: 6, season: 'WINTER',
      clearedImdbId: 'ttS1', clearedTitle: 'Gone',
    }];
    expect(yearLongPicks(view(rows, { ghostSlots: ghosts })).length).toBe(4);
  });
});

// What the tab offers in exchange for a hit or a bomb. Both kinds are made at
// the first draft of the year, before anybody holds anything, so the pool is
// every film that is not itself one of the ten, whoever holds it now.
//
// A film that was already in cinemas on draft day was never available to take,
// so the year tab does not offer it at all.
describe('the year tab candidates', () => {
  const draftDate = '2026-01-31';
  const today = '2026-07-01';

  const rows = [
    row({ imdbId: 'ttHeld', releaseDate: '2026-06-01', userId: 'a', pickType: 'seasonal', draftPick: 3, profitTd: 10 }),
    row({ imdbId: 'ttHit', releaseDate: '2026-07-01', userId: 'b', pickType: 'hit', draftPick: 1, profitTd: 60 }),
    row({ imdbId: 'ttBombHeld', releaseDate: '2026-08-01', userId: 'c', pickType: 'bomb', draftPick: 7, profitTd: 20 }),
    row({ imdbId: 'ttHeldEarly', releaseDate: '2026-01-05', season: 'WINTER', userId: 'd', pickType: 'alt', draftPick: 4, profitTd: 15 }),
    row({ imdbId: 'ttEarly', releaseDate: '2026-01-05', season: 'WINTER', profitTd: 50 }),
    row({ imdbId: 'ttOnDay', releaseDate: '2026-01-31', season: 'WINTER', profitTd: 40 }),
    row({ imdbId: 'ttOpened', releaseDate: '2026-06-01', profitTd: 30 }),
    row({ imdbId: 'ttSoon', releaseDate: '2026-10-01', season: 'FALL' }),
    row({ imdbId: 'ttTba', releaseDate: 'TBA', season: 'FALL' }),
  ];

  function offeredWith(date) {
    return [
      ...yearReleasedCandidates(view(rows), date, today),
      ...yearUnreleasedCandidates(view(rows), date, today),
    ].map((movie) => movie.imdbId).sort();
  }

  it('offers every film of the year that opened on or after draft day', () => {
    expect(offeredWith(draftDate)).toEqual(['ttHeld', 'ttOnDay', 'ttOpened', 'ttSoon', 'ttTba']);
  });

  it('offers a film somebody else holds as a Season Pick', () => {
    expect(offeredWith(draftDate)).toContain('ttHeld');
  });

  it('never offers one of the ten, because they are the slots', () => {
    expect(offeredWith(draftDate)).not.toContain('ttHit');
    expect(offeredWith(draftDate)).not.toContain('ttBombHeld');
    expect(offeredWith(null)).not.toContain('ttHit');
    expect(offeredWith(null)).not.toContain('ttBombHeld');
  });

  it('still refuses a held film that had already opened on draft day', () => {
    expect(offeredWith(draftDate)).not.toContain('ttHeldEarly');
  });

  it('splits them on whether they have opened, not on Season', () => {
    expect(yearReleasedCandidates(view(rows), draftDate, today).map((m) => m.imdbId))
      .toEqual(['ttOnDay', 'ttOpened', 'ttHeld']);
    expect(yearUnreleasedCandidates(view(rows), draftDate, today).map((m) => m.imdbId))
      .toEqual(['ttSoon', 'ttTba']);
  });

  it('offers a film that opened earlier once the draft date moves back', () => {
    const offered = offeredWith('2026-01-01');
    expect(offered).toContain('ttEarly');
    expect(offered).toContain('ttHeldEarly');
  });

  it('offers everything but the ten when no draft date is set', () => {
    expect(offeredWith(null)).toEqual([
      'ttEarly', 'ttHeld', 'ttHeldEarly', 'ttOnDay', 'ttOpened', 'ttSoon', 'ttTba',
    ]);
  });

  it('sorts the opened ones by Profit and the rest by date', () => {
    expect(yearReleasedCandidates(view(rows), '2026-01-01', today).map((m) => m.profitTd))
      .toEqual([50, 40, 30, 15, 10]);
  });
});

describe('profitRanksEverySeason', () => {
  it('ranks each Movie within its own Season, in one lookup', () => {
    const rows = [
      row({ imdbId: 'ttW1', season: 'WINTER', profitTd: 10 }),
      row({ imdbId: 'ttW2', season: 'WINTER', profitTd: 90 }),
      row({ imdbId: 'ttF1', season: 'FALL', profitTd: 5 }),
    ];
    const ranks = profitRanksEverySeason(view(rows));
    expect(ranks.ttW2).toBe(1);
    expect(ranks.ttW1).toBe(2);
    expect(ranks.ttF1).toBe(1);
  });
});

// What a swap on this tab does to the rest of the page. The gesture is the
// store's, so these read the store's own `applyToRows` rather than the DOM.
describe('a year-long swap', () => {
  const users = [
    { userId: 'a', username: 'Ann' },
    { userId: 'b', username: 'Bob' },
    { userId: 'c', username: 'Cal' },
    { userId: 'd', username: 'Dee' },
    { userId: 'e', username: 'Eve' },
  ];

  function board() {
    return [
      row({ imdbId: 'ttHit', title: 'The Hit', pickType: 'hit', draftPick: 1, userId: 'a', username: 'Ann', season: 'SUMMER', profitTd: 400 }),
      row({ imdbId: 'ttBomb', title: 'The Bomb', pickType: 'bomb', draftPick: 7, userId: 'b', username: 'Bob', season: 'FALL', profitTd: -100 }),
      row({ imdbId: 'ttSeasonal', title: 'A Seasonal', pickType: 'seasonal', draftPick: 6, userId: 'c', username: 'Cal', season: 'WINTER', profitTd: 20 }),
      row({ imdbId: 'ttFree', title: 'Unheld', season: 'FALL', releaseDate: '2026-10-01' }),
    ];
  }

  function viewOfRows(rows, ghostSlots = []) {
    return { rows, ghostSlots, users, bombMode: 'split', publishedTotals: {} };
  }

  // Cross-type trading: a hit can become another User's bomb slot, and the
  // split then lands on the new holder's four opponents.
  it('moves the bomb split to the new holder when a hit takes a bomb slot', () => {
    const before = whatifStandings(viewOfRows(board()));
    // Ann holds the hit, so Ann is one of Bob's four opponents and carries a
    // quarter of the bomb.
    expect(before.find((entry) => entry.userId === 'a').total).toBe(400 - 25);

    const swapped = applyToRows(
      board(),
      [{ slotImdbId: 'ttHit', replacementImdbId: 'ttBomb', season: YEAR_TAB }],
      new Map(users.map((user) => [user.userId, user.username])),
    );

    const hit = swapped.rows.find((entry) => entry.imdbId === 'ttHit');
    const bomb = swapped.rows.find((entry) => entry.imdbId === 'ttBomb');
    expect(hit).toMatchObject({ userId: 'b', pickType: 'bomb', draftPick: 7 });
    expect(bomb).toMatchObject({ userId: 'a', pickType: 'hit', draftPick: 1 });

    const after = whatifStandings(viewOfRows(swapped.rows));
    // Bob now bombs the Hit's 400, so his four opponents each take 100 of it
    // and Bob takes none of it himself.
    expect(after.find((entry) => entry.userId === 'b').total).toBe(0);
    expect(after.find((entry) => entry.userId === 'd').total).toBe(100);
    expect(after.find((entry) => entry.userId === 'c').total).toBe(20 + 100);
    // Ann holds the old bomb as a hit now, so its 100 loss is hers alone and
    // the 100 she takes off Bob's bomb cancels it.
    expect(after.find((entry) => entry.userId === 'a').total).toBe(0);
  });

  it('leaves every Season leaderboard where it was', () => {
    const swapped = applyToRows(
      board(),
      [{ slotImdbId: 'ttHit', replacementImdbId: 'ttBomb', season: YEAR_TAB }],
      new Map(users.map((user) => [user.userId, user.username])),
    );

    for (const season of ['WINTER', 'SUMMER', 'FALL']) {
      const before = leaderboardForDraft(viewOfRows(board()), season)
        .map((entry) => [entry.userId, entry.total]);
      const after = leaderboardForDraft(viewOfRows(swapped.rows), season)
        .map((entry) => [entry.userId, entry.total]);
      expect(after).toEqual(before);
    }
  });

  // The film a swap frees belongs to its own Season's sidebar, which for a
  // year-long Pick is usually not Winter.
  it('frees the old Movie into its own Season sidebar', () => {
    const swapped = applyToRows(
      board(),
      [{ slotImdbId: 'ttHit', replacementImdbId: 'ttFree', season: YEAR_TAB }],
      new Map(users.map((user) => [user.userId, user.username])),
    );
    const after = viewOfRows(swapped.rows);

    const summer = unpickedUnreleasedForDraft(after, 'SUMMER', '2026-01-01').map((m) => m.imdbId);
    const winter = unpickedUnreleasedForDraft(after, 'WINTER', '2026-01-01').map((m) => m.imdbId);
    expect(summer).toContain('ttHit');
    expect(winter).not.toContain('ttHit');
  });

  // Trading a hit for a film somebody holds as a Season Pick, which is what the
  // widened pool makes possible (#89). The store already moves holder, Pick
  // type and Pick number together, so the trade lands on the Season board of
  // its own accord: nothing here is a year-tab special case.
  describe('a hit traded for a Season Pick', () => {
    function swapped() {
      return applyToRows(
        board(),
        [{ slotImdbId: 'ttHit', replacementImdbId: 'ttSeasonal', season: YEAR_TAB }],
        new Map(users.map((user) => [user.userId, user.username])),
      ).rows;
    }

    it("makes the Season Pick the hit holder's hit, at the Winter pick number", () => {
      const seasonal = swapped().find((entry) => entry.imdbId === 'ttSeasonal');
      expect(seasonal).toMatchObject({ userId: 'a', pickType: 'hit', draftPick: 1 });
    });

    it("makes the old hit the other holder's Season Pick, at their pick number", () => {
      const hit = swapped().find((entry) => entry.imdbId === 'ttHit');
      expect(hit).toMatchObject({ userId: 'c', pickType: 'seasonal', draftPick: 6 });
    });

    it('shows the old hit on its own Season board and in that leaderboard', () => {
      const after = viewOfRows(swapped());

      expect(picksForDraft(after, 'SUMMER').map((pick) => pick.imdbId)).toContain('ttHit');
      expect(leaderboardForDraft(after, 'SUMMER').find((entry) => entry.userId === 'c').total)
        .toBe(400);

      // The film that went the other way is a hit now, so the Winter board
      // still draws it but the Winter leaderboard no longer scores it.
      expect(leaderboardForDraft(after, 'WINTER').find((entry) => entry.userId === 'c').total)
        .toBe(0);
    });

    it("moves the two holders' Standings in opposite directions", () => {
      const before = whatifStandings(viewOfRows(board()));
      const after = whatifStandings(viewOfRows(swapped()));

      const totalFor = (standings, userId) =>
        standings.find((entry) => entry.userId === userId).total;

      // Ann's 400 hit and Cal's 20 seasonal trade places; the bomb's quarter
      // is unchanged on both sides of it.
      expect(totalFor(before, 'a')).toBe(400 - 25);
      expect(totalFor(after, 'a')).toBe(20 - 25);
      expect(totalFor(before, 'c')).toBe(20 - 25);
      expect(totalFor(after, 'c')).toBe(400 - 25);
    });
  });

  it('has a snapshot on the year tab that the animation can read', () => {
    // The animation is keyed by Season and the year tab is not one, so there
    // is nothing for it to tween. It has to answer rather than throw.
    const snapshot = snapshotForSeason(viewOfRows(board()), YEAR_TAB);
    expect(Object.keys(snapshot.profits)).toEqual([]);
    expect(Object.keys(snapshot.rois)).toEqual([]);
    expect(Object.values(snapshot.totals).every((total) => total === 0)).toBe(true);
  });
});
