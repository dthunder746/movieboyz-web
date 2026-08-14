// The lines the Profit chart draws, derived from the published Campaign
// artifact. Pure — no Chart.js, no DOM. Colour is left to the view, which knows
// which palette a mode calls for.
//
// Three modes, keyed off how many Users are selected, carried over from the old
// site:
//   none      → every User's total
//   exactly 1 → that User's Slate, a Pick at a time
//   2 or more → those Users' totals
//
// Every line spans the full date range with nulls where it has no figure, so
// Chart.js `interaction.mode: 'index'` lines the hover up across all of them.

import { totalSeries } from './standings.js';

const MILLION = 1e6;
const MS_PER_DAY = 86400000;

function shiftDays(isoDate, days) {
  const shifted = new Date(`${isoDate}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().split('T')[0];
}

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
  const usernames = new Map(
    (campaign.roster || []).map((member) => [member.user_id, member.username]),
  );

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

function slateLines(campaign, dates, userId) {
  return (campaign.movies || [])
    .filter((movie) => movie.user_id === userId && Object.keys(movie.profit || {}).length > 0)
    .map((movie) => {
      const published = Object.keys(movie.profit).sort();
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
    });
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
    initialMin: firstMeaningful ? shiftDays(firstMeaningful, -1) : null,
    limitMin: anchor ? shiftDays(anchor, -1) : null,
    limitMax: dates.length ? dates[dates.length - 1] : null,
  };
}

export function buildProfitSeries(campaign, activeUserIds) {
  const dates = collectDates(campaign);
  const selected = (campaign.users || []).filter((user) => activeUserIds.includes(user.user_id));

  // The mode follows what was selected, not what resolved. Selecting one card
  // means "show me that Slate" whether or not a second, unrecognised id came
  // along with it; deciding on the resolved count instead would let a stale id
  // silently switch the chart to a different view.
  const soloSlate = activeUserIds.length === 1;
  const series = soloSlate
    ? selected.flatMap((user) => slateLines(campaign, dates, user.user_id))
    : userLines(campaign, dates, selected.length ? selected : campaign.users || []);

  return {
    mode: soloSlate ? 'slate' : 'users',
    dates,
    series,
    trim: computeTrim(dates, series),
  };
}
