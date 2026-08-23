// One Movie, as the detail page reads it: the facts off whichever slice carries
// it, the ratings it has collected, and the Campaigns holding it. Pure: no
// fetching, no DOM.
//
// This is the lookup row (`../rows.js`) turned inside out. A lookup row is one
// of thousands and carries what a table cell needs; this is one Movie and
// carries everything published about it, including the way back to the
// contests, which the lookup page deliberately never reads.

import { displayRatings } from '../../shared/ratings.js';
import { campaignPath } from '../../shared/route.js';
import { SEASON_LABELS } from '../rows.js';

// Which slice holds the Movie, and the Movie itself. An imdb id says nothing
// about which release year's file carries it, so every loaded slice is checked.
function findMovie(imdbId, slices) {
  for (const slice of slices || []) {
    for (const movie of slice.movies || []) {
      if (movie.imdb_id === imdbId) return { movie, slice };
    }
  }
  return null;
}

// The same fallback the lookup rows use: a slice is keyed by the release year
// its Movies are in, so the file's own year is a real answer for a Movie
// published before the slice carried `release_date` at all (#60).
function releaseYear(movie, slice) {
  const year = movie.release_date ? parseInt(String(movie.release_date).slice(0, 4), 10) : NaN;
  return Number.isNaN(year) ? (slice.release_year ?? null) : year;
}

// Every Campaign whose Board holds the Movie as a Pick, newest year first.
//
// A Board carries every Movie in play for its year whether or not anybody
// picked it, so being on a Board is not being held: the holding is the row with
// a `user_id`. The holder's name comes off the Roster, which is where the
// Campaign artifact denormalizes it (ADR 0008), and a Roster that does not name
// them still leaves a holding under the id rather than dropping it.
function buildHoldings(imdbId, campaigns) {
  const holdings = [];

  for (const campaign of campaigns || []) {
    const row = (campaign.movies || []).find(
      (movie) => movie.imdb_id === imdbId && movie.user_id,
    );
    if (!row) continue;

    const member = (campaign.roster || []).find((entry) => entry.user_id === row.user_id);

    holdings.push({
      leagueSlug: campaign.league_slug,
      leagueName: campaign.league_name,
      year: campaign.year,
      state: campaign.state,
      campaignPath: campaignPath(campaign.league_slug, campaign.year),
      userId: row.user_id,
      username: member?.username ?? null,
      pickType: row.pick_type ?? null,
      draftPick: row.draft_pick ?? null,
      profitTd: row.profit_td ?? null,
      breakeven: row.breakeven ?? null,
    });
  }

  return holdings.sort((a, b) => b.year - a.year);
}

export function buildMovieView({ imdbId, slices, campaigns } = {}) {
  const found = findMovie(imdbId, slices);
  // Not a failure the page hides: the reader named a Movie and it is in no
  // slice that loaded, so the page says exactly that, about that identifier.
  if (!found) return { found: false, imdbId };

  const { movie, slice } = found;
  const season = movie.season ?? null;

  return {
    found: true,
    imdbId: movie.imdb_id,
    title: movie.title ?? null,
    releaseDate: movie.release_date ?? null,
    releaseYear: releaseYear(movie, slice),
    season,
    seasonLabel: season ? (SEASON_LABELS[season] ?? season) : null,
    budget: movie.budget ?? null,
    // Absent reads as "not flagged", which is the contract's own default: tier
    // 2's column is a non-nullable boolean.
    estimatedBudget: movie.estimated_budget === true,

    grossTd: movie.gross_td ?? null,
    daysRunning: movie.days_running ?? null,
    releasedDigital: movie.released_digital ?? null,
    status: movie.status ?? null,

    // Handed on raw for the series module to shape. The page plots them; this
    // module has no opinion about the axis.
    gross: movie.gross || {},
    weeklyGross: movie.weekly_gross || {},

    ratings: displayRatings(movie.ratings),
    ratingsFetchedAt: movie.ratings?.fetched_at ?? null,

    // The day this Movie's "to date" figures are measured on, taken from the
    // slice it came out of rather than the newest one loaded: ADR 0008 anchors
    // each file's figures on its own latest date.
    measuredOn: slice.latest_date ?? null,

    holdings: buildHoldings(movie.imdb_id, campaigns),
  };
}
