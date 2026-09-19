// The Movies lookup table: the compact and the detailed view, two Tabulator
// instances over the rows `rows.js` builds. Wiring, untested by the site's
// convention: the reshaping and the sorting rules it renders are tested next
// door.
//
// Both views carry the same five columns. Compact adds one Gross Week column
// per week, newest first; detailed adds the Ratings group, whose expander
// opens the other five sources beside Letterboxd, and the per-day gross grid
// grouped under each week, which is the only place on this page a daily figure
// appears (#162). The ratings group is the Campaign table's, shared rather
// than copied. The week and day columns, their formatters and their widths are
// `shared/table-columns.js`, which knows nothing about a League or a lookup.
//
// This is `campaign/table.js` with the League dimensions taken out (#62). No
// holder, no Pick type, no Profit, no Breakeven, no ROI. Gross where Profit
// was, and the budget shown directly rather than as the Breakeven derived from
// it. Tabulator itself is a CDN global.
//
// The page owns the order, not this module. `page.js` hands the rows in
// already sorted, pushes its own pick back through `setSort`, and the header
// sorters below reproduce the same rule, so a column-header click and the sort
// menu cannot disagree about which five rows are at the top, which is what the
// chart's default plots.

import {
  escapeHtml,
  fmt,
  formatShortDate,
} from '../shared/format.js';
import { MOVIE_LINK_CLASS, guardMovieLinks, movieUrl } from '../shared/location.js';
import {
  compactWeekColumn,
  ratingsGroup,
  weekGroup,
} from '../shared/table-columns.js';
import {
  collectDailyDates,
  collectWeekKeys,
  groupDatesByWeek,
} from '../shared/week-fields.js';
import { pickOrSeasonIcon } from '../shared/icons.js';

import { missingLastSorter } from './rows.js';

const DASH = '<span class="text-neu">—</span>';

// ── Formatters ────────────────────────────────────────────────────────────

// A Movie from a slice written before the identity fields has no title (#60).
// Its imdb id is the only name it has, so the cell shows that rather than a
// dash the reader could not look anything up from.
//
// The title is the way into the Movie's own page (#63). A real anchor rather
// than a row-click handler, so the address can be copied, opened in a tab and
// read by a screen reader as the link it is.
//
// The Season rides in front of the name as a glyph, which is what the Campaign
// table and this page's own cards already do. It is one symbol where a column
// was a whole column, and it stays outside the link: the link is to the Movie,
// the glyph is a reading of when it opens.
function titleCell(cell) {
  const row = cell.getRow().getData();
  const value = cell.getValue();
  const label = value
    ? `<span class="movie-title-text">${escapeHtml(value)}</span>`
    : `<span class="movie-title-text text-neu">${escapeHtml(row.imdbId)}</span>`;

  return pickOrSeasonIcon(null, row.season)
    + `<a class="${MOVIE_LINK_CLASS}" href="${escapeHtml(movieUrl(row.imdbId))}">${label}</a>`;
}

function releaseDateCell(cell) {
  const value = cell.getValue();
  if (!value || value === 'TBA') return '<span class="text-neu">TBA</span>';
  return `${formatShortDate(value)} ${value.slice(0, 4)}`;
}

// Upstream's own word on whether it read the budget or guessed it (#62). A
// guess is marked rather than printed plain, so an estimate is not read as a
// reported figure. The footnote under the table explains the symbol.
function budgetCell(cell) {
  const value = cell.getValue();
  if (value === null || value === undefined) return DASH;
  if (cell.getRow().getData().estimatedBudget) {
    return `<span class="budget-estimated">≈${fmt(value)}</span>`;
  }
  return fmt(value);
}

function grossCell(cell) {
  const value = cell.getValue();
  if (value === null || value === undefined) return DASH;
  return `<span class="text-pos">${fmt(value)}</span>`;
}

function daysCell(cell) {
  const value = cell.getValue();
  if (value === null || value === undefined) return DASH;
  return String(value);
}

// ── Columns ───────────────────────────────────────────────────────────────

function baseColumns() {
  return [
    {
      title: 'Movie',
      field: 'title',
      frozen: true,
      minWidth: 240,
      cssClass: 'col-movie-title',
      headerSort: false,
      formatter: titleCell,
      tooltip: (event, cell) => cell.getValue() || cell.getRow().getData().imdbId,
    },
    {
      title: 'Released',
      field: 'releaseDate',
      minWidth: 110,
      sorter: missingLastSorter,
      formatter: releaseDateCell,
    },
    {
      title: 'Budget',
      field: 'budget',
      hozAlign: 'right',
      minWidth: 100,
      headerTooltip: 'Production budget. ≈ marks one upstream estimated.',
      sorter: missingLastSorter,
      formatter: budgetCell,
    },
    {
      title: 'Gross TD',
      field: 'grossTd',
      hozAlign: 'right',
      minWidth: 110,
      headerTooltip: 'Gross to date, cumulative',
      sorter: missingLastSorter,
      formatter: grossCell,
    },
    {
      title: 'Days',
      field: 'daysRunning',
      hozAlign: 'right',
      minWidth: 80,
      headerTooltip: 'Days running as at the day the figures were measured on',
      headerSort: false,
      formatter: daysCell,
    },
  ];
}

// Shared Tabulator options. The two views are the same table with different
// columns, so anything a reader would notice switching between them belongs
// here rather than in either builder.
const TABLE_OPTIONS = {
  layout: 'fitDataFill',
  responsiveLayout: false,
  resizableColumns: false,
  selectableRows: true,
  pagination: true,
  paginationSize: 50,
  paginationSizeSelector: [25, 50, 100, 250, true],
  // Addressing rows by imdb id is what lets the page push a chart selection
  // back into the table, as it does on the Campaign page.
  index: 'imdbId',
  placeholder: 'No Movie matches these filters.',
};

function buildTable(rows, columnDefs, { initialSort, onSelectionChange, onSorted }) {
  // `movie-table` is part of the markup contract both pages carry: the element
  // a Tabulator instance is built into.
  const table = new Tabulator('#movie-table', {
    ...TABLE_OPTIONS,
    // The page's remembered sort, handed over so the header carries the same
    // answer the menu does. `page.js` keeps the two in step from here on.
    initialSort,
    data: rows,
    columns: columnDefs,
  });

  guardMovieLinks('movie-table');

  table.on('rowSelectionChanged', (selectedData) => {
    onSelectionChange(selectedData.map((row) => row.imdbId));
  });

  table.on('dataSorted', (sorters) => onSorted(sorters));

  return table;
}

// Newest week leftmost, so the columns a reader wants are the ones they land
// on rather than the ones they have to scroll to.
function newestWeeksFirst(rows) {
  return collectWeekKeys(rows).slice().reverse();
}

// Which rows the columns are worked out from. The filters narrow what the table
// shows, and `replaceData` swaps the rows without rebuilding the columns, so
// deriving the week and day columns from the filtered rows would leave a
// column set that answers to whatever the filter happened to be when the view
// was built. `columnRows` is every Movie on the page, so the columns are the
// same set whatever is filtered in (#162).
function columnSource({ columnRows }, rows) {
  return columnRows && columnRows.length ? columnRows : rows;
}

export function buildCompactMovieTable(rows, options) {
  const weekColumns = newestWeeksFirst(columnSource(options, rows)).map(compactWeekColumn);

  return buildTable(rows, [...baseColumns(), ...weekColumns], options);
}

export function buildDetailedMovieTable(rows, options) {
  const source = columnSource(options, rows);
  const dates = collectDailyDates(source);
  const datesByWeek = groupDatesByWeek(dates);
  const newestFirst = newestWeeksFirst(source);

  // The group definitions have to exist before the instance they belong to, so
  // the expanders are handed a box and it is filled in below.
  const tableRef = { current: null };

  const weekColumns = dates.length > 0 && newestFirst.length > 0
    ? [{
      title: 'Weekly Gross',
      columns: newestFirst.map((key, index) => weekGroup(key, index === 0, datesByWeek, tableRef)),
    }]
    : [];

  const table = buildTable(
    rows,
    [...baseColumns(), ratingsGroup(tableRef), ...weekColumns],
    options,
  );
  tableRef.current = table;

  return table;
}
