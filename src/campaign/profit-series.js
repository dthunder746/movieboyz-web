// The lines the Profit chart draws, derived from the published Campaign
// artifact. Pure: no Chart.js, no DOM. Colour is left to the view, which knows
// which palette a mode calls for.
//
// Four modes, carried over from the old site. Picking Movies out of the table
// wins outright; otherwise the mode follows how many Users are selected:
//   any Movie → exactly those Movies, whoever holds them
//   no User   → every User's total
//   exactly 1 → that User's Slate, a Pick at a time
//   2 or more → those Users' totals
//
// Every line spans the full date range with nulls where it has no figure, so
// Chart.js `interaction.mode: 'index'` lines the hover up across all of them.

import { usernameMap } from './board.js';
import { shiftIsoDate } from './format.js';
import { totalSeries } from './standings.js';

const MILLION = 1e6;

// The last figure published at or before this date. A Profit series can skip
// days, and a gap means "unchanged since", not "back to nothing".
function valueAsOf(series, date) {
  let carried = null;
  for (const published of Object.keys(series).sort()) {
    if (published > date) break;
    carried = series[published];
  }
  return carried;
}

// Every date any line could plot: the Users' own series plus every Pick's, since
// a Pick can carry Profit from before the first day its User was scored.
function collectDates(campaign) {
  const dates = new Set();
  for (const user of campaign.users || []) {
    for (const date of Object.keys(user.profit || {})) dates.add(date);
  }
  for (const movie of campaign.movies || []) {
    for (const date of Object.keys(movie.profit || {})) dates.add(date);
  }
  return [...dates].sort();
}

// The first index at or after a release, or -1 when the release falls past
// everything plotted.
function releaseIndex(dates, releaseDate) {
  if (!releaseDate) return -1;
  return dates.findIndex((date) => date >= releaseDate);
}

function userLines(campaign, dates, users) {
  const usernames = usernameMap(campaign);

  return users.map((user) => {
    const totals = totalSeries(user);
    const points = dates.map((date) => ({
      x: date,
      y: totals[date] === undefined ? null : totals[date] / MILLION,
    }));

    // A dot on the User's line for each of their releases, so the day a Pick
    // opened is readable against the line it moved.
    const releaseMarkers = {};
    for (const movie of campaign.movies || []) {
      if (movie.user_id !== user.user_id) continue;
      const index = releaseIndex(dates, movie.release_date);
      if (index >= 0 && points[index].y !== null) releaseMarkers[index] = movie.title;
    }

    return {
      id: user.user_id,
      label: usernames.get(user.user_id) ?? user.user_id,
      points,
      releaseMarkers,
    };
  });
}

// One Movie's Profit as a line. Null before its first published figure, so the
// line starts where the Movie did rather than being drawn flat along the axis
// from the start of the Campaign.
function movieLine(movie, dates) {
  const published = Object.keys(movie.profit || {}).sort();
  if (published.length === 0) return null;
  const [firstDate] = published;

  return {
    id: movie.imdb_id,
    label: movie.title,
    points: dates.map((date) => ({
      x: date,
      y: date >= firstDate ? valueAsOf(movie.profit, date) / MILLION : null,
    })),
    releaseMarkers: {},
  };
}

function slateLines(campaign, dates, userId) {
  return (campaign.movies || [])
    .filter((movie) => movie.user_id === userId)
    .map((movie) => movieLine(movie, dates))
    .filter(Boolean);
}

// The Movies picked out in the table, in the order they were picked. Selection
// order rather than Board order because the palette is handed out by index:
// re-sorting here would repaint every line each time one was added.
function selectedMovieLines(campaign, dates, movieIds) {
  const byId = new Map((campaign.movies || []).map((movie) => [movie.imdb_id, movie]));
  return movieIds
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((movie) => movieLine(movie, dates))
    .filter(Boolean);
}

// Where the chart opens and how far it pans.
//
// `initialMin` skips the flat run of zeros before the Campaign's first scored
// Pick, which would otherwise take up a third of the width saying nothing.
// `limitMin` stops short of that, so panning back to the zeros is still
// possible; it is a bound on the view, not a claim about the data.
function computeTrim(dates, series) {
  let firstPlotted = null;
  let firstMeaningful = null;

  for (const line of series) {
    const plotted = line.points.find((point) => point.y !== null);
    if (plotted && (!firstPlotted || plotted.x < firstPlotted)) firstPlotted = plotted.x;

    const meaningful = line.points.find((point) => point.y !== null && point.y !== 0);
    if (meaningful && (!firstMeaningful || meaningful.x < firstMeaningful)) {
      firstMeaningful = meaningful.x;
    }
  }

  const anchor = firstPlotted || firstMeaningful;
  return {
    initialMin: firstMeaningful ? shiftIsoDate(firstMeaningful, -1) : null,
    limitMin: anchor ? shiftIsoDate(anchor, -1) : null,
    limitMax: dates.length ? dates[dates.length - 1] : null,
  };
}

function chooseMode(activeUserIds, activeMovieIds) {
  // A Movie selection is the only view that can put two Users' Picks side by
  // side, so it overrides rather than intersects: the table is being used to
  // ask a question the User cards cannot express.
  if (activeMovieIds.length > 0) return 'movies';
  return activeUserIds.length === 1 ? 'slate' : 'users';
}

export function buildProfitSeries(campaign, activeUserIds, activeMovieIds = []) {
  const dates = collectDates(campaign);
  const selected = (campaign.users || []).filter((user) => activeUserIds.includes(user.user_id));

  // The mode follows what was selected, not what resolved. Selecting one card
  // means "show me that Slate" whether or not a second, unrecognised id came
  // along with it; deciding on the resolved count instead would let a stale id
  // silently switch the chart to a different view.
  const mode = chooseMode(activeUserIds, activeMovieIds);

  let series;
  if (mode === 'movies') {
    series = selectedMovieLines(campaign, dates, activeMovieIds);
  } else if (mode === 'slate') {
    series = selected.flatMap((user) => slateLines(campaign, dates, user.user_id));
  } else {
    series = userLines(campaign, dates, selected.length ? selected : campaign.users || []);
  }

  return {
    mode,
    dates,
    series,
    trim: computeTrim(dates, series),
  };
}
