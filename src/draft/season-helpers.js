// Which rows belong to a Season's draft, and what the page computes off them.
//
// Ported from the old site's `js/draft/season-helpers.js`, unchanged in what it
// decides. Two things did change, and both were the port settling what the page
// reads (#85): rows arrive as the Board's array rather than as `data.json`'s
// object keyed by IMDB id, and the leaderboard takes the roster rather than the
// five names the old file hardcoded.
//
// Pure: no fetching, no DOM.

// A Pick's draft belongs to the Season it was made in, which is not always the
// Season its Movie opens in. `hit` and `bomb` are picked once at the top of the
// year, so they sit on the Winter board whenever their Movie comes out.
export function draftSeason(row) {
  const type = (row.pickType || '').toLowerCase();
  if (type === 'hit' || type === 'bomb') return 'WINTER';
  return row.season;
}

// The two types a Season's leaderboard scores. A `hit` or a `bomb` is a
// year-long Pick shown on the Winter board for context; neither counts towards
// a Season's totals.
export function isSeasonalOrAlt(row) {
  const type = (row.pickType || '').toLowerCase();
  return type === 'seasonal' || type === 'alt';
}

// Every slot on this Season's board, in draft order, real Picks and the ghost
// slots what-if mode has emptied.
export function picksForDraft(view, season) {
  const real = view.rows.filter(
    (row) => row.draftPick != null && draftSeason(row) === season,
  );

  const ghosts = (view.ghostSlots || [])
    .filter((slot) => draftSeason(slot) === season)
    .map((slot) => ({
      imdbId: null,
      ghost: true,
      userId: slot.userId,
      username: slot.username,
      pickType: slot.pickType,
      draftPick: slot.draftPick,
      season: slot.season,
      title: '',
      releaseDate: null,
      profitTd: null,
      breakeven: null,
      clearedImdbId: slot.clearedImdbId,
      clearedTitle: slot.clearedTitle,
    }));

  return [...real, ...ghosts].sort((left, right) => left.draftPick - right.draftPick);
}

// One row per roster member, highest total first. Every member gets a row
// whether or not they hold anything on this board, so an empty Slate reads as
// an empty Slate. A holder the roster does not list still gets one, because the
// board is the authority on who holds what.
export function leaderboardForDraft(view, season) {
  const picks = picksForDraft(view, season).filter(isSeasonalOrAlt);

  const byUser = new Map();
  for (const user of view.users || []) {
    byUser.set(user.userId, { userId: user.userId, username: user.username, total: 0, picks: [] });
  }

  for (const pick of picks) {
    if (!byUser.has(pick.userId)) {
      byUser.set(pick.userId, {
        userId: pick.userId,
        username: pick.username ?? pick.userId,
        total: 0,
        picks: [],
      });
    }
    const row = byUser.get(pick.userId);
    row.picks.push(pick);
    if (pick.profitTd != null) row.total += pick.profitTd;
  }

  for (const row of byUser.values()) {
    row.picks.sort((left, right) => left.draftPick - right.draftPick);
  }

  // Ties break on the name shown, so the order a reader sees is the order they
  // could predict. Falls back to the id for a holder with no roster entry.
  return [...byUser.values()].sort((left, right) => {
    if (right.total !== left.total) return right.total - left.total;
    return String(left.username ?? left.userId).localeCompare(String(right.username ?? right.userId));
  });
}

// Where every Movie that opened in this Season placed on Profit, ties sharing a
// place. The pool is the whole Board, not the Picks: a Pick's rank is what says
// whether it beat the films nobody took.
export function profitRanksForSeason(view, season) {
  const scored = view.rows
    .filter((row) => row.season === season && row.profitTd != null)
    .sort((left, right) => right.profitTd - left.profitTd);

  const ranks = {};
  let lastProfit = null;
  let lastRank = 0;

  scored.forEach((row, index) => {
    if (row.profitTd === lastProfit) {
      ranks[row.imdbId] = lastRank;
    } else {
      lastRank = index + 1;
      lastProfit = row.profitTd;
      ranks[row.imdbId] = lastRank;
    }
  });

  return ranks;
}

function unheldInSeason(view, season) {
  return view.rows.filter((row) => row.season === season && row.userId === null);
}

// The candidates: Movies of this Season nobody took. Split by whether they have
// opened, because the two answer different questions — what a Slate missed, and
// what is still to come.
export function unpickedReleasedForDraft(view, season, today) {
  return unheldInSeason(view, season)
    .filter((row) => {
      if (!row.releaseDate || row.releaseDate === 'TBA') return false;
      if (row.releaseDate > today) return false;
      return row.profitTd != null;
    })
    .sort((left, right) => right.profitTd - left.profitTd);
}

export function unpickedUnreleasedForDraft(view, season, today) {
  return unheldInSeason(view, season)
    .filter((row) => {
      if (!row.releaseDate || row.releaseDate === 'TBA') return true;
      if (row.releaseDate > today) return true;
      return row.profitTd == null;
    })
    .sort((left, right) => {
      // An unknown date sorts last. `zzzz` is after every four-digit year, which
      // is the whole of the comparison these strings need.
      const leftDate = !left.releaseDate || left.releaseDate === 'TBA' ? 'zzzz' : left.releaseDate;
      const rightDate = !right.releaseDate || right.releaseDate === 'TBA' ? 'zzzz' : right.releaseDate;
      if (leftDate < rightDate) return -1;
      return leftDate > rightDate ? 1 : 0;
    });
}

// The Picks the highlights strip is computed from, and the same list the page
// gates on: nothing is shown until every holder has a Movie that has opened.
export function highlightsGatePicks(view, season) {
  return picksForDraft(view, season).filter(isSeasonalOrAlt);
}

export function highlightsForDraft(view, season) {
  const picks = highlightsGatePicks(view, season);
  const ranks = profitRanksForSeason(view, season);

  const ranked = picks.filter((pick) => pick.profitTd != null && ranks[pick.imdbId] != null);

  let steal = null;
  let bust = null;
  if (ranked.length >= 2) {
    // How far a Pick outran where it was taken. The best and worst of that gap
    // are the two ends of the same ordering.
    const byValue = [...ranked].sort(
      (left, right) =>
        (right.draftPick - ranks[right.imdbId]) - (left.draftPick - ranks[left.imdbId]),
    );
    const top = byValue[0];
    const bottom = byValue[byValue.length - 1];
    steal = {
      movie: top.title,
      userId: top.userId,
      username: top.username,
      draftPick: top.draftPick,
      profitRank: ranks[top.imdbId],
    };
    bust = {
      movie: bottom.title,
      userId: bottom.userId,
      username: bottom.username,
      draftPick: bottom.draftPick,
      profitRank: ranks[bottom.imdbId],
    };
  }

  let roi = null;
  const roiCandidates = picks.filter(
    (pick) => pick.profitTd != null && pick.breakeven != null && pick.breakeven > 0,
  );
  if (roiCandidates.length) {
    const best = [...roiCandidates].sort(
      (left, right) => (right.profitTd / right.breakeven) - (left.profitTd / left.breakeven),
    )[0];
    roi = {
      movie: best.title,
      userId: best.userId,
      username: best.username,
      ratio: best.profitTd / best.breakeven,
    };
  }

  const scored = picks.filter((pick) => pick.profitTd != null);
  let biggestWinner = null;
  let biggestLoser = null;
  if (scored.length) {
    const byProfit = [...scored].sort((left, right) => right.profitTd - left.profitTd);
    const winner = byProfit[0];
    const loser = byProfit[byProfit.length - 1];
    biggestWinner = {
      movie: winner.title, userId: winner.userId, username: winner.username, profit: winner.profitTd,
    };
    biggestLoser = {
      movie: loser.title, userId: loser.userId, username: loser.username, profit: loser.profitTd,
    };
  }

  // The narrowest spread between a Slate's best and worst, over the holders with
  // at least two scored Picks: one Pick has no spread to measure.
  const spreads = leaderboardForDraft(view, season)
    .filter((row) => row.picks.filter((pick) => pick.profitTd != null).length >= 2)
    .map((row) => {
      const profits = row.picks.filter((pick) => pick.profitTd != null).map((pick) => pick.profitTd);
      return {
        userId: row.userId,
        username: row.username,
        range: Math.max(...profits) - Math.min(...profits),
      };
    })
    .sort((left, right) => left.range - right.range);

  return {
    steal,
    bust,
    roi,
    mostConsistent: spreads[0] ?? null,
    biggestWinner,
    biggestLoser,
  };
}

// Whether the highlights strip has anything honest to say yet. Until every
// holder has a Movie that has opened, the tiles would rank Slates against each
// other on how many of their Picks happen to have come out.
export function everyHolderHasScored(picks) {
  const holders = new Map();
  for (const pick of picks) {
    if (!holders.has(pick.userId)) holders.set(pick.userId, false);
    if (pick.profitTd != null) holders.set(pick.userId, true);
  }
  if (holders.size === 0) return false;
  return [...holders.values()].every(Boolean);
}

// What the swap animation tweens between: every figure on the board that a swap
// can move, read once before the re-render and once after.
//
// It lives here rather than in the page because it is the same arithmetic the
// cells render, and the two have to agree: a tween lands where the snapshot
// says, and the next paint draws where the cell says. Keys are the ones the
// markup carries, so the page can look a figure up from the element it found.
//
// The totals come off the leaderboard rather than off the rows, so a year-long
// Pick shown on the Winter board for context does not count towards a Winter
// total the leaderboard never gave anybody.
export function snapshotForSeason(view, season) {
  const totals = {};
  for (const row of leaderboardForDraft(view, season)) totals[row.userId] = row.total;

  const profits = {};
  const rois = {};
  for (const pick of picksForDraft(view, season)) {
    // An emptied slot has no Movie in it, so there is nothing to travel between
    // and no id to key on.
    if (!pick.imdbId) continue;
    profits[pick.imdbId] = pick.profitTd ?? null;
    rois[pick.imdbId] = pick.profitTd != null && pick.breakeven
      ? (pick.profitTd / pick.breakeven) * 100
      : null;
  }

  return { totals, profits, rois };
}
