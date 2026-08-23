// The mega league: a League read across every Campaign it has run, as the
// landing page's left-hand table. Pure: no DOM, no fetching.
//
// A Mega league is a view rather than a thing that is configured (CONTEXT.md),
// and every figure in it is summed in the projection and published on the
// landing artifact. Nothing here adds anything up. The whole module is a rename
// from the artifact's field names to the page's, plus the rank, which is the
// row's own position.

// A figure the file does not carry. Absent rather than zero: the money
// formatter draws a dash for one and "$0" for the other, and a User who has not
// been measured is not a User who scored nothing.
function orNull(value) {
  return value ?? null;
}

// All time Profit is the plain sum of each Campaign's own Standings total, so a
// year's Breakeven multiplier and Bomb mode are already inside it and the years
// genuinely sit on different scales. That is deliberate: it is a lifetime points
// total rather than a rate (CONTEXT.md: All time profit).
//
// The order is the artifact's. The ranking is part of the pre-computed join
// exactly as it is for a Campaign's Standings, so this renders it rather than
// deriving it: sorting here would compute the one figure the League argues
// about in a second place, and would hide an upstream file that got it wrong.
export function buildAllTimeRows(landing) {
  return (landing?.all_time ?? []).map((standing, index) => ({
    rank: index + 1,
    userId: standing.user_id,
    // The name is denormalized onto the artifact because the site has no User
    // registry to look an id up in. A row that arrives without one still names
    // somebody rather than nobody.
    username: standing.username ?? standing.user_id,
    profit: orNull(standing.profit),
    // The two figures Profit is the difference of, with every bomb modelled as
    // a forced co-production (spec #58, decision 13). `breakeven` is that
    // co-production total and not an all-time break-even line: there is none,
    // because each year's multiplier is inside each year's Profit already, so
    // where a User stands against break even is the sign of `profit`.
    gross: orNull(standing.gross),
    breakeven: orNull(standing.breakeven),
    // The same money counted from both ends: what other Users' bombs paid this
    // User, and what this User's own bombs paid the rest of the Roster. They
    // are two views of one figure rather than an identity, because one is read
    // back rounded and the other is computed unrounded.
    bombAbsorbed: orNull(standing.bomb_impact_absorbed),
    bombDealt: orNull(standing.bomb_impact_dealt),
    // Draft based, and the one column that is not co-production based: it
    // answers what the User chose, so their own bombs count and the bombs
    // co-produced onto them do not.
    moviesPicked: orNull(standing.movies_picked),
    // Campaigns the User was Rostered in, less the `drafting` ones. A year
    // nobody has picked in is not a year competed.
    yearsCompeted: orNull(standing.years_competed),
  }));
}
