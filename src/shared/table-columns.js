// The column definitions a Tabulator table over Movies is built from, and the
// options it is built with.
//
// Tabulator itself is a CDN global and each page builds its own instance; what
// is here is the parts of that instance that say nothing about a League: the
// base options, the cell formatters, the week and day columns, and the sort
// orders over them (#160). A page adds its own columns either side of these.
//
// ── The row fields this module reads ──────────────────────────────────────
// The rows a page hands its table carry, per Movie:
//
//   week_<isoWeekKey>   — what the Movie took in that week (`2026-W10`)
//   daily_<isoDate>     — what it took on that day (`2026-03-04`)
//   releaseDate         — the ISO date, or the literal 'TBA'
//
// `defaultSort` and `buildSortMap` name the first two, so a page whose rows
// spell them differently sorts on columns that are not there. Ticket 41 (#162)
// makes the Movies page's rows carry the same names.

import { RATING_SOURCES, TABLE_RATING_KEYS } from './ratings.js';
import {
  colorClass,
  fmt,
  fmtPct,
  formatDayMonth,
  formatFullDate,
  getWeekdayAbbr,
  isoWeekBounds,
  ratingColorClass,
  shiftIsoDate,
  weekTitle,
} from './format.js';

export const DASH = '<span class="text-neu">—</span>';

// ── The options both tables are built with ────────────────────────────────

// Anything a reader would notice switching between the compact and the
// detailed view, or between the Movies page and a Campaign, belongs here
// rather than in either table. Each page spreads this and overrides only what
// is genuinely its own: the page-size selector and, on the Movies page, the
// placeholder. Both used to keep their own copy of the list and the two had
// already begun to drift.
//
// `renderHorizontal: 'virtual'` is the reason the list moved. The detailed
// view carries a week group per published week and a column per day inside
// each, which on the 2026 slate is about 310 leaf columns; Tabulator's default
// `'basic'` renderer builds a cell for every one of them on every rendered
// row, and that is what made both tables lag on a resize. The virtual renderer
// builds only the columns in view.
//
// It is safe over the shape both tables have. The renderer leaves a frozen
// column out of the virtual window and appends it to every row itself, so the
// frozen Movie column is unaffected, and Tabulator's own compatibility check
// objects only to a `fitDataTable` layout, responsive columns and right-to-left
// text, none of which are here.
export const BASE_TABLE_OPTIONS = {
  layout: 'fitDataFill',
  responsiveLayout: false,
  // Header titles sit on the bottom of the header, which is what lines an
  // ungrouped column's title up with the ones under a group heading. Without
  // it the detailed view's plain columns rode at the top of a header the
  // Ratings and Weekly Gross groups had made two rows tall.
  columnHeaderVertAlign: 'bottom',
  resizableColumns: false,
  selectableRows: true,
  pagination: true,
  paginationSize: 50,
  // Addressing rows by imdb id is what lets a page push a chart selection back
  // into the table. Without it Tabulator indexes on a field these rows do not
  // carry, and `getRow(imdbId)` silently finds nothing.
  index: 'imdbId',
  renderHorizontal: 'virtual',
};

// ── Formatters ────────────────────────────────────────────────────────────
// Tabulator hands each of these a cell and takes an HTML string back.

export function moneyCell(cell) {
  const value = cell.getValue();
  if (value === null || value === undefined) return DASH;
  return fmt(value);
}

export function signedMoneyCell(cell) {
  const value = cell.getValue();
  if (value === null || value === undefined) return DASH;
  return `<span class="${colorClass(value)}">${fmt(value)}</span>`;
}

export function roiCell(cell) {
  const value = cell.getValue();
  if (value === null || value === undefined) return DASH;
  return `<span class="${colorClass(value)}">${fmtPct(value)}</span>`;
}

// The compact view rounds ROI to whole percent. It is the narrowest column on
// the page and a decimal there buys nothing.
export function roundedRoiCell(cell) {
  const value = cell.getValue();
  if (value === null || value === undefined) return DASH;
  const sign = value > 0 ? '+' : '';
  return `<span class="${colorClass(value)}">${sign}${Math.round(value)}%</span>`;
}

// A week total is either money taken or nothing. There is no losing week, so the
// negative branch of `colorClass` would never fire and zero reads neutral.
export function weekTotalCell(cell) {
  const value = cell.getValue();
  if (value === null || value === undefined) return DASH;
  return `<span class="${value > 0 ? 'text-pos' : 'text-neu'}">${fmt(value)}</span>`;
}

export function weekGrossCell(cell) {
  const value = cell.getValue();
  if (value === null || value === undefined) return DASH;
  return `<span class="${colorClass(value)}">${fmt(value)}</span>`;
}

// A negative day is a revision of an earlier estimate rather than money handed
// back, so it gets its own class instead of being painted as a loss. The
// footnote under the table explains it.
export function dailyCell(cell) {
  const value = cell.getValue();
  if (value === null || value === undefined) return DASH;
  if (value < 0) return `<span class="daily-neg-revised">${fmt(value)}</span>`;
  return `<span class="${colorClass(value)}">${fmt(value)}</span>`;
}

export function releaseDateCell(cell) {
  const value = cell.getValue();
  if (!value || value === 'TBA') return '<span class="text-neu">TBA</span>';
  return formatFullDate(value);
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
export function makeExpandableGroup(title, childColumns, hiddenFields, tableRef, initialExpanded) {
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

// ── Ratings ───────────────────────────────────────────────────────────────

// Six of the seven sources the platform publishes, on one axis. Only
// Letterboxd is shown by default, because it is the one the league watches;
// the rest come in behind the group's expander. What each source is called and
// how its score is read are the shared catalogue's answer (`shared/ratings.js`);
// what this adds is the column over them.
//
// Driven off the catalogue and narrowed by the keys the rows carry, rather
// than the other way round. A key naming no source would otherwise build a
// column with no label whose formatter throws on the first score it is handed;
// this way it simply has no column.
//
// The rows are expected to carry `rating_<key>` per source, which is what both
// pages' row builders write.
const RATING_COLUMN_SOURCES = RATING_SOURCES
  .filter((source) => TABLE_RATING_KEYS.includes(source.key))
  .map((source) => ({
    ...source,
    field: `rating_${source.key}`,
    visible: source.key === 'letterboxd',
  }));

export function ratingColumns() {
  return RATING_COLUMN_SOURCES.map((source, index) => ({
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

// The Ratings group as both tables carry it: Letterboxd in the open and the
// other five behind the [+] on the group header.
export function ratingsGroup(tableRef) {
  const hidden = RATING_COLUMN_SOURCES
    .filter((source) => !source.visible)
    .map((source) => source.field);

  return makeExpandableGroup('Ratings', ratingColumns(), hidden, tableRef, false);
}

// ── Sort orders ───────────────────────────────────────────────────────────

// The default order: release date ascending, then every week descending.
// Tabulator takes the last entry of a multi-column sort as the primary key, so
// this reads as "newest week's gross first, release date as the last tiebreak".
export function defaultSort(weekKeys) {
  const base = [{ column: 'releaseDate', dir: 'asc' }];
  return base.concat(weekKeys.map((key) => ({ column: `week_${key}`, dir: 'desc' })));
}

// The named sorts the toolbar's menu can ask for. `thisWeek` is the only entry
// the page reads back out, to learn which column the latest week landed in.
export function buildSortMap(weekKeys, initialSort) {
  const latest = weekKeys[weekKeys.length - 1];
  return {
    default: initialSort,
    profitTd: [{ column: 'profitTd', dir: 'desc' }],
    roi: [{ column: 'roi', dir: 'desc' }],
    thisWeek: latest ? [{ column: `week_${latest}`, dir: 'desc' }] : initialSort,
  };
}

// ── Week columns ──────────────────────────────────────────────────────────

// Which days a week gets a column for, most recent first. The current week only
// gets the days that have reported, since a column for a day that has not
// happened yet would read as a Movie taking nothing. Every earlier week gets all
// seven, so the grid stays rectangular once a week is closed.
export function daysForWeek(weekKey, isCurrentWeek, datesByWeek) {
  if (isCurrentWeek) return (datesByWeek[weekKey] || []).slice().sort().reverse();

  const { start } = isoWeekBounds(weekKey);
  const days = [];
  for (let offset = 6; offset >= 0; offset -= 1) days.push(shiftIsoDate(start, offset));
  return days;
}

export function dayColumn(isoDate, isCurrentWeek) {
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

// One week of the detailed view: a total, the days behind an expander, and the
// dates in the header.
export function weekGroup(weekKey, isCurrentWeek, datesByWeek, tableRef) {
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

// One week of the compact view: the total alone, under a two-line header.
export function compactWeekColumn(weekKey) {
  const weekNum = parseInt(weekKey.split('-W')[1], 10);

  return {
    title: `Gross Week #${weekNum}`,
    titleFormatter() {
      const element = document.createElement('div');
      element.className = 'compact-week-title';
      element.innerHTML = `Gross<br>Week&nbsp;#${weekNum}`;
      return element;
    },
    field: `week_${weekKey}`,
    hozAlign: 'right',
    width: 96,
    minWidth: 88,
    formatter: weekGrossCell,
    sorter: 'number',
  };
}
