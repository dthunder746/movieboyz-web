// The Movies lookup table, one Tabulator instance over the rows `rows.js`
// builds. Wiring, untested by the site's convention: the reshaping and the
// sorting rules it renders are tested next door.
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
  ratingColorClass,
} from '../shared/format.js';

import { SEASON_LABELS, missingLastSorter } from './rows.js';

const DASH = '<span class="text-neu">—</span>';

// ── Formatters ────────────────────────────────────────────────────────────

// A Movie from a slice written before the identity fields has no title (#60).
// Its imdb id is the only name it has, so the cell shows that rather than a
// dash the reader could not look anything up from.
function titleCell(cell) {
  const row = cell.getRow().getData();
  const value = cell.getValue();
  if (!value) {
    return `<span class="movie-title-text text-neu">${escapeHtml(row.imdbId)}</span>`;
  }
  return `<span class="movie-title-text">${escapeHtml(value)}</span>`;
}

function releaseDateCell(cell) {
  const value = cell.getValue();
  if (!value || value === 'TBA') return '<span class="text-neu">TBA</span>';
  return `${formatShortDate(value)} ${value.slice(0, 4)}`;
}

function seasonCell(cell) {
  const value = cell.getValue();
  if (!value) return DASH;
  return SEASON_LABELS[value] ?? value;
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

// Letterboxd publishes out of 100 and its readers know it out of 5.
function ratingCell(cell) {
  const value = cell.getValue();
  if (value === null || value === undefined) return DASH;
  return `<span class="${ratingColorClass(value)}">${(value / 20).toFixed(1)}</span>`;
}

// ── Columns ───────────────────────────────────────────────────────────────

function columns() {
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
      title: 'Season',
      field: 'season',
      minWidth: 90,
      headerSort: false,
      formatter: seasonCell,
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
    {
      title: 'Letterboxd',
      field: 'ratingLetterboxd',
      hozAlign: 'center',
      minWidth: 110,
      sorter: missingLastSorter,
      formatter: ratingCell,
      tooltip(event, cell) {
        const votes = cell.getRow().getData().ratings?.letterboxd?.votes;
        if (votes === null || votes === undefined) return false;
        return `${votes.toLocaleString()} votes`;
      },
    },
  ];
}

export function buildMovieTable(rows, { initialSort, onSelectionChange, onSorted }) {
  const table = new Tabulator('#movie-table', {
    layout: 'fitDataFill',
    // The page's remembered sort, handed over so the header carries the same
    // answer the menu does. `page.js` keeps the two in step from here on.
    initialSort,
    responsiveLayout: false,
    resizableColumns: false,
    selectableRows: true,
    pagination: true,
    paginationSize: 50,
    paginationSizeSelector: [25, 50, 100, 250, true],
    // Addressing rows by imdb id is what lets the page push a chart selection
    // back into the table, as it does on the Campaign page.
    index: 'imdbId',
    data: rows,
    columns: columns(),
    placeholder: 'No Movie matches these filters.',
  });

  table.on('rowSelectionChanged', (selectedData) => {
    onSelectionChange(selectedData.map((row) => row.imdbId));
  });

  table.on('dataSorted', (sorters) => onSorted(sorters));

  return table;
}
