// The Standings view model: the published Campaign artifact reshaped into the
// rows the page renders. Pure: no DOM, no fetching.
//
// The site renders Standings and never computes them (CONTEXT.md: Standings).
// Everything here is a read, a sort, or a join of figures the processor already
// published; no scoring rule is applied. `totalSeries` is the one thing left
// that does arithmetic, and it is a presentational derivation rather than a
// rule: the Slate ROI used to live here too and moved upstream in #55, because
// its bomb exclusion was a scoring rule and ADR 0003 keeps those in one place.

import { usernameMap } from './board.js';
import { daysBetween } from './format.js';

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

// Gross comes off the Board rather than the Campaign artifact. ADR 0008 moved
// it to the Movie slice, because gross is the same figure for every League
// reading the same Movie; only the scoring around it belongs to a Campaign.
function pickView(movie, boardRow) {
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
    grossTd: boardRow ? boardRow.grossTd : null,
    profitTd: movie.profit_td,
  };
}

// The scorecard's audience figure. Letterboxd alone, because that is the one
// the league watches, and only across Picks that have opened: days running is
// what says a Movie has been measured at all, so a Pick without it has no
// audience to average in yet.
function avgLetterboxd(slate, byId) {
  const scores = slate
    .map((movie) => byId.get(movie.imdb_id))
    .filter((row) => row && row.daysRunning !== null && row.daysRunning !== undefined)
    .map((row) => row.ratings?.letterboxd?.score)
    .filter((score) => score !== null && score !== undefined);

  if (scores.length === 0) return null;
  return scores.reduce((sum, score) => sum + score, 0) / scores.length;
}

// A Pick the Campaign can place in time. 'TBA' is a date-shaped string that
// sorts above every real one, so an undated Pick left in would become the next
// release and count down to a date that is not one. The Board rule should keep
// these off a Campaign now, but the old site excluded them explicitly and the
// rest of the port stays tolerant of one arriving.
function dated(movie) {
  return Boolean(movie.release_date) && movie.release_date !== 'TBA';
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

// The Board is the second argument because the Standings straddle the ADR 0008
// split: scored figures come off the Campaign artifact, measurements off the
// Movie slice, and only the Board has both.
export function buildStandings(campaign, board) {
  const byId = board?.byId ?? new Map();
  // The Standings are anchored on the latest scored day, not the latest gross
  // day. The two diverge when a capture lands gross that has not been scored
  // yet, and anchoring on the gross day would show a Pick as released while its
  // Profit still read as nothing.
  const latestDate = campaign.latest_profit_date;
  const usernames = usernameMap(campaign);

  const rows = (campaign.users || []).map((user) => {
    const slate = (campaign.movies || []).filter((movie) => movie.user_id === user.user_id);
    const slateProfit = valueAt(user.profit, latestDate);

    const released = slate
      .filter((movie) => dated(movie) && movie.release_date <= latestDate)
      .map((movie) => pickView(movie, byId.get(movie.imdb_id)))
      .sort(byReleaseDate);

    const upcoming = slate
      .filter((movie) => dated(movie) && movie.release_date > latestDate)
      .map((movie) => pickView(movie, byId.get(movie.imdb_id)))
      .sort(byReleaseDate);

    const [next = null] = upcoming;

    return {
      userId: user.user_id,
      username: usernames.get(user.user_id) ?? user.user_id,
      total: user.total ?? null,
      slateProfit,
      bombImpact: valueAt(user.bomb_impact, latestDate),
      // Published, not derived. Excluding a bomb's Breakeven from the
      // denominator is a scoring rule, so it belongs where the rest of them
      // are (`processor.scoring.slate_roi`, ADR 0003) rather than in a
      // renderer. Null on an artifact written before the field existed, which
      // reads the same way as a Slate with nothing to divide by (#55).
      roi: user.slate_roi ?? null,
      avgLetterboxd: avgLetterboxd(slate, byId),
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
