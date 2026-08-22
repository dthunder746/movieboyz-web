// The lines the Movies chart draws: each Movie's cumulative gross laid on a
// days-since-release axis, so films from different years overlay (#62). Pure:
// no Chart.js, no DOM.

import { daysBetween } from '../shared/format.js';

const MILLION = 1e6;

// The days-since-release windows the control offers, and the one a reader who
// has never touched it gets. 90 days covers a wide release's whole run in
// cinemas, which is the part of the curve worth comparing.
export const WINDOW_OPTIONS = [30, 60, 90, 180, 365];
export const DEFAULT_WINDOW_DAYS = 90;

// How many lines the chart opens with. Enough to compare against, few enough
// that the vivid Movie palette still tells them apart.
export const DEFAULT_SELECTION_SIZE = 5;

// One Movie's published series on the days axis, before the window is applied.
//
// The slice carries flat zeros from before a Movie opened, which say nothing on
// this axis and would drag every line back to a negative day, so they go. A
// Movie with no release date cannot be placed on the axis at all, which is the
// state a slice written before the identity fields leaves it in (#60).
function daysAxis(row) {
  if (!row.releaseDate) return [];

  const points = [];
  for (const date of Object.keys(row.gross || {}).sort()) {
    const day = daysBetween(row.releaseDate, date);
    if (day === null || day < 0) continue;
    points.push({ x: day, y: row.gross[date] / MILLION });
  }
  return points;
}

// Why the chart is empty, so the page can say which of the three it is.
//
//   no-rows        nothing to draw from; the reader's own filters, or a
//                  selection the filters have since carried out of view
//   unreleased     rows are there and none has opened, so their series are
//                  the flat pre-release zeros the slice publishes
//   outside-window rows are there with box office published, but none of it
//                  falls inside the window, which is the state every Movie
//                  from a year before the platform started capturing daily
//                  figures is in: its series begins on the day capture began,
//                  thousands of days into its run
//
// All three are read off the rows the chart was asked about, which is the
// selection once there is one. Reading the whole view instead would answer
// about films the reader has stopped asking about.
function blankReason(scopeRows, series, published) {
  if (series.length > 0) return null;
  if (scopeRows.length === 0) return 'no-rows';
  return published > 0 ? 'outside-window' : 'unreleased';
}

export function buildGrossSeries(rows, { selectedIds = [], windowDays } = {}) {
  const window = WINDOW_OPTIONS.includes(windowDays) ? windowDays : DEFAULT_WINDOW_DAYS;

  // What the chart was asked about: the selection where the reader has made
  // one, and everything in view where they have not. A selected Movie the
  // filters have hidden is in neither, which is what leaves this empty.
  const inView = rows || [];
  const scopeRows = selectedIds.length
    ? inView.filter((row) => selectedIds.includes(row.imdbId))
    : inView;

  // Every row asked about that has box office at all, in the order the sort put
  // them in, and then the same list narrowed to the window.
  const published = scopeRows
    .map((row) => ({ id: row.imdbId, label: row.title, points: daysAxis(row) }))
    .filter((line) => line.points.length > 0);

  const plottable = published
    .map((line) => ({ ...line, points: line.points.filter((point) => point.x <= window) }))
    .filter((line) => line.points.length > 0);

  // The default is the top five rows the axis can carry rather than the top
  // five rows outright. Sorted by release date the head of the list is a run of
  // films nobody has seen, and sorted by gross it is the all-time earners whose
  // opening months predate the platform, so reading it literally would blank
  // the chart with plottable films sitting just underneath.
  const byId = new Map(plottable.map((line) => [line.id, line]));
  const series = selectedIds.length
    ? selectedIds.map((id) => byId.get(id)).filter(Boolean)
    : plottable.slice(0, DEFAULT_SELECTION_SIZE);

  // The axis stops at the longest run plotted rather than at the window, so a
  // window wider than anything in view does not draw empty months.
  const lastDays = series.map((line) => line.points.at(-1).x);
  const maxDay = lastDays.length ? Math.max(...lastDays) : 0;

  return {
    series,
    maxDay,
    windowDays: window,
    blank: blankReason(scopeRows, series, published.length),
    // Which rows the two answers above are about, so the page can name them.
    scope: selectedIds.length ? 'selection' : 'view',
    // Rows the reader can see in the table whose box office is published but
    // falls outside the window. Widening the window brings them back, which is
    // what separates them from a Movie that has not opened.
    skipped: published.length - plottable.length,
  };
}

// ── What the page says about a chart it cannot draw ──────────────────────────

// The sentence that stands in for the canvas. Each blank reason gets its own,
// because they are three different facts about the rows in view and only one of
// them is about a Movie not being out yet.
export function blankMessage(built) {
  const subject = built.scope === 'selection' ? 'Nothing you selected' : 'Nothing in view';

  switch (built.blank) {
    case 'no-rows':
      return built.scope === 'selection'
        ? 'The Movies you selected are not in view.'
        : 'No Movie matches these filters.';
    case 'unreleased':
      return `${subject} has been released yet, so there is no box office to plot.`;
    case 'outside-window':
      return `${subject} has box office inside its first ${built.windowDays} days.`
        + ' These Movies were first measured later in their run,'
        + ' so a wider window may reach them.';
    default:
      return null;
  }
}

// Rows the reader can count in the table that are missing from the chart. A
// blank chart already explains itself at length, so this is for the ordinary
// case: a drawn chart that quietly holds fewer Movies than the list under it.
export function skippedNote(built) {
  if (built.blank || built.skipped === 0) return null;

  const where = built.scope === 'selection' ? 'you selected' : 'in view';

  return built.skipped === 1
    ? `1 Movie ${where} has no box office inside its first ${built.windowDays} days,`
      + ' so it is not plotted.'
    : `${built.skipped} Movies ${where} have no box office inside their first`
      + ` ${built.windowDays} days, so they are not plotted.`;
}
