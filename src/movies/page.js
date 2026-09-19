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
import { createThemeSwitch } from '../shared/theme.js';

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
  sortIdFromSorters,
  sortMovieRows,
  tableSortSpec,
} from './rows.js';
import { buildMovieTable } from './table.js';
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
};

// The four questions the ticket names, each both ways round.
const SORT_LABELS = {
  gross_desc: 'Gross ↓ (highest)',
  gross_asc: 'Gross ↑ (lowest)',
  release_desc: 'Released ↓ (newest)',
  release_asc: 'Released ↑ (oldest)',
  budget_desc: 'Budget ↓ (highest)',
  budget_asc: 'Budget ↑ (lowest)',
  rating_desc: 'Letterboxd ↓ (highest)',
  rating_asc: 'Letterboxd ↑ (lowest)',
};

// The window the reader last chose, if it is still one the control offers.
function savedWindow() {
  const saved = parseInt(localStorage.getItem(WINDOW_KEY) ?? '', 10);
  return WINDOW_OPTIONS.includes(saved) ? saved : DEFAULT_WINDOW_DAYS;
}

function savedSort() {
  const saved = localStorage.getItem(SORT_KEY);
  return SORT_LABELS[saved] ? saved : DEFAULT_SORT;
}

function init({ manifest, slices, missingYears }) {
  const allRows = buildMovieRows(slices);
  const latestDate = newestMeasuredDate(slices);

  renderChrome(manifest, missingYears, latestDate);

  // ── Shared state ────────────────────────────────────────────────────────

  let chart = null;
  let table = null;
  let sortId = savedSort();
  let windowDays = savedWindow();
  let visibleRows = [];

  // Tabulator announces a selection change whether the reader made it or the
  // page did, and it announces a sort whether the header was clicked or the
  // menu drove it. Without these the sync back would echo out again.
  let suppressSelectionEcho = false;
  let suppressSortEcho = false;

  const clearSelectionButton = document.getElementById('clear-movie-selection');
  const sortMenu = document.getElementById('sort-menu');
  const sortToggle = document.getElementById('sort-toggle');

  const selection = createSelection((activeMovieIds) => {
    rebuildChart();
    if (clearSelectionButton) clearSelectionButton.disabled = activeMovieIds.length === 0;
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

    const sortWord = SORT_WORDS[String(sortId).split('_')[0]] ?? 'gross';
    return `First ${built.series.length} by ${sortWord} with box office`;
  }

  // ── Rows in view ────────────────────────────────────────────────────────

  function rerender() {
    visibleRows = sortMovieRows(filters.filter(allRows, latestDate), sortId);

    toolbar.refresh();

    const count = document.getElementById('row-count');
    if (count) {
      count.textContent = `${visibleRows.length} of ${allRows.length} Movies`;
    }

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

  function markActiveSort() {
    if (sortToggle) sortToggle.textContent = `Sort: ${SORT_LABELS[sortId]}`;
    if (!sortMenu) return;
    for (const button of sortMenu.querySelectorAll('[data-sort]')) {
      button.classList.toggle('active', button.dataset.sort === sortId);
    }
  }

  function applySort(id, fromHeader) {
    if (!SORT_LABELS[id]) return;
    sortId = id;
    localStorage.setItem(SORT_KEY, id);
    markActiveSort();

    // A header click has already put the table in this order. Re-sorting the
    // rows here is for the chart, whose default is the top five of the sort
    // the reader is looking at.
    if (fromHeader) {
      visibleRows = sortMovieRows(filters.filter(allRows, latestDate), sortId);
      rebuildChart();
      return;
    }

    // The menu's pick has to be pushed into Tabulator as well as into the rows.
    // Tabulator keeps the sorter a header click left on the column and puts it
    // back on every `replaceData`, so without this the table would answer to
    // the header and the menu, the chart and the row order to the menu.
    if (table) {
      suppressSortEcho = true;
      table.setSort(tableSortSpec(sortId));
      suppressSortEcho = false;
    }

    rerender();
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

  // ── First render ────────────────────────────────────────────────────────

  visibleRows = sortMovieRows(allRows, sortId);
  markActiveSort();
  rerender();

  table = buildMovieTable(visibleRows, {
    // The remembered sort, so the header shows what the menu says from the
    // first paint rather than only after the reader touches something.
    initialSort: tableSortSpec(sortId),
    onSelectionChange: (ids) => {
      if (suppressSelectionEcho) return;
      selection.set(ids);
    },
    onSorted: (sorters) => {
      if (suppressSortEcho) return;
      const id = sortIdFromSorters(sorters);
      if (id && id !== sortId) applySort(id, true);
    },
  });

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
