import { describe, expect, it } from 'vitest';

import {
  draftSeason,
  everyHolderHasScored,
  highlightsForDraft,
  highlightsGatePicks,
  isSeasonalOrAlt,
  leaderboardForDraft,
  picksForDraft,
  profitRanksForSeason,
  snapshotForSeason,
  unpickedReleasedForDraft,
  unpickedUnreleasedForDraft,
} from './season-helpers.js';

function row(overrides = {}) {
  return {
    imdbId: 'tt0',
    title: 'A Movie',
    releaseDate: '2026-02-01',
    season: 'WINTER',
    breakeven: 100,
    profitTd: null,
    userId: null,
    username: null,
    pickType: null,
    draftPick: null,
    ...overrides,
  };
}

function view(rows, { users = [], ghostSlots = [] } = {}) {
  return { rows, users, ghostSlots };
}

// A Pick's draft belongs to the Season it was made in, which is not always the
// Season its Movie opens in.
describe('draftSeason', () => {
  it('is the Season the Movie opens in for a seasonal Pick', () => {
    expect(draftSeason(row({ pickType: 'seasonal', season: 'FALL' }))).toBe('FALL');
  });

  // Both are picked once at the top of the year, so they sit on the Winter
  // board whenever their Movie comes out.
  it('is Winter for a year-long Pick whatever Season it opens in', () => {
    expect(draftSeason(row({ pickType: 'hit', season: 'SUMMER' }))).toBe('WINTER');
    expect(draftSeason(row({ pickType: 'bomb', season: 'FALL' }))).toBe('WINTER');
  });

  it('reads the type whatever case the artifact wrote it in', () => {
    expect(draftSeason(row({ pickType: 'HIT', season: 'FALL' }))).toBe('WINTER');
  });
});

describe('isSeasonalOrAlt', () => {
  it('is the two types a Season is scored on', () => {
    expect(isSeasonalOrAlt(row({ pickType: 'seasonal' }))).toBe(true);
    expect(isSeasonalOrAlt(row({ pickType: 'alt' }))).toBe(true);
  });

  // Shown on the Winter board for context, but not counted towards it.
  it('is not the year-long types', () => {
    expect(isSeasonalOrAlt(row({ pickType: 'hit' }))).toBe(false);
    expect(isSeasonalOrAlt(row({ pickType: 'bomb' }))).toBe(false);
    expect(isSeasonalOrAlt(row({ pickType: null }))).toBe(false);
  });
});

describe('picksForDraft', () => {
  const rows = [
    row({ imdbId: 'tt2', pickType: 'seasonal', season: 'WINTER', userId: 'a', draftPick: 2 }),
    row({ imdbId: 'tt1', pickType: 'seasonal', season: 'WINTER', userId: 'b', draftPick: 1 }),
    row({ imdbId: 'tt3', pickType: 'seasonal', season: 'SUMMER', userId: 'a', draftPick: 3 }),
    row({ imdbId: 'tt4', pickType: 'hit', season: 'SUMMER', userId: 'b', draftPick: 4 }),
    row({ imdbId: 'tt9' }),
  ];

  it('is this Season’s slots in the order they were taken', () => {
    expect(picksForDraft(view(rows), 'WINTER').map((pick) => pick.imdbId)).toEqual(['tt1', 'tt2', 'tt4']);
  });

  it('leaves out the Movies nobody drafted', () => {
    expect(picksForDraft(view(rows), 'SUMMER').map((pick) => pick.imdbId)).toEqual(['tt3']);
  });

  // A cleared slot keeps its place in the draft order so it can be filled
  // again, which is why it survives as a row rather than disappearing.
  it('keeps an emptied slot in its place in the order', () => {
    const ghost = {
      userId: 'a', username: 'A', pickType: 'seasonal', draftPick: 2, season: 'WINTER',
      clearedImdbId: 'tt2', clearedTitle: 'Cleared',
    };
    const picks = picksForDraft(view([rows[1]], { ghostSlots: [ghost] }), 'WINTER');
    expect(picks.map((pick) => pick.draftPick)).toEqual([1, 2]);
    expect(picks[1]).toMatchObject({ ghost: true, imdbId: null, clearedImdbId: 'tt2' });
  });
});

describe('leaderboardForDraft', () => {
  const users = [{ userId: 'a', username: 'Ann' }, { userId: 'b', username: 'Bo' }];
  const rows = [
    row({ imdbId: 'tt1', pickType: 'seasonal', userId: 'a', draftPick: 1, profitTd: 300 }),
    row({ imdbId: 'tt2', pickType: 'alt', userId: 'a', draftPick: 3, profitTd: 200 }),
    row({ imdbId: 'tt3', pickType: 'seasonal', userId: 'b', draftPick: 2, profitTd: 100 }),
    // Shown on the board, not counted towards it.
    row({ imdbId: 'tt4', pickType: 'hit', userId: 'b', draftPick: 4, profitTd: 9000 }),
  ];

  it('totals the Season Picks and puts the highest first', () => {
    expect(leaderboardForDraft(view(rows, { users }), 'WINTER').map((r) => [r.userId, r.total]))
      .toEqual([['a', 500], ['b', 100]]);
  });

  it('leaves the year-long Picks out of the total', () => {
    const bo = leaderboardForDraft(view(rows, { users }), 'WINTER').find((r) => r.userId === 'b');
    expect(bo.picks.map((pick) => pick.imdbId)).toEqual(['tt3']);
  });

  // An empty Slate has to read as an empty Slate rather than as somebody who is
  // not playing.
  it('gives a member holding nothing a row of their own', () => {
    const board = leaderboardForDraft(view([rows[0]], { users }), 'WINTER');
    expect(board.map((r) => [r.userId, r.total])).toEqual([['a', 300], ['b', 0]]);
  });

  // The Board is the authority on who holds what, so a holder the roster has
  // dropped is still scored.
  it('scores a holder the roster does not list', () => {
    const board = leaderboardForDraft(view(rows, { users: [users[0]] }), 'WINTER');
    expect(board.find((r) => r.userId === 'b')).toMatchObject({ total: 100, username: 'b' });
  });

  it('orders a Slate’s own Picks by when they were taken', () => {
    const ann = leaderboardForDraft(view(rows, { users }), 'WINTER').find((r) => r.userId === 'a');
    expect(ann.picks.map((pick) => pick.draftPick)).toEqual([1, 3]);
  });

  // Ties break on the name shown, so the order a reader sees is one they could
  // predict rather than the order the artifact happened to list.
  it('breaks a tie on the name', () => {
    const tied = [
      row({ imdbId: 'tt1', pickType: 'seasonal', userId: 'b', draftPick: 1, profitTd: 100 }),
      row({ imdbId: 'tt2', pickType: 'seasonal', userId: 'a', draftPick: 2, profitTd: 100 }),
    ];
    // Listed against the name order, so a leaderboard that simply kept the
    // roster's order would read Bo first.
    const listedBoFirst = [{ userId: 'b', username: 'Bo' }, { userId: 'a', username: 'Ann' }];
    expect(leaderboardForDraft(view(tied, { users: listedBoFirst }), 'WINTER').map((r) => r.username))
      .toEqual(['Ann', 'Bo']);
  });

  it('counts a Pick that has not opened as nothing rather than as a gap', () => {
    const unopened = [row({ imdbId: 'tt1', pickType: 'seasonal', userId: 'a', draftPick: 1, profitTd: null })];
    expect(leaderboardForDraft(view(unopened, { users }), 'WINTER')[0].total).toBe(0);
  });
});

// A Pick's rank is what says whether it beat the films nobody took, so the pool
// is the whole Board rather than the Picks.
describe('profitRanksForSeason', () => {
  const rows = [
    row({ imdbId: 'tt1', profitTd: 300, userId: 'a', pickType: 'seasonal', draftPick: 1 }),
    row({ imdbId: 'tt2', profitTd: 500 }),
    row({ imdbId: 'tt3', profitTd: 300 }),
    row({ imdbId: 'tt4', profitTd: 100 }),
    row({ imdbId: 'tt5', profitTd: null }),
    row({ imdbId: 'tt6', profitTd: 900, season: 'SUMMER' }),
  ];

  it('ranks every Movie of the Season, held or not', () => {
    expect(profitRanksForSeason(view(rows), 'WINTER')).toEqual({
      tt2: 1, tt1: 2, tt3: 2, tt4: 4,
    });
  });

  it('ranks a Movie against its own Season only', () => {
    expect(profitRanksForSeason(view(rows), 'SUMMER')).toEqual({ tt6: 1 });
  });

  it('does not rank a Movie that has not opened', () => {
    expect(profitRanksForSeason(view(rows), 'WINTER').tt5).toBeUndefined();
  });
});

// The candidates: Movies of this Season nobody took, split by whether they have
// opened, because the two answer different questions.
describe('unpickedReleasedForDraft', () => {
  const today = '2026-03-01';
  const rows = [
    row({ imdbId: 'tt1', profitTd: 100, releaseDate: '2026-02-01' }),
    row({ imdbId: 'tt2', profitTd: 400, releaseDate: '2026-01-01' }),
    row({ imdbId: 'tt3', profitTd: 900, releaseDate: '2026-02-01', userId: 'a', pickType: 'seasonal', draftPick: 1 }),
    row({ imdbId: 'tt4', profitTd: null, releaseDate: '2026-02-01' }),
    row({ imdbId: 'tt5', profitTd: 700, releaseDate: '2026-06-01' }),
  ];

  it('is the unheld Movies that have opened, richest first', () => {
    expect(unpickedReleasedForDraft(view(rows), 'WINTER', today).map((r) => r.imdbId))
      .toEqual(['tt2', 'tt1']);
  });

  it('leaves out a Movie somebody holds', () => {
    expect(unpickedReleasedForDraft(view(rows), 'WINTER', today).map((r) => r.imdbId))
      .not.toContain('tt3');
  });

  // The two lists are complements, so a Movie that opens later today belongs to
  // the other one rather than to neither.
  it('leaves out a Movie that has not opened yet', () => {
    expect(unpickedReleasedForDraft(view(rows), 'WINTER', today).map((r) => r.imdbId))
      .not.toContain('tt5');
  });
});

describe('unpickedUnreleasedForDraft', () => {
  const today = '2026-03-01';
  const rows = [
    row({ imdbId: 'tt1', profitTd: null, releaseDate: '2026-04-01' }),
    row({ imdbId: 'tt2', profitTd: null, releaseDate: 'TBA' }),
    row({ imdbId: 'tt3', profitTd: null, releaseDate: '2026-03-15' }),
    row({ imdbId: 'tt4', profitTd: 100, releaseDate: '2026-02-01' }),
    row({ imdbId: 'tt5', profitTd: null, releaseDate: '2026-04-01', userId: 'a', pickType: 'seasonal', draftPick: 1 }),
  ];

  it('is the unheld Movies still to come, soonest first', () => {
    expect(unpickedUnreleasedForDraft(view(rows), 'WINTER', today).map((r) => r.imdbId))
      .toEqual(['tt3', 'tt1', 'tt2']);
  });

  // A Movie that has opened but has no Profit yet is still waiting on a figure,
  // so it belongs here rather than in a released list with a blank against it.
  it('sorts a Movie with no date at all after the dated ones', () => {
    const undated = [
      row({ imdbId: 'tt1', profitTd: null, releaseDate: null }),
      row({ imdbId: 'tt2', profitTd: null, releaseDate: '2026-04-01' }),
    ];
    expect(unpickedUnreleasedForDraft(view(undated), 'WINTER', today).map((r) => r.imdbId))
      .toEqual(['tt2', 'tt1']);
  });

  it('carries a Movie that has opened with no figure against it', () => {
    const noFigure = [row({ imdbId: 'tt9', profitTd: null, releaseDate: '2026-02-01' })];
    expect(unpickedUnreleasedForDraft(view(noFigure), 'WINTER', today).map((r) => r.imdbId))
      .toEqual(['tt9']);
  });

  it('leaves out a Movie somebody holds', () => {
    expect(unpickedUnreleasedForDraft(view(rows), 'WINTER', today).map((r) => r.imdbId))
      .not.toContain('tt5');
  });
});

// Whether the highlights strip has anything honest to say yet.
describe('everyHolderHasScored', () => {
  it('is true once every holder has a Movie that has opened', () => {
    expect(everyHolderHasScored([
      row({ userId: 'a', profitTd: 1 }),
      row({ userId: 'b', profitTd: -1 }),
    ])).toBe(true);
  });

  it('is false while a holder has nothing that has opened', () => {
    expect(everyHolderHasScored([
      row({ userId: 'a', profitTd: 1 }),
      row({ userId: 'b', profitTd: null }),
    ])).toBe(false);
  });

  it('is true for a holder whose other Pick has opened', () => {
    expect(everyHolderHasScored([
      row({ userId: 'a', profitTd: null }),
      row({ userId: 'a', profitTd: 5 }),
    ])).toBe(true);
  });

  it('is false where nobody holds anything', () => {
    expect(everyHolderHasScored([])).toBe(false);
  });
});

describe('highlightsForDraft', () => {
  const users = [{ userId: 'a', username: 'Ann' }, { userId: 'b', username: 'Bo' }];
  // Ann took the Season's best film last; Bo took its worst first.
  const rows = [
    row({ imdbId: 'tt1', title: 'Steal', pickType: 'seasonal', userId: 'a', username: 'Ann', draftPick: 4, profitTd: 900, breakeven: 100 }),
    row({ imdbId: 'tt2', title: 'Bust', pickType: 'seasonal', userId: 'b', username: 'Bo', draftPick: 1, profitTd: -200, breakeven: 400 }),
    row({ imdbId: 'tt3', title: 'Middling', pickType: 'alt', userId: 'a', username: 'Ann', draftPick: 2, profitTd: 500, breakeven: 500 }),
    row({ imdbId: 'tt4', title: 'Also Middling', pickType: 'alt', userId: 'b', username: 'Bo', draftPick: 3, profitTd: 300, breakeven: 300 }),
  ];
  const board = view(rows, { users });

  it('names the Pick that most outran where it was taken', () => {
    expect(highlightsForDraft(board, 'WINTER').steal).toMatchObject({ movie: 'Steal', userId: 'a', draftPick: 4 });
  });

  it('names the Pick that most fell short of where it was taken', () => {
    expect(highlightsForDraft(board, 'WINTER').bust).toMatchObject({ movie: 'Bust', userId: 'b', draftPick: 1 });
  });

  // The measure is how far a Pick outran where it was taken, not how much it
  // made. Here the richest film was taken early and the steal is the one taken
  // last, so a highlight ranked on Profit alone would name the wrong two.
  it('measures the gap between the Pick and the rank, not the Profit', () => {
    const gapped = view([
      row({ imdbId: 'tt1', title: 'Rich, Taken Early', pickType: 'seasonal', userId: 'a', draftPick: 2, profitTd: 1000 }),
      row({ imdbId: 'tt2', title: 'Steal', pickType: 'seasonal', userId: 'b', draftPick: 4, profitTd: 500 }),
      row({ imdbId: 'tt3', title: 'Bust', pickType: 'seasonal', userId: 'a', draftPick: 1, profitTd: 200 }),
      row({ imdbId: 'tt4', title: 'Poorest, Taken Late', pickType: 'seasonal', userId: 'b', draftPick: 3, profitTd: 100 }),
    ], { users });

    const highlights = highlightsForDraft(gapped, 'WINTER');
    expect(highlights.steal.movie).toBe('Steal');
    expect(highlights.bust.movie).toBe('Bust');
  });

  it('names the best Profit against Breakeven', () => {
    expect(highlightsForDraft(board, 'WINTER').roi).toMatchObject({ movie: 'Steal', ratio: 9 });
  });

  it('names the highest and the lowest single Pick', () => {
    const highlights = highlightsForDraft(board, 'WINTER');
    expect(highlights.biggestWinner).toMatchObject({ movie: 'Steal', profit: 900 });
    expect(highlights.biggestLoser).toMatchObject({ movie: 'Bust', profit: -200 });
  });

  // The narrowest spread between a Slate's best and worst.
  it('names the Slate whose Picks sit closest together', () => {
    // Ann's two sit 400 apart, Bo's 500.
    expect(highlightsForDraft(board, 'WINTER').mostConsistent).toMatchObject({ userId: 'a', range: 400 });
  });

  // One Pick has no spread to measure, so a Slate holding one is not in the
  // running rather than winning with a range of zero.
  it('leaves a Slate with a single scored Pick out of the spread', () => {
    const single = view([rows[0], rows[1]], { users });
    expect(highlightsForDraft(single, 'WINTER').mostConsistent).toBeNull();
  });

  // Two Picks are the fewest that can be ranked against each other.
  it('has no steal or bust from a single scored Pick', () => {
    const one = view([rows[0]], { users });
    expect(highlightsForDraft(one, 'WINTER').steal).toBeNull();
    expect(highlightsForDraft(one, 'WINTER').bust).toBeNull();
  });

  it('has no ROI where nothing carries a Breakeven', () => {
    const noBreakeven = view(rows.map((r) => ({ ...r, breakeven: null })), { users });
    expect(highlightsForDraft(noBreakeven, 'WINTER').roi).toBeNull();
  });
});

// The same list the page gates on, so what is measured and what unlocks the
// strip cannot drift apart.
describe('highlightsGatePicks', () => {
  it('is the Season Picks and not the year-long ones', () => {
    const rows = [
      row({ imdbId: 'tt1', pickType: 'seasonal', userId: 'a', draftPick: 1 }),
      row({ imdbId: 'tt2', pickType: 'hit', userId: 'b', draftPick: 2 }),
    ];
    expect(highlightsGatePicks(view(rows), 'WINTER').map((pick) => pick.imdbId)).toEqual(['tt1']);
  });
});

// What the swap animation tweens between. It is read once before a re-render
// and once after, so every figure the animation touches has to be in it and
// keyed the way the rendered markup is.
describe('snapshotForSeason', () => {
  const rows = [
    row({ imdbId: 'tt1', userId: 'marcus', username: 'Marcus', pickType: 'seasonal', draftPick: 1, profitTd: 300, breakeven: 100 }),
    row({ imdbId: 'tt2', userId: 'connie', username: 'Connie', pickType: 'alt', draftPick: 2, profitTd: -50, breakeven: 200 }),
  ];
  const users = [
    { userId: 'marcus', username: 'Marcus' },
    { userId: 'connie', username: 'Connie' },
  ];

  it('carries a total per User, keyed the way the cards are', () => {
    const snapshot = snapshotForSeason(view(rows, { users }), 'WINTER');
    expect(snapshot.totals).toEqual({ marcus: 300, connie: -50 });
  });

  it('carries a Profit per Pick, keyed the way the rows are', () => {
    const snapshot = snapshotForSeason(view(rows, { users }), 'WINTER');
    expect(snapshot.profits).toEqual({ tt1: 300, tt2: -50 });
  });

  // The same arithmetic the ROI cell renders, so the tween lands on the figure
  // the next render draws rather than near it.
  it('carries ROI as a percentage of Breakeven', () => {
    const snapshot = snapshotForSeason(view(rows, { users }), 'WINTER');
    expect(snapshot.rois).toEqual({ tt1: 300, tt2: -25 });
  });

  // A Movie that has not opened has no Profit and so no ROI. Null rather than
  // zero, because the tween skips a figure it cannot travel between and zero
  // would have it count down from a number nothing ever showed.
  it('has no ROI for a Pick with no Profit yet', () => {
    const unreleased = [row({ imdbId: 'tt3', userId: 'marcus', pickType: 'seasonal', draftPick: 1, profitTd: null, breakeven: 100 })];
    const snapshot = snapshotForSeason(view(unreleased, { users }), 'WINTER');
    expect(snapshot.profits.tt3).toBeNull();
    expect(snapshot.rois.tt3).toBeNull();
  });

  // A Breakeven of zero is a division the ROI cell refuses too.
  it('has no ROI for a Pick with no Breakeven', () => {
    const noBreakeven = [row({ imdbId: 'tt4', userId: 'marcus', pickType: 'seasonal', draftPick: 1, profitTd: 300, breakeven: 0 })];
    expect(snapshotForSeason(view(noBreakeven, { users }), 'WINTER').rois.tt4).toBeNull();
  });

  // An emptied slot is a row on the board with no Movie in it. It has nothing
  // to tween and no id to key on, so it is not in the snapshot at all.
  it('leaves out an emptied slot', () => {
    const ghostSlots = [{ userId: 'marcus', username: 'Marcus', pickType: 'seasonal', draftPick: 3, season: 'WINTER' }];
    const snapshot = snapshotForSeason(view(rows, { users, ghostSlots }), 'WINTER');
    expect(Object.keys(snapshot.profits)).toEqual(['tt1', 'tt2']);
    expect(Object.keys(snapshot.rois)).toEqual(['tt1', 'tt2']);
  });

  // The leaderboard scores the Season's own Picks, so the totals follow it
  // rather than the rows: a year-long Pick sits on the Winter board without
  // counting towards anybody's Winter total.
  it('totals only what the leaderboard scores', () => {
    const withHit = [
      ...rows,
      row({ imdbId: 'tt5', userId: 'marcus', username: 'Marcus', pickType: 'hit', draftPick: 3, profitTd: 900, breakeven: 100 }),
    ];
    expect(snapshotForSeason(view(withHit, { users }), 'WINTER').totals.marcus).toBe(300);
  });
});
