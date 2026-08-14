// The Standings view model: the published Campaign artifact reshaped into the
// rows the page renders. Pure — no DOM, no fetching.
//
// The site renders Standings and never computes them (CONTEXT.md: Standings).
// Everything here is a read, a sort, or a join of figures the processor already
// published; no scoring rule is applied. `totalSeries` and `roi` are the two that
// do arithmetic, and both are noted where they are defined.

const MS_PER_DAY = 86400000;

function daysBetween(fromIso, toIso) {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  return Math.ceil((to - from) / MS_PER_DAY);
}

// The per-day total, which the artifact does not publish: `users[].total` is a
// single scalar for the latest scored day, while the chart needs a line. Summing
// the two published series is the same join the processor made to produce that
// scalar, and `agrees with the published total` in the tests holds it to it.
//
// Bomb Impact is held apart from Slate Profit precisely so a User's figure can be
// explained back to what moved it (CONTEXT.md: Bomb impact), so the two stay
// separate everywhere except here, where a single line is what is being drawn.
export function totalSeries(user) {
  const bombImpact = user.bomb_impact || {};
  const series = {};
  for (const [date, profit] of Object.entries(user.profit || {})) {
    series[date] = profit + (bombImpact[date] || 0);
  }
  return series;
}

function pickView(movie) {
  return {
    imdbId: movie.imdb_id,
    title: movie.title,
    pickType: movie.pick_type,
    // Published rather than re-derived from the release month: the Season a
    // Movie falls in is decided by the Campaign's own boundaries, which are the
    // processor's to apply (CONTEXT.md: Season).
    season: movie.season ?? null,
    releaseDate: movie.release_date,
    breakeven: movie.breakeven,
    grossTd: movie.gross_td,
    profitTd: movie.profit_td,
  };
}

// ROI over the Slate's own Picks. Bombs are excluded because their Profit lands
// on the other Users rather than on the picker, so charging their Breakeven to
// the picker would measure them against money they never stood to make.
function slateRoi(slateProfit, slate) {
  if (slateProfit === null || slateProfit === undefined) return null;
  const breakeven = slate
    .filter((movie) => movie.pick_type !== 'bomb')
    .reduce((sum, movie) => sum + (movie.breakeven || 0), 0);
  if (breakeven <= 0) return null;
  return (slateProfit / breakeven) * 100;
}

function byReleaseDate(a, b) {
  return a.releaseDate < b.releaseDate ? -1 : 1;
}

// Highest total first. A User with no total sorts last rather than to the top,
// which is where an undefined would otherwise land.
function byTotalDescending(a, b) {
  if (a.total === null && b.total === null) return 0;
  if (a.total === null) return 1;
  if (b.total === null) return -1;
  return b.total - a.total;
}

function valueAt(series, date) {
  const value = (series || {})[date];
  return value === undefined ? null : value;
}

export function buildStandings(campaign) {
  // The Standings are anchored on the latest scored day, not the latest gross
  // day. The two diverge when a capture lands gross that has not been scored
  // yet, and anchoring on the gross day would show a Pick as released while its
  // Profit still read as nothing.
  const latestDate = campaign.latest_profit_date;
  const usernames = new Map(
    (campaign.roster || []).map((member) => [member.user_id, member.username]),
  );

  const rows = (campaign.users || []).map((user) => {
    const slate = (campaign.movies || []).filter((movie) => movie.user_id === user.user_id);
    const slateProfit = valueAt(user.profit, latestDate);

    const released = slate
      .filter((movie) => movie.release_date && movie.release_date <= latestDate)
      .map(pickView)
      .sort(byReleaseDate);

    const upcoming = slate
      .filter((movie) => movie.release_date && movie.release_date > latestDate)
      .map(pickView)
      .sort(byReleaseDate);

    const [next = null] = upcoming;

    return {
      userId: user.user_id,
      username: usernames.get(user.user_id) ?? user.user_id,
      total: user.total ?? null,
      slateProfit,
      bombImpact: valueAt(user.bomb_impact, latestDate),
      roi: slateRoi(slateProfit, slate),
      released,
      releasedCount: released.length,
      pickCount: slate.length,
      nextPick: next && { ...next, daysUntil: daysBetween(latestDate, next.releaseDate) },
    };
  });

  rows.sort(byTotalDescending);
  rows.forEach((row, index) => {
    row.rank = index + 1;
  });

  return { latestDate, rows };
}
