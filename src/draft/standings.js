// What the overall Standings would be under the reader's what-if swaps (#88).
//
// This is the one place on the site that scores rather than renders. Everywhere
// else a figure on the page was computed upstream and published; a what-if
// total cannot be, because the swaps exist only in this browser and upstream
// has nothing to publish for them. So one league rule, the bomb split, lives
// here in a second language, and the arithmetic mirrors the processor's
// (`services/processor/src/processor/scoring.py`) closely enough to reproduce
// the published totals to the dollar when no swaps are applied.
//
// Pure: no DOM, and it reads a Board the what-if store has already swapped.

// The literal the processor checks `bomb_mode` against
// (`mbz_db.enums.BOMB_SPLIT`). Anything else is savage, including a value
// neither side knows: `bomb_mode` is an unconstrained string upstream, and
// mirroring the expression is the correct behaviour rather than a gap. No
// guard, and the page still draws.
const BOMB_SPLIT = 'split';

// Round half to even, which is what Python's `round` does and what
// `UserFigures.rounded` therefore rounds the published figures with.
// `Math.round` is not the same function: it breaks a tie toward positive
// infinity, so it differs from this on every odd half dollar. The bomb impact
// half lands on an exact half dollar for three of the five Users on today's
// data, so this is a live difference rather than a theoretical one.
export function roundHalfEven(value) {
  const floor = Math.floor(value);
  const fraction = value - floor;

  if (fraction < 0.5) return floor;
  if (fraction > 0.5) return floor + 1;

  // The tie. `floor` and `floor + 1` are one odd and one even, so the even one
  // is whichever of the two it is.
  return floor % 2 === 0 ? floor : floor + 1;
}

// Where a User is in a list of figures, highest first, as a 1-based place.
// Ties break on the name shown, the same way the Season leaderboard's do, so
// the order is one a reader could predict rather than one insertion happened to
// give.
function rankMap(entries) {
  const ordered = [...entries].sort((left, right) => {
    if (right.value !== left.value) return right.value - left.value;
    return String(left.username ?? left.userId).localeCompare(String(right.username ?? right.userId));
  });
  return new Map(ordered.map((entry, index) => [entry.userId, index + 1]));
}

export function whatifStandings(view, { enabled } = {}) {
  const users = view?.users || [];
  const roster = users.map((user) => user.userId);
  const published = view?.publishedTotals || {};

  // The two halves are kept apart all the way to the end, because rounding
  // them separately and adding the results is not the same as rounding their
  // sum, and the published figures are the first of those two.
  const slate = new Map(roster.map((userId) => [userId, 0]));
  const bombImpact = new Map(roster.map((userId) => [userId, 0]));

  for (const row of view?.rows || []) {
    // A Movie nobody holds, or one whose holder has left the roster: neither
    // has anywhere to land, and the second is the Board disagreeing with the
    // roster rather than a figure to invent a row for.
    if (row.userId == null || !slate.has(row.userId)) continue;

    // Profit is read off the Board, never recomputed: `profit_td` already nets
    // off `breakeven`, which is already the budget times the multiplier, so the
    // multiplier never reaches this calculation. A Movie with no profit yet
    // contributes nothing.
    const profit = row.profitTd;
    if (profit == null) continue;

    if (String(row.pickType ?? '').toLowerCase() !== 'bomb') {
      slate.set(row.userId, slate.get(row.userId) + profit);
      continue;
    }

    const others = roster.filter((userId) => userId !== row.userId);
    // A one-User roster, where a bomb has nobody to land on. The processor
    // skips it for the same reason: the divisor would be zero.
    if (!others.length) continue;

    const divisor = view?.bombMode === BOMB_SPLIT ? others.length : 1;
    const share = profit / divisor;
    for (const other of others) {
      bombImpact.set(other, bombImpact.get(other) + share);
    }
  }

  const totals = users.map((user) => ({
    userId: user.userId,
    username: user.username,
    // Both halves rounded, and only then added.
    total: roundHalfEven(slate.get(user.userId)) + roundHalfEven(bombImpact.get(user.userId)),
    publishedTotal: published[user.userId] ?? null,
  }));

  // Rank change is measured over the Users the Campaign actually published a
  // total for, on both sides. A User with no published figure has no place to
  // have moved from, so including them would shift everybody else's move by
  // however many of them there are.
  const scored = totals.filter((row) => row.publishedTotal !== null);
  const publishedRanks = rankMap(scored.map((row) => ({ ...row, value: row.publishedTotal })));
  const whatifRanks = rankMap(scored.map((row) => ({ ...row, value: row.total })));

  return totals
    .map((row) => ({
      ...row,
      delta: row.publishedTotal === null ? null : row.total - row.publishedTotal,
      // Positive is a move up the table, which is a fall in the place number.
      rankChange: row.publishedTotal === null
        ? null
        : publishedRanks.get(row.userId) - whatifRanks.get(row.userId),
      // Carried through so a renderer can say nothing rather than say zero when
      // nothing was measured.
      enabled: Boolean(enabled),
    }))
    .sort((left, right) => {
      if (right.total !== left.total) return right.total - left.total;
      return String(left.username ?? left.userId).localeCompare(String(right.username ?? right.userId));
    });
}
