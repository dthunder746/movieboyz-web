// The Movies page's entry point: it fetches the Movie slices, builds the rows
// once, and wires the Filters panel, the sort menu, the chart and the table to
// each other.
//
// The shared state lives in one place each. What the page is filtered to is in
// `filters.js`, the plotted selection is in `shared`'s selection helper, and
// the two instances this module owns (`chart`, `table`) are rebuilt from those
// rather than kept in step by hand. It is the Campaign page's shape with the
// League taken out: no Standings, no scorecards, no User colours (#62).

import { escapeHtml } from '../shared/format.js';
import { mountNav } from '../shared/nav.js';
import { createSelection } from '../shared/selection.js';
import { RENDER_OVERLAY_MARKUP, beginSwap } from '../shared/swap.js';
import { createThemeSwitch } from '../shared/theme.js';
import { createModeSwitcher, initialMode } from '../shared/view-mode.js';
import { hasNegativeDaily } from '../shared/week-fields.js';

import { buildMovieCards } from './cards.js';
import { applyChartTheme, buildMoviesChart } from './chart.js';
import { loadMovies } from './data.js';
import { createMovieFilters, publishedYears } from './filters.js';
import {
  DEFAULT_WINDOW_DAYS,
  WINDOW_OPTIONS,
  blankMessage,
  buildGrossSeries,
  skippedNote,
} from './gross-series.js';
import {
  DEFAULT_SORT,
  buildMovieRows,
  latestWeekColumn,
  parseSortId,
  sortIdFromSorters,
  sortMovieRows,
  sortRowsByField,
  sorterField,
  tableSortSpec,
} from './rows.js';
import { buildCompactMovieTable, buildDetailedMovieTable } from './table.js';
import { createToolbar } from './toolbar.js';

const SORT_KEY = 'mbMoviesSort';
const WINDOW_KEY = 'mbMoviesWindow';
const CHART_OPEN_KEY = 'mbMoviesChartOpen';

// What each sort is called in the chart heading. Read off the sort id rather
// than out of the menu label below, which is a display string with an arrow in
// it and no business being mined for a word.
const SORT_WORDS = {
  gross: 'gross',
  rating: 'rating',
  release: 'release date',
  budget: 'budget',
  week: "this week's gross",
};

// Every order the page will accept: the four questions the ticket names, each
// both ways round, and this week's gross, which the menu leads with and names
// as the default because it is the order the page opens in, the same one the
// Campaign table defaults to. The quietest week on the page is nobody's
// question, so `week_asc` is accepted but not offered; a click on the week
// column's header can still put the table in it.
//
// Ids only. What each one is called is in the menu's markup and nowhere else,
// so a label and the entry it sits on cannot drift apart.
const SORT_IDS = new Set([
  'gross_desc',
  'gross_asc',
  'release_desc',
  'release_asc',
  'budget_desc',
  'budget_asc',
  'rating_desc',
  'rating_asc',
  'week_desc',
  'week_asc',
]);

// The window the reader last chose, if it is still one the control offers.
function savedWindow() {
  const saved = parseInt(localStorage.getItem(WINDOW_KEY) ?? '', 10);
  return WINDOW_OPTIONS.includes(saved) ? saved : DEFAULT_WINDOW_DAYS;
}

function savedSort() {
  const saved = localStorage.getItem(SORT_KEY);
  return SORT_IDS.has(saved) ? saved : DEFAULT_SORT;
}

function init({ manifest, slices, missingYears }) {
  const allRows = buildMovieRows(slices);
  const latestDate = newestMeasuredDate(slices);

  // The column the newest week's gross landed in, which is what the menu's
  // "this week" entry has to be pushed into the table as, and the footnote's
  // question, which only the detailed view can raise.
  const weekColumn = latestWeekColumn(allRows);
  const pageHasNegativeDaily = hasNegativeDaily(allRows);

  renderChrome(manifest, missingYears, latestDate);

  // ── Shared state ────────────────────────────────────────────────────────

  let chart = null;
  let table = null;
  let cards = null;
  let renderedMode = initialMode();
  let sortId = savedSort();
  // The field and direction a header click left the table in, while `sortId`
  // is `custom`. The rows are put in the same order, because the chart's
  // default plot is the top of the table.
  let customOrder = null;
  let windowDays = savedWindow();
  let visibleRows = [];

  // Tabulator announces a selection change whether the reader made it or the
  // page did, and it announces a sort whether the header was clicked or the
  // menu drove it. Without these the sync back would echo out again.
  let suppressSelectionEcho = false;
  let suppressSortEcho = false;

  const clearSelectionButton = document.getElementById('clear-movie-selection');
  const sortMenu = document.getElementById('sort-menu');

  const selection = createSelection((activeMovieIds) => {
    rebuildChart();
    if (clearSelectionButton) clearSelectionButton.disabled = activeMovieIds.length === 0;
    // Repainted rather than re-rendered, so a card the reader has expanded
    // stays expanded when another one is plotted.
    if (cards) cards.syncSelection();
  });

  const filters = createMovieFilters({ onChange: () => rerender() });
  const toolbar = createToolbar({ filters, manifest });

  // ── Chart ───────────────────────────────────────────────────────────────

  function rebuildChart() {
    if (chart) {
      chart.destroy();
      chart = null;
    }

    const built = buildGrossSeries(visibleRows, {
      selectedIds: selection.toArray(),
      windowDays,
    });

    const wrapper = document.getElementById('chart-wrapper');
    const blank = document.getElementById('chart-blank');
    const message = blankMessage(built);

    if (message) {
      wrapper.classList.add('d-none');
      blank.classList.remove('d-none');
      blank.textContent = message;
    } else {
      blank.classList.add('d-none');
      wrapper.classList.remove('d-none');
      chart = buildMoviesChart(built);
    }

    // The chart holds fewer Movies than the table whenever a row's figures
    // start after the window, which is every Movie the platform began
    // measuring partway through its run.
    const note = document.getElementById('chart-note');
    if (note) {
      const text = skippedNote(built);
      note.textContent = text ?? '';
      note.classList.toggle('d-none', !text);
    }

    const heading = document.getElementById('chart-heading');
    if (heading) heading.textContent = chartHeadingText(built);
  }

  // The default is the first rows of the sort that have a curve to draw rather
  // than the first rows outright, so the heading claims that and not a top
  // five: sorted by gross the head of the list is the all-time earners, whose
  // opening months predate the platform.
  function chartHeadingText(built) {
    if (selection.size() > 0) return `${selection.size()} selected`;

    // Under a header sort the menu cannot name there is no word for the
    // order, so the heading says where the rows came from instead.
    if (sortId === 'custom') {
      return `First ${built.series.length} in the table order with box office`;
    }

    const sortWord = SORT_WORDS[String(sortId).split('_')[0]] ?? 'gross';
    return `First ${built.series.length} by ${sortWord} with box office`;
  }

  // ── Rows in view ────────────────────────────────────────────────────────

  // The rows the page is showing, in the order it is showing them. A header
  // click on a week or a day column is an order the menu has no name for, and
  // the rows are put in it all the same so the chart's default plot is the top
  // of the table rather than the top of some other list.
  function orderRows(rows) {
    if (sortId === 'custom' && customOrder) {
      return sortRowsByField(rows, customOrder.field, customOrder.direction);
    }
    return sortMovieRows(rows, sortId);
  }

  function rerender() {
    visibleRows = orderRows(filters.filter(allRows, latestDate));

    toolbar.refresh();

    const count = document.getElementById('row-count');
    if (count) {
      count.textContent = `${visibleRows.length} of ${allRows.length} Movies`;
    }

    // The cards hold every row and are narrowed by id; the tables are handed
    // the rows that are left. Either way the surface answers to the same
    // filter state.
    if (cards) cards.setVisibleIds(visibleRows.map((row) => row.imdbId));

    if (table) {
      suppressSortEcho = true;
      table.replaceData(visibleRows).then(() => {
        syncSelectionIntoTable();
        suppressSortEcho = false;
      });
    }

    rebuildChart();
  }

  // ── Sorting ─────────────────────────────────────────────────────────────

  // The button stays the word "Sort" and its arrow, as the Campaign's does.
  // Which order the table is in is the ticked entry in the menu, not the
  // length of the button: writing the order onto it made the button grow and
  // shrink as the reader changed their mind, and shoved the rest of the
  // toolbar along with it.
  function markActiveSort() {
    if (!sortMenu) return;
    for (const button of sortMenu.querySelectorAll('[data-sort]')) {
      button.classList.toggle('active', button.dataset.sort === sortId);
    }
  }

  // `fromHeader` says the table is already in this order. A custom sort only
  // ever arrives that way: it is a column the menu cannot name, so there is
  // nothing to push back into the table and nothing worth remembering between
  // visits either.
  function applySort(id, fromHeader) {
    if (!id || (!SORT_IDS.has(id) && id !== 'custom')) return;
    sortId = id;
    if (id !== 'custom') localStorage.setItem(SORT_KEY, id);
    markActiveSort();

    // A header click has already put the table in this order. Re-sorting the
    // rows here is for the chart, whose default is the top five of the sort
    // the reader is looking at.
    if (fromHeader) {
      visibleRows = orderRows(filters.filter(allRows, latestDate));
      rebuildChart();
      return;
    }

    // A card view has no header to click, so the menu's pick goes straight
    // into the cards' own comparator.
    if (cards) {
      const spec = cardSortSpec();
      cards.setSort(spec.field, spec.direction);
    }

    // The menu's pick has to be pushed into Tabulator as well as into the rows.
    // Tabulator keeps the sorter a header click left on the column and puts it
    // back on every `replaceData`, so without this the table would answer to
    // the header and the menu, the chart and the row order to the menu.
    // Only the detailed view has a Ratings column, and only it has day
    // columns, so the order the menu asks for is not always one the view on
    // screen can be put in. The rows have already been sorted by it either
    // way; the table is cleared rather than told to sort on a column it does
    // not have, so it shows them in the order they arrived in.
    if (table) {
      suppressSortEcho = true;
      const spec = tableSortSpec(sortId, weekColumn)
        .filter((entry) => table.getColumn(entry.column));
      if (spec.length) table.setSort(spec);
      else table.clearSort();
      suppressSortEcho = false;
    }

    rerender();
  }

  // The same order, as the row field the cards sort themselves on.
  function cardSortSpec() {
    if (sortId === 'custom' && customOrder) return customOrder;
    return parseSortId(sortId) ?? parseSortId(DEFAULT_SORT);
  }

  // A Tabulator sort, read back as the menu entry it amounts to. A column the
  // menu cannot name reads as custom, and the order it left the table in is
  // kept so the rows and the cards can be put in it too.
  function sortFromHeader(sorters) {
    const id = sortIdFromSorters(sorters, weekColumn);
    if (!id) return;
    customOrder = id === 'custom' ? sorterField(sorters) : null;
    if (id !== sortId || id === 'custom') applySort(id, true);
  }

  // ── Table ───────────────────────────────────────────────────────────────

  function syncSelectionIntoTable() {
    if (!table) return;
    suppressSelectionEcho = true;
    table.deselectRow();
    // Tabulator returns `false`, not undefined, for an id it does not hold, so
    // optional chaining does not guard this.
    for (const id of selection.toArray()) {
      const row = table.getRow(id);
      if (row) row.select();
    }
    suppressSelectionEcho = false;
  }

  // ── The surface: cards, compact or detailed ─────────────────────────────

  // The tooltip on the help icon, which says what the gestures are, and they
  // are not the same on a card as on a row.
  let helperTooltip = null;
  function updateHelperText(mode) {
    const element = document.getElementById('table-helper-info');
    if (!element) return;

    const text = mode === 'cards'
      ? 'Tap a card to expand. Long-press (or right-click) to plot it on the chart.'
      : 'Click rows to plot them on the chart.';

    if (!helperTooltip && window.bootstrap?.Tooltip) {
      helperTooltip = new window.bootstrap.Tooltip(element, {
        title: text, trigger: 'hover focus', placement: 'bottom',
      });
    } else if (helperTooltip) {
      helperTooltip.setContent({ '.tooltip-inner': text });
    }
  }

  // The footnote explains the daily columns, which only the detailed view has.
  function updateDailyFootnote(mode) {
    const footnote = document.getElementById('daily-neg-footnote');
    if (footnote) {
      footnote.classList.toggle('d-none', !(pageHasNegativeDaily && mode === 'detailed'));
    }
  }

  // The order to open a view in. A header sort the menu cannot name is an
  // order like any other and has to survive a view swap: without this the new
  // table would come up sorted by the default while the menu still read
  // `Custom` and the rows and the chart stayed in the old order.
  function tableInitialSort() {
    if (sortId === 'custom' && customOrder) {
      return [{ column: customOrder.field, dir: customOrder.direction }];
    }
    return tableSortSpec(sortId, weekColumn);
  }

  // Only the detailed view has day columns, so a day sort cannot be carried
  // into the compact table: there is no column to put it on. The page drops
  // back to its own default and the menu says so, rather than reading `Custom`
  // over an order nothing asked for.
  function dropSortThisModeCannotHold(mode) {
    const daily = sortId === 'custom' && customOrder?.field?.startsWith('daily_');
    if (mode !== 'compact' || !daily) return;

    sortId = DEFAULT_SORT;
    customOrder = null;
    visibleRows = orderRows(filters.filter(allRows, latestDate));
    rebuildChart();
  }

  // Build one of the three views, tearing down whichever is up. Switching
  // holds the surface's height and shows the skeleton while Tabulator renders,
  // which is asynchronous: without it the page collapses to nothing for a
  // frame and takes the reader's scroll position with it (#160).
  function renderSurface(mode) {
    dropSortThisModeCannotHold(mode);

    const finishSwap = beginSwap(!!(table || cards));

    if (table) { table.destroy(); table = null; }
    if (cards) { cards.destroy(); cards = null; }

    // `movie-table` and `movie-cards` are part of the markup contract both
    // pages carry: the two surfaces the view switch shows one of at a time.
    const tableElement = document.getElementById('movie-table');
    const cardsElement = document.getElementById('movie-cards');
    tableElement.classList.toggle('d-none', mode === 'cards');
    cardsElement.classList.toggle('d-none', mode !== 'cards');
    tableElement.classList.toggle('mode-compact', mode === 'compact');
    tableElement.classList.toggle('mode-detailed', mode === 'detailed');

    renderedMode = mode;
    updateHelperText(mode);
    updateDailyFootnote(mode);
    markActiveSort();

    if (mode === 'cards') {
      const spec = cardSortSpec();
      cards = buildMovieCards(allRows, {
        selection,
        visibleIds: visibleRows.map((row) => row.imdbId),
        sortField: spec.field,
        sortDir: spec.direction,
      });
      requestAnimationFrame(finishSwap);
      return;
    }

    const build = mode === 'compact' ? buildCompactMovieTable : buildDetailedMovieTable;

    suppressSortEcho = true;
    table = build(visibleRows, {
      // Every Movie on the page, so the week and day columns are the same set
      // whatever the filters have left. The rows handed over are the filtered
      // ones; only the columns are worked out from the whole page.
      columnRows: allRows,
      // The order the page is in, so the header shows what the menu says from
      // the first paint rather than only after the reader touches something.
      initialSort: tableInitialSort(),
      onSelectionChange: (ids) => {
        if (suppressSelectionEcho) return;
        selection.set(ids);
      },
      onSorted: (sorters) => {
        if (suppressSortEcho) return;
        sortFromHeader(sorters);
      },
    });

    // Tabulator ignores `deselectRow` and `getRow` until it has built its
    // rows: called synchronously after construction they warn and then do
    // nothing, which dropped the row highlight on every view swap.
    const onBuilt = () => {
      syncSelectionIntoTable();
      suppressSortEcho = false;
      requestAnimationFrame(finishSwap);
    };
    if (table.initialized) onBuilt();
    else table.on('tableBuilt', onBuilt);

    // In case `tableBuilt` has already fired. Both are idempotent.
    setTimeout(() => {
      suppressSortEcho = false;
      finishSwap();
    }, 250);
  }

  // ── First render ────────────────────────────────────────────────────────

  // The skeleton belongs inside the swapped surface and comes from the module
  // that drives it, so both pages carry the same one rather than a copy each.
  document.getElementById('table-surface')?.insertAdjacentHTML('beforeend', RENDER_OVERLAY_MARKUP);

  visibleRows = orderRows(allRows);
  markActiveSort();
  rerender();
  renderSurface(renderedMode);

  createModeSwitcher({ initial: renderedMode, onChange: renderSurface });

  // ── Controls ────────────────────────────────────────────────────────────

  sortMenu?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-sort]');
    if (button) applySort(button.dataset.sort, false);
  });

  clearSelectionButton?.addEventListener('click', () => {
    selection.clear();
    if (table) {
      suppressSelectionEcho = true;
      table.deselectRow();
      suppressSelectionEcho = false;
    }
  });

  const windowSelect = document.getElementById('window-select');
  if (windowSelect) {
    windowSelect.value = String(windowDays);
    windowSelect.addEventListener('change', () => {
      windowDays = parseInt(windowSelect.value, 10);
      localStorage.setItem(WINDOW_KEY, String(windowDays));
      rebuildChart();
    });
  }

  document.getElementById('reset-zoom')?.addEventListener('click', () => {
    if (!chart) return;
    chart.zoomScale('x', chart._zoomReset);
  });

  wireChartCollapse(() => chart);

  createThemeSwitch((theme) => {
    if (chart) applyChartTheme(chart, theme);
    // Tabulator bakes theme colours into rendered cells, so it has to be told.
    if (table) table.redraw(true);
  });
}

// ── Chart collapse ────────────────────────────────────────────────────────

// Collapsed is remembered, so a reader who uses this as a plain table is not
// given the chart back on every visit (#62).
function wireChartCollapse(getChart) {
  const card = document.getElementById('chart-card');
  const toggle = document.getElementById('chart-toggle');
  const body = document.getElementById('chart-body');
  if (!card || !toggle || !body) return;

  function paint(open) {
    body.classList.toggle('d-none', !open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? 'Hide chart' : 'Show chart';
    // Chart.js sizes itself to a container that had no height while hidden.
    if (open) requestAnimationFrame(() => getChart()?.resize());
  }

  let open = localStorage.getItem(CHART_OPEN_KEY) !== 'false';
  paint(open);

  toggle.addEventListener('click', () => {
    open = !open;
    localStorage.setItem(CHART_OPEN_KEY, String(open));
    paint(open);
  });
}

// ── Header and footer ─────────────────────────────────────────────────────

// The newest day any loaded slice is measured on. Each slice carries its own
// (ADR 0008), but the page reports and filters on one of them, because the
// question a reader asks of the Released filter is "out as of the latest box
// office day the page knows", not "out as of whichever day this row's own file
// happens to be measured on".
function newestMeasuredDate(slices) {
  const measured = (slices || [])
    .map((slice) => slice.latest_date)
    .filter(Boolean)
    .sort();
  return measured.length ? measured[measured.length - 1] : null;
}

// A slice the Manifest publishes that did not load leaves the page legible and
// says which year is missing, rather than breaking (#62).
function renderChrome(manifest, missingYears, latestDate) {
  mountNav(manifest);

  const notice = document.getElementById('slice-notice');

  // Nothing published at all, which is the state before the platform has
  // written its first Movie slice. Left to itself the page would show an empty
  // table under "No Movie matches these filters" and blame the reader for a
  // list that was never there.
  if (notice && publishedYears(manifest).length === 0) {
    notice.textContent = 'No Movie has been published yet, so there is nothing to list.';
    notice.classList.remove('d-none');
  } else if (notice && missingYears.length > 0) {
    const years = missingYears.join(', ');
    notice.textContent = missingYears.length === 1
      ? `The ${years} Movies have not been published yet, so they are not in this list.`
      : `The Movies for ${years} have not been published yet, so they are not in this list.`;
    notice.classList.remove('d-none');
  }

  const element = document.getElementById('data-updated');
  if (element && latestDate) {
    element.textContent = `Box office measured to ${latestDate}`;
  }
}

// ── Load ──────────────────────────────────────────────────────────────────

// No favicon paint. The Campaign page's tab icon is its League's leader, and
// this page belongs to no League (#62).

loadMovies()
  .then(init)
  .catch((error) => {
    // The navigation still goes in, with whatever the Manifest failure left it,
    // so a page that could not load its own data is not also a dead end (#64).
    mountNav(null);
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div class="alert alert-danger m-3">Failed to load the Movies: ${escapeHtml(error.message)}</div>`,
    );
  });
