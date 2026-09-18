import { describe, expect, it } from 'vitest';

import { roundHalfEven, whatifStandings } from './standings.js';

// A Board the way `buildDraftBoard` leaves it, trimmed to the fields the
// Standings read. Figures are small and deliberately land on halves: the
// rounding is the part of this that is easy to get subtly wrong.
function view(overrides = {}) {
  return {
    users: [
      { userId: 'a', username: 'Ann' },
      { userId: 'b', username: 'Bob' },
      { userId: 'c', username: 'Cal' },
    ],
    bombMode: 'split',
    publishedTotals: {},
    rows: [],
    ...overrides,
  };
}

function pick(userId, pickType, profitTd, imdbId = 'tt' + Math.random()) {
  return { imdbId, title: 'A Film', userId, pickType, profitTd };
}

describe('roundHalfEven', () => {
  // The processor rounds with Python's `round`, which breaks a tie to the even
  // integer. `Math.round` breaks it toward positive infinity, so these four
  // cases are the whole difference between the two.
  it('breaks a tie to the even integer', () => {
    expect(roundHalfEven(2.5)).toBe(2);
    expect(roundHalfEven(3.5)).toBe(4);
    expect(roundHalfEven(0.5)).toBe(0);
    expect(roundHalfEven(1.5)).toBe(2);
  });

  it('breaks a negative tie to the even integer too', () => {
    expect(roundHalfEven(-2.5)).toBe(-2);
    expect(roundHalfEven(-3.5)).toBe(-4);
    expect(roundHalfEven(-0.5)).toBe(0);
  });

  it('rounds anything that is not a tie to the nearer integer', () => {
    expect(roundHalfEven(2.4)).toBe(2);
    expect(roundHalfEven(2.6)).toBe(3);
    expect(roundHalfEven(-2.4)).toBe(-2);
    expect(roundHalfEven(-2.6)).toBe(-3);
    expect(roundHalfEven(7)).toBe(7);
  });
});

describe('whatifStandings', () => {
  it('gives every roster member a row, even with an empty Slate', () => {
    const rows = whatifStandings(view());
    expect(rows.map((row) => row.userId).sort()).toEqual(['a', 'b', 'c']);
  });

  it('adds up the holder own non-bomb Picks', () => {
    const rows = whatifStandings(view({
      rows: [pick('a', 'seasonal', 300), pick('a', 'hit', 200), pick('b', 'alt', 100)],
    }));
    expect(rows.map((row) => [row.userId, row.total])).toEqual([['a', 500], ['b', 100], ['c', 0]]);
  });

  it('ignores a Movie nobody holds and a Pick with no profit yet', () => {
    const rows = whatifStandings(view({
      rows: [pick('a', 'seasonal', 300), pick('a', 'seasonal', null), pick(null, null, 9999)],
    }));
    expect(rows[0].total).toBe(300);
  });

  // The picker is untouched by their own bomb: the profit lands on everybody
  // else, which is the whole of the rule.
  it('splits a bomb across the other roster members under split', () => {
    const rows = whatifStandings(view({
      rows: [pick('a', 'bomb', -300)],
    }));
    const byUser = Object.fromEntries(rows.map((row) => [row.userId, row.total]));
    expect(byUser).toEqual({ a: 0, b: -150, c: -150 });
  });

  // Savage gives every other User the whole figure rather than a share, and
  // anything that is not the literal `split` is savage, which is what upstream
  // does with an unknown value rather than refusing to score.
  it('gives every other roster member the whole bomb under savage', () => {
    const rows = whatifStandings(view({
      bombMode: 'savage',
      rows: [pick('a', 'bomb', -300)],
    }));
    const byUser = Object.fromEntries(rows.map((row) => [row.userId, row.total]));
    expect(byUser).toEqual({ a: 0, b: -300, c: -300 });
  });

  it('treats an unknown bomb mode as savage and still answers', () => {
    for (const bombMode of ['SPLIT', 'wildcard', null, undefined]) {
      const rows = whatifStandings(view({ bombMode, rows: [pick('a', 'bomb', -300)] }));
      const byUser = Object.fromEntries(rows.map((row) => [row.userId, row.total]));
      expect(byUser).toEqual({ a: 0, b: -300, c: -300 });
    }
  });

  it('skips a bomb on a one-User roster, where it has nobody to land on', () => {
    const rows = whatifStandings(view({
      users: [{ userId: 'a', username: 'Ann' }],
      rows: [pick('a', 'bomb', -300), pick('a', 'seasonal', 50)],
    }));
    expect(rows).toEqual([expect.objectContaining({ userId: 'a', total: 50 })]);
  });

  it('reads the pick type whatever case it is published in', () => {
    const rows = whatifStandings(view({ rows: [pick('a', 'BOMB', -300)] }));
    expect(Object.fromEntries(rows.map((row) => [row.userId, row.total]))).toEqual({ a: 0, b: -150, c: -150 });
  });

  // The two halves are rounded separately and only then added, which is what
  // the processor does (`UserFigures.rounded`). Half a dollar in each half
  // rounds to even twice and comes out at zero; the sum would have rounded to
  // one. Seam 1 compares the published total, so the order is not incidental.
  it('rounds the two halves separately rather than rounding their sum', () => {
    const rows = whatifStandings(view({
      rows: [pick('a', 'seasonal', 0.5), pick('b', 'bomb', 1)],
    }));
    // Ann: slate 0.5 → 0, bomb 1/2 = 0.5 → 0. Summed first it would be 1.
    expect(rows.find((row) => row.userId === 'a').total).toBe(0);
  });

  it('rounds each half half-to-even', () => {
    const rows = whatifStandings(view({
      users: [{ userId: 'a', username: 'Ann' }, { userId: 'b', username: 'Bob' }],
      rows: [pick('a', 'seasonal', 2.5), pick('a', 'seasonal', 1)],
    }));
    // Slate 3.5 → 4 under half-to-even and under Math.round; the negative is
    // where the two part ways.
    expect(rows.find((row) => row.userId === 'a').total).toBe(4);

    const negative = whatifStandings(view({
      users: [{ userId: 'a', username: 'Ann' }, { userId: 'b', username: 'Bob' }],
      rows: [pick('a', 'seasonal', -2.5)],
    }));
    // -2.5 is a tie: half-to-even gives -2, `Math.round` gives -2 as well, so
    // the case that separates them is the odd one.
    expect(negative.find((row) => row.userId === 'a').total).toBe(-2);

    const odd = whatifStandings(view({
      users: [{ userId: 'a', username: 'Ann' }, { userId: 'b', username: 'Bob' }],
      rows: [pick('a', 'seasonal', 4.5)],
    }));
    // 4.5 → 4 under half-to-even, 5 under `Math.round`.
    expect(odd.find((row) => row.userId === 'a').total).toBe(4);
  });

  it('sorts by the what-if total, highest first, ties on the name', () => {
    const rows = whatifStandings(view({
      rows: [pick('c', 'seasonal', 900)],
    }));
    expect(rows.map((row) => row.userId)).toEqual(['c', 'a', 'b']);
  });

  // One code path, whether or not the mode is on: the total is always the
  // computed one, never the published figure handed back. A renderer decides
  // what to say about the mode, and there is nothing here for it to switch on.
  it('reports the computed total even where the published one disagrees', () => {
    const rows = whatifStandings(view({
      publishedTotals: { a: 999 },
      rows: [pick('a', 'seasonal', 300)],
    }));
    expect(rows.find((row) => row.userId === 'a').total).toBe(300);
  });

  it('measures the delta against the published total', () => {
    const rows = whatifStandings(view({
      publishedTotals: { a: 250, b: 100, c: 0 },
      rows: [pick('a', 'seasonal', 300)],
    }));
    expect(rows.find((row) => row.userId === 'a')).toMatchObject({
      total: 300,
      publishedTotal: 250,
      delta: 50,
    });
  });

  it('leaves the delta and the rank change unknown for a User with no published total', () => {
    const rows = whatifStandings(view({
      publishedTotals: { a: 250 },
      rows: [pick('a', 'seasonal', 300)],
    }));
    expect(rows.find((row) => row.userId === 'b')).toMatchObject({
      publishedTotal: null,
      delta: null,
      rankChange: null,
    });
  });

  // Positive is a move up the table, which is a fall in the rank number.
  it('reports a rank change as places gained', () => {
    const rows = whatifStandings(view({
      publishedTotals: { a: 300, b: 200, c: 100 },
      rows: [pick('c', 'seasonal', 900)],
    }));
    const byUser = Object.fromEntries(rows.map((row) => [row.userId, row.rankChange]));
    expect(byUser).toEqual({ c: 2, a: -1, b: -1 });
  });

  it('reports no rank change when the swaps left the order alone', () => {
    const rows = whatifStandings(view({
      publishedTotals: { a: 300, b: 200, c: 100 },
      rows: [pick('a', 'seasonal', 300), pick('b', 'seasonal', 200), pick('c', 'seasonal', 100)],
    }));
    expect(rows.every((row) => row.rankChange === 0)).toBe(true);
  });
});
