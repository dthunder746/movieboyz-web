// One year's Standings, as an expanded card shows them. Pure: no DOM, no
// fetching.
//
// This is the ranking and nothing else. The Campaign page's own Standings are a
// wider surface: they join the Board against the Movie slices for each Pick's
// gross and its audience, and a landing card that did the same would fetch a
// megabyte of Movie facts to draw eight rows. So the card reads the Campaign
// artifact alone, and the Board is one click away on the card's own link.
//
// It does not import `campaign/standings.js` for the same reason that module
// does not import this one. A page group depends on `shared` and on nothing
// beside it (spec #58, decision 24), and the two builders answer different
// questions off the same file. The sort is what they have in common, and six
// lines duplicated beats a dependency that misstates which page owns what.

// Highest total first. A User with no published total sorts last rather than to
// the top, which is where an absent figure would otherwise land.
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

export function buildYearStandings(campaign) {
  // The latest scored day, not the latest gross day. The two part whenever the
  // Board moves on a day the Standings do not, and reading the series at the
  // gross day would show a blank where a figure belongs.
  const latestDate = campaign?.latest_profit_date ?? null;

  const usernames = new Map(
    (campaign?.roster ?? []).map((member) => [member.user_id, member.username]),
  );

  // A Board carries every Movie in play for the year whether or not anybody
  // picked it, so the Pick is the row that names a User.
  const picks = new Map();
  for (const movie of campaign?.movies ?? []) {
    if (!movie.user_id) continue;
    picks.set(movie.user_id, (picks.get(movie.user_id) ?? 0) + 1);
  }

  const rows = (campaign?.users ?? []).map((user) => ({
    userId: user.user_id,
    username: usernames.get(user.user_id) ?? user.user_id,
    total: user.total ?? null,
    // Held apart, as they are everywhere else: a bomb's Profit lands on every
    // Rostered User except the one who picked it, and a single combined figure
    // could not be explained back to what moved it (CONTEXT.md: Bomb impact).
    slateProfit: valueAt(user.profit, latestDate),
    bombImpact: valueAt(user.bomb_impact, latestDate),
    // Published, not derived. Excluding a bomb's Breakeven from its picker's
    // denominator is a scoring rule, and rules live in the processor
    // (ADR 0003). Absent on an artifact written before the field existed,
    // which reads the same way as a Slate with nothing to divide by.
    roi: user.slate_roi ?? null,
    pickCount: picks.get(user.user_id) ?? 0,
  }));

  rows.sort(byTotalDescending);
  rows.forEach((row, index) => {
    row.rank = index + 1;
  });

  return { latestDate, rows };
}
