// The two Tabulator instances behind the compact and detailed views.
//
// Row data comes from `table-rows.js`, which is where the reshaping and the
// sorting rules are tested. What lives here is what Tabulator needs and nothing
// else: column definitions, cell formatters, and the header behaviour it can
// only take as callbacks. Tabulator itself is a CDN global.

import {
  colorClass,
  escapeHtml,
  fmt,
  fmtPct,
  formatDayMonth,
  formatShortDate,
  getWeekdayAbbr,
  isoWeekBounds,
  ratingColorClass,
  weekTitle,
} from './format.js';
import { pickOrSeasonIcon, userBadge } from './icons.js';
import {
  collectDailyDates,
  collectWeekKeys,
  compactRows,
  detailedRows,
  groupDatesByWeek,
} from './table-rows.js';

const MS_PER_DAY = 86400000;
const DASH = '<span class="text-neu">—</span>';

// Shared Tabulator options. Both views are the same table with different
// columns, so anything a reader would notice switching between them (page size,
// where the header sits, whether a row can be picked) belongs here rather than
// in either builder.
const TABLE_OPTIONS = {
  layout: 'fitDataFill',
  responsiveLayout: false,
  columnHeaderVertAlign: 'bottom',
  resizableColumns: false,
  selectableRows: true,
  pagination: true,
  paginationSize: 50,
  paginationSizeSelector: [10, 25, 50, 100, true],
  // Addressing rows by imdb id is what lets the page push a chart selection back
  // into the table. Without it Tabulator indexes on a field these rows do not
  // carry, and `getRow(imdbId)` silently finds nothing.
  index: 'imdbId',
};

// ── Formatters ────────────────────────────────────────────────────────────
// Tabulator hands each of these a cell and takes an HTML string back.

function moneyCell(cell) {
  const value = cell.getValue();
  if (value === null || value === undefined) return DASH;
  return fmt(value);
}

function signedMoneyCell(cell) {
  const value = cell.getValue();
  if (value === null || value === undefined) return DASH;
  return `<span class="${colorClass(value)}">${fmt(value)}</span>`;
}

function roiCell(cell) {
  const value = cell.getValue();
  if (value === null || value === undefined) return DASH;
  return `<span class="${colorClass(value)}">${fmtPct(value)}</span>`;
}

// The compact view rounds ROI to whole percent. It is the narrowest column on
// the page and a decimal there buys nothing.
function roundedRoiCell(cell) {
  const value = cell.getValue();
  if (value === null || value === undefined) return DASH;
  const sign = value > 0 ? '+' : '';
  return `<span class="${colorClass(value)}">${sign}${Math.round(value)}%</span>`;
}

// A week total is either money taken or nothing. There is no losing week, so the
// negative branch of `colorClass` would never fire and zero reads neutral.
function weekTotalCell(cell) {
  const value = cell.getValue();
  if (value === null || value === undefined) return DASH;
  return `<span class="${value > 0 ? 'text-pos' : 'text-neu'}">${fmt(value)}</span>`;
}

function weekGrossCell(cell) {
  const value = cell.getValue();
  if (value === null || value === undefined) return DASH;
  return `<span class="${colorClass(value)}">${fmt(value)}</span>`;
}

// A negative day is a revision of an earlier estimate rather than money handed
// back, so it gets its own class instead of being painted as a loss. The
// footnote under the table explains it.
function dailyCell(cell) {
  const value = cell.getValue();
  if (value === null || value === undefined) return DASH;
  if (value < 0) return `<span class="daily-neg-revised">${fmt(value)}</span>`;
  return `<span class="${colorClass(value)}">${fmt(value)}</span>`;
}

function releaseDateCell(cell) {
  const value = cell.getValue();
  if (!value || value === 'TBA') return '<span class="text-neu">TBA</span>';
  return formatShortDate(value);
}

// ── Column widths measured off the rendered font ──────────────────────────
// Week groups and day columns are titled with data, so their headers cannot be
// sized by a constant. Measuring the string against the same font the header
// uses is what stops "Feb 23–Mar 1" clipping while "Aug 10–16" wastes space.

const measureCanvas = document.createElement('canvas');

function textWidth(text, font) {
  const ctx = measureCanvas.getContext('2d');
  ctx.font = font;
  return ctx.measureText(text).width;
}

const HEADER_FONT = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const DAY_FONT = '13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

// Title text, plus the expand button (14px), its margin (6px), the cell padding
// (8px each side) and a little slack.
function weekGroupMinWidth(title) {
  return Math.ceil(textWidth(title, HEADER_FONT)) + 46;
}

// The "DD/MM" label, plus the sort arrow Tabulator pads sortable titles with
// (25px), the content padding (5px each side) and a little slack.
function dayColMinWidth(isoDate) {
  return Math.ceil(textWidth(formatDayMonth(isoDate), DAY_FONT)) + 25 + 10 + 8;
}

// ── Expandable column groups ──────────────────────────────────────────────

// A group header carrying a [+]/[−] that shows and hides the fields named in
// `hiddenFields`. `tableRef` is a box rather than the table itself because the
// group definition has to exist before the Tabulator instance it belongs to.
function makeExpandableGroup(title, childColumns, hiddenFields, tableRef, initialExpanded) {
  let expanded = !!initialExpanded;

  return {
    title,
    titleFormatter() {
      const container = document.createElement('span');
      container.textContent = title;

      const button = document.createElement('span');
      button.className = 'group-expand-btn';
      button.textContent = expanded ? '−' : '+';

      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const table = tableRef.current;
        if (!table) return;

        expanded = !expanded;
        button.textContent = expanded ? '−' : '+';

        // One relayout for the whole group. Without the block, each show/hide
        // triggers its own full redraw, so opening a week's seven day columns
        // reflows the table seven times.
        if (table.blockRedraw) table.blockRedraw();
        for (const field of hiddenFields) {
          if (expanded) table.showColumn(field);
          else table.hideColumn(field);
        }
        if (table.restoreRedraw) table.restoreRedraw();
        else if (expanded) table.redraw();
      });

      container.appendChild(button);
      return container;
    },
    columns: childColumns,
  };
}

// ── Shared columns ────────────────────────────────────────────────────────

function titleColumn(colorMap, widths) {
  return {
    title: 'Movie',
    field: 'title',
    frozen: true,
    ...widths,
    cssClass: 'col-movie-title',
    formatter(cell) {
      const row = cell.getRow().getData();
      return userBadge(row.userId, row.username, colorMap)
        + pickOrSeasonIcon(row.pickType, row.season)
        + `<span class="movie-title-text">${escapeHtml(cell.getValue())}</span>`;
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

// The default order: release date ascending, then every week descending.
// Tabulator takes the last entry of a multi-column sort as the primary key, so
// this reads as "newest week's gross first, release date as the last tiebreak".
function defaultSort(weekKeys) {
  const base = [{ column: 'releaseDate', dir: 'asc' }];
  return base.concat(weekKeys.map((key) => ({ column: `week_${key}`, dir: 'desc' })));
}

// The named sorts the toolbar's menu can ask for. `thisWeek` is the only entry
// the page reads back out, to learn which column the latest week landed in.
function buildSortMap(weekKeys, initialSort) {
  const latest = weekKeys[weekKeys.length - 1];
  return {
    default: initialSort,
    profitTd: [{ column: 'profitTd', dir: 'desc' }],
    roi: [{ column: 'roi', dir: 'desc' }],
    thisWeek: latest ? [{ column: `week_${latest}`, dir: 'desc' }] : initialSort,
  };
}

// ── Detailed table ────────────────────────────────────────────────────────

const FAVICON_BASE = 'https://www.google.com/s2/favicons?domain=';

// Six sources on one axis. Only Letterboxd is shown by default, because it is
// the one the league watches; the rest come in behind the Ratings group's
// expander. Each publishes on its own scale, so `display` puts it back into the
// units that source's readers know it by.
const RATING_SOURCES = [
  {
    field: 'rating_letterboxd',
    key: 'letterboxd',
    label: 'Letterboxd',
    icon: `${FAVICON_BASE}letterboxd.com&sz=32`,
    emoji: false,
    display: (value) => (value / 20).toFixed(1),
    visible: true,
  },
  {
    field: 'rating_imdb',
    key: 'imdb',
    label: 'IMDb',
    icon: `${FAVICON_BASE}imdb.com&sz=32`,
    emoji: false,
    display: (value) => (value / 10).toFixed(1),
    visible: false,
  },
  {
    field: 'rating_rt_audience',
    key: 'rt_audience',
    label: 'RT Audience Score',
    icon: '🍿',
    emoji: true,
    display: (value) => `${value}%`,
    visible: false,
  },
  {
    field: 'rating_rt_critic',
    key: 'rt_critic',
    label: 'RT Tomatometer',
    icon: `${FAVICON_BASE}rottentomatoes.com&sz=32`,
    emoji: false,
    display: (value) => `${value}%`,
    visible: false,
  },
  {
    field: 'rating_tmdb',
    key: 'tmdb',
    label: 'TMDB',
    icon: `${FAVICON_BASE}themoviedb.org&sz=32`,
    emoji: false,
    display: (value) => (value / 10).toFixed(1),
    visible: false,
  },
  {
    field: 'rating_metacritic',
    key: 'metacritic',
    label: 'Metacritic',
    icon: `${FAVICON_BASE}metacritic.com&sz=32`,
    emoji: false,
    display: (value) => String(value),
    visible: false,
  },
];

function ratingColumns() {
  return RATING_SOURCES.map((source, index) => ({
    title: source.label,
    field: source.field,
    cssClass: index === 0 ? 'week-sep' : undefined,
    titleFormatter() {
      if (source.emoji) return `<span style="font-size:14px;line-height:1">${source.icon}</span>`;
      return `<img src="${source.icon}" width="16" height="16"`
        + ` style="vertical-align:middle" alt="${source.label}">`;
    },
    headerTooltip: source.label,
    hozAlign: 'center',
    minWidth: source.visible ? 120 : 50,
    visible: source.visible,
    sorter: 'number',
    formatter(cell) {
      const value = cell.getValue();
      if (value === null || value === undefined) return DASH;
      return `<span class="${ratingColorClass(value)}">${source.display(value)}</span>`;
    },
    // How many people the score speaks for. A source that does not publish a
    // count gets no tooltip rather than a misleading zero.
    tooltip(event, cell) {
      const votes = cell.getRow().getData().ratings?.[source.key]?.votes;
      if (votes === null || votes === undefined) return false;
      return `${votes.toLocaleString()} votes`;
    },
  }));
}

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

function isoDateAt(startIso, offsetDays) {
  const date = new Date(new Date(`${startIso}T00:00:00Z`).getTime() + offsetDays * MS_PER_DAY);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
    + `-${String(date.getUTCDate()).padStart(2, '0')}`;
}

// Which days a week gets a column for, most recent first. The current week only
// gets the days that have reported, since a column for a day that has not
// happened yet would read as a Movie taking nothing. Every earlier week gets all
// seven, so the grid stays rectangular once a week is closed.
function daysForWeek(weekKey, isCurrentWeek, datesByWeek) {
  if (isCurrentWeek) return (datesByWeek[weekKey] || []).slice().sort().reverse();

  const { start } = isoWeekBounds(weekKey);
  const days = [];
  for (let offset = 6; offset >= 0; offset -= 1) days.push(isoDateAt(start, offset));
  return days;
}

function dayColumn(isoDate, isCurrentWeek) {
  const abbr = getWeekdayAbbr(isoDate);
  const isWeekend = abbr === 'SAT' || abbr === 'SUN';

  return {
    title: formatDayMonth(isoDate),
    field: `daily_${isoDate}`,
    hozAlign: 'right',
    minWidth: dayColMinWidth(isoDate),
    cssClass: ['col-day-column', isWeekend ? 'col-weekend' : null].filter(Boolean).join(' '),
    // Only the current week opens expanded; the rest are behind their expander.
    visible: isCurrentWeek,
    titleFormatter() {
      const cls = `col-day-label${isWeekend ? ' col-weekend-label' : ''}`;
      return `<span class="${cls}">${abbr}</span><br>${formatDayMonth(isoDate)}`;
    },
    formatter: dailyCell,
    sorter: 'number',
  };
}

function weekGroup(weekKey, isCurrentWeek, datesByWeek, tableRef) {
  const weekNum = parseInt(weekKey.split('-W')[1], 10);
  const dates = daysForWeek(weekKey, isCurrentWeek, datesByWeek);

  const totalColumn = {
    title: 'Total',
    field: `week_${weekKey}`,
    hozAlign: 'right',
    // Sized off the group header above it, which is the widest thing in the
    // column and the only part that can clip.
    minWidth: weekGroupMinWidth(weekTitle(weekKey)),
    cssClass: isCurrentWeek ? 'week-sep week-current-total' : 'week-sep',
    formatter: weekTotalCell,
    sorter: 'number',
  };

  const subGroup = {
    title: `week #${weekNum}`,
    titleFormatter() {
      const element = document.createElement('span');
      element.style.fontSize = '0.7rem';
      element.style.color = 'var(--bs-secondary-color)';
      element.style.fontWeight = 'normal';
      element.textContent = `week #${weekNum}`;
      return element;
    },
    columns: [totalColumn, ...dates.map((date) => dayColumn(date, isCurrentWeek))],
  };

  const group = makeExpandableGroup(
    weekTitle(weekKey),
    [subGroup],
    dates.map((date) => `daily_${date}`),
    tableRef,
    isCurrentWeek,
  );

  // The week still in progress is italicised, so a reader can tell a part week
  // from a closed one without reading the dates.
  if (isCurrentWeek) {
    const base = group.titleFormatter;
    group.titleFormatter = () => {
      const element = base();
      element.style.fontStyle = 'italic';
      return element;
    };
  }

  return group;
}

export function buildDetailedTable(board, colorMap) {
  const rows = detailedRows(board);
  const weekKeys = collectWeekKeys(board.rows || []);
  const dates = collectDailyDates(board.rows || []);
  const datesByWeek = groupDatesByWeek(dates);

  const tableRef = { current: null };

  const hiddenRatingFields = RATING_SOURCES
    .filter((source) => !source.visible)
    .map((source) => source.field);

  const columns = [
    titleColumn(colorMap, { minWidth: 230 }),
    releasedColumn({ minWidth: 80 }),
    makeExpandableGroup('Ratings', ratingColumns(), hiddenRatingFields, tableRef, false),
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

  const table = new Tabulator('#movie-table', {
    ...TABLE_OPTIONS,
    data: rows,
    columns,
    initialSort,
  });

  tableRef.current = table;

  return { table, initialSort, sortMap: buildSortMap(sortableWeeks, initialSort) };
}

// ── Compact table ─────────────────────────────────────────────────────────

export function buildCompactTable(board, colorMap) {
  const rows = compactRows(board);
  const weekKeys = collectWeekKeys(board.rows || []);
  const newestFirst = weekKeys.slice().reverse();

  const weekColumns = newestFirst.map((key) => {
    const weekNum = parseInt(key.split('-W')[1], 10);
    return {
      title: `Gross Week #${weekNum}`,
      titleFormatter() {
        const element = document.createElement('div');
        element.className = 'compact-week-title';
        element.innerHTML = `Gross<br>Week&nbsp;#${weekNum}`;
        return element;
      },
      field: `week_${key}`,
      hozAlign: 'right',
      width: 96,
      minWidth: 88,
      formatter: weekGrossCell,
      sorter: 'number',
    };
  });

  const columns = [
    titleColumn(colorMap, { width: 224, minWidth: 184 }),
    releasedColumn({ width: 96, minWidth: 88 }),
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

  return { table, initialSort, sortMap: buildSortMap(weekKeys, initialSort) };
}
