import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyToRows,
  getDraftDate,
  getState,
  hydrate,
  pushClear,
  pushSwap,
  reset,
  viewOf,
} from './whatif-store.js';

// The store writes through to `localStorage` on every change, which is the half
// of it that is not pure. A plain Map stands in, so a test can read back what
// the page would have stored and under which key.
function fakeStorage() {
  const entries = new Map();
  return {
    entries,
    getItem: (key) => (entries.has(key) ? entries.get(key) : null),
    setItem: (key, value) => entries.set(key, String(value)),
    removeItem: (key) => entries.delete(key),
  };
}

let storage;

beforeEach(() => {
  storage = fakeStorage();
  vi.stubGlobal('localStorage', storage);
});

function row(overrides = {}) {
  return {
    imdbId: 'tt0',
    title: 'A Movie',
    season: 'WINTER',
    profitTd: 0,
    breakeven: 100,
    userId: null,
    username: null,
    pickType: null,
    draftPick: null,
    ...overrides,
  };
}

const HELD = row({ imdbId: 'tt1', title: 'Held', profitTd: 100, userId: 'ann', username: 'Ann', pickType: 'seasonal', draftPick: 1 });
const UNHELD = row({ imdbId: 'tt2', title: 'Unheld', profitTd: 900 });

describe('applyToRows', () => {
  it('gives the Board back untouched when nothing has been swapped', () => {
    const rows = [HELD, UNHELD];
    expect(applyToRows(rows, [])).toEqual({ rows, ghostSlots: [] });
  });

  it('moves the holder onto the Movie that was swapped in', () => {
    const { rows } = applyToRows([HELD, UNHELD], [{ slotImdbId: 'tt1', replacementImdbId: 'tt2' }]);
    const swappedIn = rows.find((r) => r.imdbId === 'tt2');
    expect(swappedIn).toMatchObject({ userId: 'ann', pickType: 'seasonal', draftPick: 1 });
  });

  // The question the mode asks is what a Slate would have been worth holding a
  // different film, so the figures stay with the film they belong to.
  it('leaves each Movie’s own figures where they are', () => {
    const { rows } = applyToRows([HELD, UNHELD], [{ slotImdbId: 'tt1', replacementImdbId: 'tt2' }]);
    expect(rows.find((r) => r.imdbId === 'tt2').profitTd).toBe(900);
    expect(rows.find((r) => r.imdbId === 'tt1').profitTd).toBe(100);
  });

  it('leaves the Movie that was swapped out held by nobody', () => {
    const { rows } = applyToRows([HELD, UNHELD], [{ slotImdbId: 'tt1', replacementImdbId: 'tt2' }]);
    expect(rows.find((r) => r.imdbId === 'tt1')).toMatchObject({ userId: null, pickType: null, draftPick: null });
  });

  it('swaps two held slots over', () => {
    const other = row({ imdbId: 'tt3', userId: 'bo', username: 'Bo', pickType: 'alt', draftPick: 2 });
    const { rows } = applyToRows([HELD, other], [{ slotImdbId: 'tt1', replacementImdbId: 'tt3' }]);
    expect(rows.find((r) => r.imdbId === 'tt1').userId).toBe('bo');
    expect(rows.find((r) => r.imdbId === 'tt3').userId).toBe('ann');
  });

  // A cleared slot still exists in the draft order and can be filled again, so
  // it has to survive as something the board can render.
  it('leaves a ghost where a slot was cleared', () => {
    const { rows, ghostSlots } = applyToRows([HELD, UNHELD], [{ slotImdbId: 'tt1', replacementImdbId: null }]);
    expect(rows.find((r) => r.imdbId === 'tt1').userId).toBeNull();
    expect(ghostSlots).toEqual([{
      userId: 'ann', username: 'Ann', pickType: 'seasonal', draftPick: 1, season: 'WINTER',
      clearedImdbId: 'tt1', clearedTitle: 'Held',
    }]);
  });

  it('takes the ghost away once its slot is filled again', () => {
    const swaps = [
      { slotImdbId: 'tt1', replacementImdbId: null },
      {
        kind: 'fill',
        clearedImdbId: 'tt1',
        replacementImdbId: 'tt2',
        originalSlot: { userId: 'ann', pickType: 'seasonal', draftPick: 1 },
      },
    ];
    const { rows, ghostSlots } = applyToRows([HELD, UNHELD], swaps, new Map([['ann', 'Ann']]));
    expect(ghostSlots).toEqual([]);
    expect(rows.find((r) => r.imdbId === 'tt2')).toMatchObject({ userId: 'ann', username: 'Ann', draftPick: 1 });
  });

  // The stored swaps outlive a republish and a Campaign can lose a Movie, so
  // one swap naming a film the Board no longer carries must not take the
  // reader's other swaps with it.
  it('skips a swap naming a Movie the Board does not carry', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const other = row({ imdbId: 'tt3', userId: 'bo', username: 'Bo', pickType: 'alt', draftPick: 2 });
    const swaps = [
      { slotImdbId: 'tt1', replacementImdbId: 'gone' },
      { slotImdbId: 'tt3', replacementImdbId: 'tt2' },
    ];
    const { rows } = applyToRows([HELD, UNHELD, other], swaps);
    expect(rows.find((r) => r.imdbId === 'tt1').userId).toBe('ann');
    expect(rows.find((r) => r.imdbId === 'tt2').userId).toBe('bo');
  });

  it('keeps the Board in its own order', () => {
    const { rows } = applyToRows([HELD, UNHELD], [{ slotImdbId: 'tt1', replacementImdbId: 'tt2' }]);
    expect(rows.map((r) => r.imdbId)).toEqual(['tt1', 'tt2']);
  });
});

// The state is saved per Campaign, because the page is now one per year. Without
// it, 2026's swaps would land on 2027's board, where the identifiers name
// Movies that year never had.
describe('hydrate', () => {
  it('reads back the swaps saved for this Campaign', () => {
    hydrate({ leagueSlug: 'movieboyz', year: 2026 });
    pushSwap('tt1', 'tt2', 'WINTER');

    hydrate({ leagueSlug: 'movieboyz', year: 2026 });
    expect(getState().swaps).toEqual([{ slotImdbId: 'tt1', replacementImdbId: 'tt2', season: 'WINTER' }]);
  });

  it('does not read another year’s swaps', () => {
    hydrate({ leagueSlug: 'movieboyz', year: 2026 });
    pushSwap('tt1', 'tt2', 'WINTER');

    hydrate({ leagueSlug: 'movieboyz', year: 2027 });
    expect(getState().swaps).toEqual([]);
  });

  it('does not read another League’s swaps', () => {
    hydrate({ leagueSlug: 'movieboyz', year: 2026 });
    pushSwap('tt1', 'tt2', 'WINTER');

    hydrate({ leagueSlug: 'other', year: 2026 });
    expect(getState().swaps).toEqual([]);
  });

  // Nothing publishes a draft date. The seed is what stops what-if drafting a
  // film that had already opened, and it is the Campaign's own year rather than
  // the one year the old page was written for.
  it('seeds the draft date off the Campaign’s year', () => {
    hydrate({ leagueSlug: 'movieboyz', year: 2027 });
    expect(getDraftDate('WINTER')).toBe('2027-01-31');
  });

  // Once the key exists, an empty object is the reader having cleared the date
  // rather than never having set one.
  it('does not seed over a date the reader has cleared', () => {
    hydrate({ leagueSlug: 'movieboyz', year: 2026 });
    storage.setItem('mb_whatif_draft_dates:movieboyz:2026', '{}');

    hydrate({ leagueSlug: 'movieboyz', year: 2026 });
    expect(getDraftDate('WINTER')).toBeNull();
  });

  it('starts clean where the stored state is unreadable', () => {
    storage.setItem('mb_whatif_swaps:movieboyz:2026', 'not json');
    hydrate({ leagueSlug: 'movieboyz', year: 2026 });
    expect(getState().swaps).toEqual([]);
  });
});

describe('viewOf', () => {
  const board = {
    users: [{ userId: 'ann', username: 'Ann' }],
    rows: [HELD, UNHELD],
  };

  beforeEach(() => {
    hydrate({ leagueSlug: 'movieboyz', year: 2026 });
    reset();
  });

  it('is the Board itself before anything is swapped', () => {
    expect(viewOf(board).rows).toEqual(board.rows);
    expect(viewOf(board).ghostSlots).toEqual([]);
  });

  it('carries the Board’s own fields through', () => {
    expect(viewOf(board).users).toEqual(board.users);
  });

  it('is the Board as the reader’s swaps make it', () => {
    pushSwap('tt1', 'tt2', 'WINTER');
    expect(viewOf(board).rows.find((r) => r.imdbId === 'tt2').userId).toBe('ann');
  });

  it('names the holder of a filled slot off the roster', () => {
    pushClear('tt1', 'WINTER');
    expect(viewOf(board).ghostSlots[0]).toMatchObject({ userId: 'ann', username: 'Ann' });
  });
});
