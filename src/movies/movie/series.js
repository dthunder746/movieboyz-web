// The two things the Movie page plots: the cumulative box office curve and the
// weekly takings under it. Pure: no Chart.js, no DOM.
//
// The lookup page's `../gross-series.js` lays many Movies on a shared
// days-since-release axis so they overlay. This is the opposite question. One
// Movie is plotted against real dates, because the only comparison that matters
// here is against the calendar the reader lived through.

import {
  dateToIsoWeekKey,
  daysBetween,
  isoWeekBounds,
  shiftIsoDate,
  weekTitle,
} from '../../shared/format.js';

const MILLION = 1e6;

// Chart.js reads the y axis in millions, as the site's other charts do, so the
// axis label can carry the unit once instead of every tick spelling it out.
function millions(value) {
  return value / MILLION;
}

// The keys of a published series, in order, with the artifact's leading padding
// dropped.
//
// A slice publishes a Movie's series from before it opened, flat at zero. Those
// days are not box office: kept, they push the whole shape of the curve into
// the right half of the canvas. `from` is the first key that counts, which is
// the release itself where one is published. Where none is (a slice written
// before the identity fields, #60) the first non-zero figure stands in, which
// is the same cut for every Movie that opened to anything at all.
//
// Only the leading zeros go. A zero partway through is a real answer: the Movie
// has left the cinemas, and the flat stretch is the point.
function trimmedKeys(series, from) {
  const keys = Object.keys(series || {}).sort();
  if (from) return keys.filter((key) => key >= from);

  const first = keys.findIndex((key) => series[key]);
  return first === -1 ? [] : keys.slice(first);
}

function cumulativePoints(view) {
  return trimmedKeys(view.gross, view.releaseDate)
    .map((date) => ({ x: date, y: millions(view.gross[date]) }));
}

// A week is a span and a bar is drawn at a point, so each bar sits on its
// week's Thursday: the middle of Monday to Sunday, and the day ISO 8601 itself
// pivots a week's year on.
function weeklyBars(view) {
  const from = view.releaseDate ? dateToIsoWeekKey(view.releaseDate) : null;

  return trimmedKeys(view.weeklyGross, from).map((week) => ({
    x: shiftIsoDate(isoWeekBounds(week).start, 3),
    y: millions(view.weeklyGross[week]),
    week,
    label: weekTitle(week),
  }));
}

// Why there is nothing to draw, so the page can say which of the two it is.
//
//   unreleased   the Movie opens after the day it was measured, so its series
//                is the flat padding and nothing else
//   no-figures   it is out, or nothing says otherwise, and no figure has been
//                published for it
//
// The day measured against is the Movie's own slice's, and `asOf` stands in
// where that slice has none. A release year nothing in has been measured
// publishes exactly that, which today is the whole of 2027: without the
// fallback every film a year out would read as one nobody has published a
// figure for rather than one that is not out.
function blankReason(view, cumulative, weekly, asOf) {
  if (cumulative.length || weekly.length) return null;

  const measured = view.measuredOn ?? asOf;
  if (view.releaseDate && measured && view.releaseDate > measured) return 'unreleased';
  return 'no-figures';
}

export function buildMovieSeries(view, { asOf = null } = {}) {
  const cumulative = cumulativePoints(view);
  const weekly = weeklyBars(view);

  // Every Movie that opened before the platform started capturing daily
  // figures has a curve that begins partway up. That is a fact about the
  // measuring rather than about the film, and the page has to say it or the
  // plot reads as wrong.
  const measurementBeganOn = cumulative.length ? cumulative[0].x : null;
  const daysIn = view.releaseDate && measurementBeganOn
    ? daysBetween(view.releaseDate, measurementBeganOn)
    : null;

  return {
    title: view.title ?? null,
    releaseDate: view.releaseDate ?? null,
    cumulative,
    weekly,
    measurementBeganOn,
    measurementBeganDay: daysIn > 0 ? daysIn : null,
    blank: blankReason(view, cumulative, weekly, asOf),
  };
}

// ── What the page says about a chart it cannot draw ──────────────────────────

export function blankMessage(built) {
  switch (built.blank) {
    case 'unreleased': {
      const name = built.title ?? 'This Movie';
      return `${name} opens on ${built.releaseDate},`
        + ' so there is no box office to plot yet.';
    }
    case 'no-figures':
      return 'No box office has been published for this Movie yet.';
    default:
      return null;
  }
}

// The sentence under a drawn curve that starts partway up its own run.
export function measurementNote(built) {
  const days = built.measurementBeganDay;
  if (!days) return null;

  return `Daily figures for this Movie begin ${days} ${days === 1 ? 'day' : 'days'}`
    + ` into its run, on ${built.measurementBeganOn}, so the curve starts partway up.`;
}
