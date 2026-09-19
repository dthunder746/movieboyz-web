// The two Tabulator instances behind the compact and detailed views.
//
// Row data comes from `table-rows.js`, which is where the reshaping and the
// sorting rules are tested. The formatters, the week and day columns and the
// sort orders come from `shared/table-columns.js`, which knows nothing about a
// League, the ratings group among them (#162). What lives here is the
// Campaign's own columns over them: the Movie title with its badge and Pick
// glyph, and the financials.
// Tabulator itself is a CDN global.

import { escapeHtml } from '../shared/format.js';
import { MOVIE_LINK_CLASS, guardMovieLinks, movieUrl } from '../shared/location.js';
import {
  BASE_TABLE_OPTIONS,
  buildSortMap,
  compactWeekColumn,
  defaultSort,
  moneyCell,
  ratingsGroup,
  releaseDateCell,
  roiCell,
  roundedRoiCell,
  signedMoneyCell,
  weekGroup,
} from '../shared/table-columns.js';

import { pickOrSeasonIcon, userBadge } from '../shared/icons.js';
import {
  collectDailyDates,
  collectWeekKeys,
  compactRows,
  detailedRows,
  groupDatesByWeek,
} from './table-rows.js';

// Both views are the same table with different columns, and the Movies page's
// two are the same table again, so anything a reader would notice switching
// between any of them (where the header sits, whether a row can be picked, how
// the columns are rendered) is the shared base
// (`shared/table-columns.js`). What is left here is this page's own: how many
// rows a page offers.
const TABLE_OPTIONS = {
  ...BASE_TABLE_OPTIONS,
  paginationSizeSelector: [10, 25, 50, 100, true],
};

// ── Shared columns ────────────────────────────────────────────────────────

// The title is the way into the Movie's own page (#63), in both views. A real
// anchor rather than a row-click handler, so the address can be copied, opened
// in a tab and read by a screen reader as the link it is. The badge and the
// Pick glyph stay outside it: they are the League's reading of the Movie, and
// the link is to the Movie itself.
function titleColumn(colorMap, widths) {
  return {
    title: 'Movie',
    field: 'title',
    frozen: true,
    ...widths,
    cssClass: 'col-movie-title',
    formatter(cell) {
      const row = cell.getRow().getData();
      const href = escapeHtml(movieUrl(row.imdbId));
      return userBadge(row.userId, row.username, colorMap)
        + pickOrSeasonIcon(row.pickType, row.season)
        + `<a class="${MOVIE_LINK_CLASS}" href="${href}">`
        + `<span class="movie-title-text">${escapeHtml(cell.getValue())}</span></a>`;
    },
    tooltip: (event, cell) => cell.getValue(),
  };
}

function releasedColumn(widths) {
  return {
    title: 'Released',
    field: 'releaseDate',
    ...widths,
    // A string sort, which is why an undated Movie carries the literal 'TBA'
    // rather than a null: it has to sort somewhere.
    sorter: 'string',
    formatter: releaseDateCell,
  };
}

// ── Detailed table ────────────────────────────────────────────────────────

function financialColumns() {
  return [
    {
      title: 'B/E',
      field: 'breakeven',
      cssClass: 'week-sep',
      hozAlign: 'right',
      minWidth: 80,
      headerTooltip: 'Breakeven (2 × production budget)',
      formatter: moneyCell,
      sorter: 'number',
    },
    {
      title: 'Gross TD',
      field: 'grossTd',
      hozAlign: 'right',
      minWidth: 95,
      formatter: moneyCell,
      sorter: 'number',
    },
    {
      title: 'Profit TD',
      field: 'profitTd',
      hozAlign: 'right',
      minWidth: 95,
      formatter: signedMoneyCell,
      sorter: 'number',
    },
    {
      title: 'ROI',
      field: 'roi',
      hozAlign: 'right',
      minWidth: 80,
      headerTooltip: 'Return on Investment: (gross − breakeven) / breakeven',
      formatter: roiCell,
      sorter: 'number',
    },
  ];
}

export function buildDetailedTable(board, colorMap) {
  const rows = detailedRows(board);
  const weekKeys = collectWeekKeys(board.rows || []);
  const dates = collectDailyDates(board.rows || []);
  const datesByWeek = groupDatesByWeek(dates);

  const tableRef = { current: null };

  const columns = [
    titleColumn(colorMap, { minWidth: 230 }),
    releasedColumn({ minWidth: 110 }),
    ratingsGroup(tableRef),
    { title: 'Financials', columns: financialColumns() },
  ];

  // Newest week leftmost, so the columns a reader wants are the ones they land
  // on rather than the ones they have to scroll to.
  const hasWeekColumns = dates.length > 0 && weekKeys.length > 0;
  if (hasWeekColumns) {
    const newestFirst = weekKeys.slice().reverse();
    columns.push({
      title: 'Weekly Gross',
      columns: newestFirst.map(
        (key, index) => weekGroup(key, index === 0, datesByWeek, tableRef),
      ),
    });
  }

  // Every sort below has to name a column that exists, so an unbuilt week group
  // takes its sorts with it.
  const sortableWeeks = hasWeekColumns ? weekKeys : [];
  const initialSort = defaultSort(sortableWeeks);

  // `movie-table` is part of the markup contract both pages carry: the element
  // a Tabulator instance is built into, and what the id-keyed table rules in
  // the stylesheet name.
  const table = new Tabulator('#movie-table', {
    ...TABLE_OPTIONS,
    data: rows,
    columns,
    initialSort,
  });

  guardMovieLinks('movie-table');

  tableRef.current = table;

  return { table, initialSort, sortMap: buildSortMap(sortableWeeks, initialSort) };
}

// ── Compact table ─────────────────────────────────────────────────────────

export function buildCompactTable(board, colorMap) {
  const rows = compactRows(board);
  const weekKeys = collectWeekKeys(board.rows || []);
  const newestFirst = weekKeys.slice().reverse();

  const weekColumns = newestFirst.map(compactWeekColumn);

  const columns = [
    titleColumn(colorMap, { width: 224, minWidth: 184 }),
    releasedColumn({ width: 112, minWidth: 104 }),
    {
      title: 'B/E',
      field: 'breakeven',
      hozAlign: 'right',
      width: 88,
      minWidth: 76,
      formatter: moneyCell,
      sorter: 'number',
    },
    {
      title: 'Total Profit',
      field: 'profitTd',
      hozAlign: 'right',
      width: 110,
      minWidth: 96,
      formatter: signedMoneyCell,
      sorter: 'number',
    },
    {
      title: 'ROI',
      field: 'roi',
      hozAlign: 'right',
      width: 84,
      minWidth: 72,
      formatter: roundedRoiCell,
      sorter: 'number',
    },
    ...weekColumns,
  ];

  // The same default order as the detailed view, so switching between the two
  // does not reshuffle the page under the reader.
  const initialSort = defaultSort(weekKeys);

  const table = new Tabulator('#movie-table', {
    ...TABLE_OPTIONS,
    data: rows,
    columns,
    initialSort,
  });

  guardMovieLinks('movie-table');

  return { table, initialSort, sortMap: buildSortMap(weekKeys, initialSort) };
}
