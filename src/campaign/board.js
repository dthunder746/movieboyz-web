// The Board: the Campaign artifact joined to the Movie slices on `imdb_id`.
//
// ADR 0008 split what the old site read from one file across two. Scored
// figures (Profit, Breakeven, who holds the Pick) stay on the Campaign
// artifact, because they are that League's reading of the Movie. Measurements
// (gross, daily change, ratings) live on a per-release-year Movie slice,
// because they are the same for every League. This module puts the two back
// together into the single row the page renders from.
//
// Pure: no fetching, no DOM. The caller decides which slices to load, which is
// what `sliceYearsToFetch` answers.

// A User's id resolved to the name to show for them. The roster is the only
// place the artifact publishes the pairing, and it is routinely a superset of
// the Users a Campaign actually scored, so every view that renders a name has to
// come back through here rather than reading one off a row.
export function usernameMap(campaign) {
  return new Map(
    (campaign.roster || []).map((member) => [member.user_id, member.username]),
  );
}

function releaseYear(movie) {
  const date = movie.release_date;
  if (!date || date === 'TBA') return null;
  const year = parseInt(date.slice(0, 4), 10);
  return Number.isNaN(year) ? null : year;
}

// Which slices this Board actually needs, intersected with what the manifest
// says exists. The Board's own dates are not enough on their own: a Pick can be
// held from a year the platform has never published a slice for, and asking for
// it would be a guaranteed 404.
export function sliceYearsToFetch(campaign, availableYears) {
  const published = new Set(availableYears || []);
  const wanted = new Set();
  for (const movie of campaign.movies || []) {
    const year = releaseYear(movie);
    if (year !== null && published.has(year)) wanted.add(year);
  }
  return [...wanted].sort((a, b) => a - b);
}

// A Movie with no slice row yet. Standings render off the Campaign artifact
// alone, so a Board that is waiting on a slice is a normal intermediate state
// rather than an error: the measurement columns simply read empty until it
// lands.
const NO_MEASUREMENTS = {
  gross_td: null,
  days_running: null,
  daily_change: {},
  weekly_gross: {},
  ratings: null,
  released_digital: null,
  status: null,
};

// Profit against what the Pick had to make back. Held apart from the Campaign
// artifact's own figures because it is the one number here the processor does
// not publish; every other field on a row is carried across unchanged.
function roi(profitTd, breakeven) {
  if (profitTd === null || profitTd === undefined) return null;
  if (!breakeven) return null;
  return (profitTd / breakeven) * 100;
}

// The date the measurements on this Board are current to. ADR 0008 anchors a
// slice's "to date" figures on the last gross date the slice itself carries,
// not on the Campaign's `latest_date`; the two coincide only while the Board and
// the slice cover the same population. Reading `daily_change` at the Campaign's
// date once they diverge finds nothing and empties a tab silently, so the anchor
// is taken from the slices that supplied the figures.
function measurementDate(campaign, slices) {
  const dates = (slices || []).map((slice) => slice.latest_date).filter(Boolean);
  if (dates.length === 0) return campaign.latest_date;
  return dates.reduce((newest, date) => (date > newest ? date : newest));
}

export function buildBoard(campaign, slices) {
  const usernames = usernameMap(campaign);

  // One lookup across every slice. Slices are keyed by release year and a Board
  // spans several, so a Movie's measurements can come from any of them.
  const measurements = new Map();
  for (const slice of slices || []) {
    for (const movie of slice.movies || []) measurements.set(movie.imdb_id, movie);
  }

  // The Campaign artifact decides membership, not the slices. A slice is
  // everybody's year while a Board is one League's, so a slice routinely
  // carries Movies this Campaign never scored.
  const rows = (campaign.movies || []).map((movie) => {
    const measured = measurements.get(movie.imdb_id) ?? NO_MEASUREMENTS;
    const userId = movie.user_id ?? null;

    return {
      imdbId: movie.imdb_id,
      title: movie.title,
      releaseDate: movie.release_date ?? null,
      season: movie.season ?? null,
      budget: movie.budget ?? null,
      breakeven: movie.breakeven ?? null,
      profit: movie.profit || {},
      profitTd: movie.profit_td ?? null,

      userId,
      username: userId === null ? null : (usernames.get(userId) ?? userId),
      pickType: movie.pick_type ?? null,
      draftPick: movie.draft_pick ?? null,

      grossTd: measured.gross_td ?? null,
      daysRunning: measured.days_running ?? null,
      dailyChange: measured.daily_change || {},
      weeklyGross: measured.weekly_gross || {},
      ratings: measured.ratings ?? null,
      releasedDigital: measured.released_digital ?? null,
      status: measured.status ?? null,

      roi: roi(movie.profit_td ?? null, movie.breakeven ?? null),
    };
  });

  return {
    year: campaign.year ?? null,
    latestDate: campaign.latest_date,
    latestProfitDate: campaign.latest_profit_date,
    measurementDate: measurementDate(campaign, slices),
    rows,
    byId: new Map(rows.map((row) => [row.imdbId, row])),
  };
}
