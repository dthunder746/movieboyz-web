// The Movies lookup page's rows: every published Movie slice flattened into one
// list. Pure: no fetching, no DOM.
//
// This is `campaign/board.js` with the League taken out. A Board is one
// Campaign's reading of a Movie and has to join a Campaign artifact to the
// slices; a lookup row is the Movie itself, so the slices are the whole of it.
// Nothing here reads a Campaign file, which is what lets the page work for a
// reader who is in no League (#62).

// The Seasons a Movie can be in, in calendar order, and how each one is
// written for a reader. A closed set the platform derives from a release date
// rather than a file it publishes (CONTEXT.md), so it is a constant here rather
// than something read off the Manifest the way the release years are. One home,
// because the table, the chips and the filter all name the same three.
export const SEASONS = ['WINTER', 'SUMMER', 'FALL'];

export const SEASON_LABELS = {
  WINTER: 'Winter',
  SUMMER: 'Summer',
  FALL: 'Fall',
};

// Ratings flattened onto the row so the table can sort on them. Letterboxd is
// the one the League watches and the only one the lookup table shows; the rest
// ride along for the tooltip, as they do on the Campaign page.
export const RATING_KEY = 'letterboxd';

function releaseYear(movie, slice) {
  const date = movie.release_date;
  const year = date ? parseInt(String(date).slice(0, 4), 10) : NaN;
  // The file's own year is the fallback, and it is a real answer rather than a
  // guess: a slice is keyed by the release year its Movies are in. It is what
  // keeps the year chips working for a Movie published before the slice
  // carried `release_date` at all (#60).
  return Number.isNaN(year) ? (slice.release_year ?? null) : year;
}

export function buildMovieRows(slices) {
  const rows = [];

  for (const slice of slices || []) {
    for (const movie of slice.movies || []) {
      rows.push({
        imdbId: movie.imdb_id,
        title: movie.title ?? null,
        releaseDate: movie.release_date ?? null,
        releaseYear: releaseYear(movie, slice),
        season: movie.season ?? null,
        budget: movie.budget ?? null,
        // Absent reads as "not flagged", which is what the contract's own
        // default says: tier 2's column is a non-nullable boolean.
        estimatedBudget: movie.estimated_budget === true,

        grossTd: movie.gross_td ?? null,
        daysRunning: movie.days_running ?? null,
        gross: movie.gross || {},
        weeklyGross: movie.weekly_gross || {},
        dailyChange: movie.daily_change || {},
        ratings: movie.ratings ?? null,
        ratingLetterboxd: movie.ratings?.[RATING_KEY]?.score ?? null,
        releasedDigital: movie.released_digital ?? null,
        status: movie.status ?? null,

        // The day this Movie's "to date" figures are measured on. Taken from
        // the slice it came out of rather than from the newest slice loaded,
        // because ADR 0008 anchors each file's figures on its own latest date.
        measuredOn: slice.latest_date ?? null,
      });
    }
  }

  return rows;
}

// ── Sorting ───────────────────────────────────────────────────────────────
//
// The four questions the page is for: what took the most, what was best
// received, what is out, and what it cost. Each has both directions, and the
// menu ids are what the page remembers between visits.

const SORT_FIELDS = {
  gross: 'grossTd',
  rating: 'ratingLetterboxd',
  release: 'releaseDate',
  budget: 'budget',
};

export const DEFAULT_SORT = 'gross_desc';

// The same map read backwards, so a sortable column and the menu entry that
// names it cannot drift apart: adding a sort above adds both directions here.
const SORT_IDS = Object.fromEntries(
  Object.entries(SORT_FIELDS).map(([name, field]) => [field, name]),
);

// Which sort menu entry a click on a column header amounts to, so the menu
// keeps showing what the table is actually sorted by. Tabulator shaped, and
// tested here rather than beside the table, which is untested wiring.
export function sortIdFromSorters(sorters) {
  if (!sorters || !sorters.length) return null;

  const [sorter] = sorters;
  const field = sorter.field
    ?? (sorter.column?.getField ? sorter.column.getField() : null);
  const name = SORT_IDS[field];
  if (!name) return null;

  return `${name}_${sorter.dir === 'asc' ? 'asc' : 'desc'}`;
}

// The menu id as Tabulator's own sorter spec, so the page can put the table's
// header into the order the menu asked for. Without it Tabulator keeps whatever
// sorter the last header click left on the column and re-applies it to every
// `replaceData`, and the menu, the chart and the table stop agreeing.
export function tableSortSpec(sortId) {
  const spec = parseSortId(sortId) ?? parseSortId(DEFAULT_SORT);
  return [{ column: spec.field, dir: spec.direction }];
}

export function parseSortId(sortId) {
  const [name, direction] = String(sortId ?? '').split('_');
  const field = SORT_FIELDS[name];
  if (!field || (direction !== 'asc' && direction !== 'desc')) return null;
  return { field, direction };
}

function compare(field, direction) {
  const multiplier = direction === 'asc' ? 1 : -1;

  return (a, b) => {
    const left = a[field];
    const right = b[field];
    // A missing figure sorts last in both directions. Ascending, it would
    // otherwise lead the page with every Movie nobody has measured yet, which
    // is the same rule the Campaign cards follow.
    if (left === null || left === undefined) return right === null || right === undefined ? 0 : 1;
    if (right === null || right === undefined) return -1;
    if (typeof left === 'string' || typeof right === 'string') {
      if (left === right) return 0;
      return (left < right ? -1 : 1) * multiplier;
    }
    return (left - right) * multiplier;
  };
}

// A copy, sorted. The page holds one list of rows and several views of it, so
// sorting in place would reorder the list under whatever else is reading it.
export function sortMovieRows(rows, sortId) {
  const spec = parseSortId(sortId) ?? parseSortId(DEFAULT_SORT);
  return [...(rows || [])].sort(compare(spec.field, spec.direction));
}

// The same rule as a Tabulator sorter, so a click on a column header and a pick
// from the sort menu put the rows in the same order.
//
// Tabulator sorts descending by swapping the two rows before it calls the
// sorter rather than by negating what comes back, so "a missing figure sorts
// last" has to swap with it. Everything else falls out of the swap for free.
export function missingLastSorter(a, b, rowA, rowB, column, dir) {
  const missingLast = dir === 'asc' ? 1 : -1;
  const aMissing = a === null || a === undefined || a === '';
  const bMissing = b === null || b === undefined || b === '';

  if (aMissing) return bMissing ? 0 : missingLast;
  if (bMissing) return -missingLast;
  if (typeof a === 'string' || typeof b === 'string') {
    if (a === b) return 0;
    return a < b ? -1 : 1;
  }
  return a - b;
}
