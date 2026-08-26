// The Campaign page: it fetches the artifacts, builds every view model once, and
// wires the surfaces that render them to each other.
//
// The state that has to be shared lives in exactly one place each. Filters are
// in `filters.js`, the plotted-Movie selection is in `shared/selection.js`, and the
// three instances this module owns (`chart`, `table`, `cards`) are rebuilt from
// those rather than kept in step by hand.
//
// Which Campaign to show is not decided here. `entry.js` reads it off the page's
// own URL and calls in, which is what lets the same page serve both the real
// directory for the current year and the catch-all for every other year (#64).

import { paintCachedFavicon, paintLeaderFavicon } from '../shared/favicon.js';
import { fmtRelativeAgo, fmtTimestamp, formatDayMonth, getWeekdayAbbr } from '../shared/format.js';
import { mountNav } from '../shared/nav.js';
import { renderNotice } from '../shared/notice.js';
import { currentRoot } from '../shared/location.js';
import { buildColorMap } from '../shared/palettes.js';
import { draftHref } from '../shared/route.js';
import { createSelection } from '../shared/selection.js';
import { createThemeSwitch } from '../shared/theme.js';

import { buildBoard } from './board.js';
import { buildCards } from './cards.js';
import { applyChartTheme, buildChart } from './chart.js';
import { loadCampaign } from './data.js';
import { CampaignUnavailable } from '../shared/campaign-unavailable.js';
import { createFilterState } from './filters.js';
import { buildHighlights } from './highlights.js';
import { buildInfoCards } from './info-cards.js';
import { CAMPAIGN_LAYOUT } from './layout.js';
import { buildScorecards } from './scorecards.js';
import { buildStandings } from './standings.js';
import { buildCompactTable, buildDetailedTable } from './table.js';
import { hasNegativeDaily } from './table-rows.js';
import { createToolbar } from './toolbar.js';
import { createModeSwitcher, initialMode } from './view-mode.js';

const SORT_KEY = 'mbTableSort';

// The sort menu's ids, mapped onto a card comparator. `default` is the tables'
// week-gross order, reproduced in `table-rows.js` so switching view does not
// reshuffle the page.
const CARD_SORT = {
  default: { field: 'default', dir: 'asc' },
  release_asc: { field: 'releaseDate', dir: 'asc' },
  release_desc: { field: 'releaseDate', dir: 'desc' },
  profit_desc: { field: 'profitTd', dir: 'desc' },
  profit_asc: { field: 'profitTd', dir: 'asc' },
  roi_desc: { field: 'roi', dir: 'desc' },
  roi_asc: { field: 'roi', dir: 'asc' },
  week_desc: { field: 'thisWeek', dir: 'desc' },
  week_asc: { field: 'thisWeek', dir: 'asc' },
  lb_desc: { field: 'ratingLetterboxd', dir: 'desc' },
  lb_asc: { field: 'ratingLetterboxd', dir: 'asc' },
};

// The same ids against the Tabulator column that carries the figure. The week
// column is not here because its name depends on which week is latest.
const SORT_COLUMNS = {
  release: 'releaseDate',
  profit: 'profitTd',
  roi: 'roi',
  lb: 'rating_letterboxd',
};

// How long the skeleton stays up during a view swap. Below this the overlay
// reads as a flicker rather than a transition.
const SWAP_MIN_MS = 220;

function init({ campaign, slices }) {
  const board = buildBoard(campaign, slices);
  const standings = buildStandings(campaign, board);
  const highlights = buildHighlights(board);

  // Colours are handed out over the Users the Campaign scored, in sorted order,
  // so a User keeps their colour whatever order the artifact lists them in.
  const usernames = new Map(
    (campaign.roster || []).map((member) => [member.user_id, member.username]),
  );
  const userIds = (campaign.users || []).map((user) => user.user_id).sort();
  const users = userIds.map((userId) => ({ userId, username: usernames.get(userId) ?? userId }));
  const colorMap = buildColorMap(userIds);

  paintLeaderFavicon(standings.rows, colorMap);
  renderChrome(campaign);

  // ── Shared state ────────────────────────────────────────────────────────

  let chart = null;
  let table = null;
  let cards = null;

  let renderedMode = initialMode();
  let initialSort = null;
  let latestWeekColumn = null;
  let sortId = localStorage.getItem(SORT_KEY) || 'default';

  // Tabulator announces a selection change whether the reader made it or the
  // page did. Without this the sync back into the table would echo out again as
  // a fresh selection.
  let suppressSelectionEcho = false;
  let suppressSortEcho = false;

  const clearSelectionButton = document.getElementById('clear-movie-selection');
  const sortMenu = document.getElementById('sort-menu');

  const selection = createSelection((activeMovieIds) => {
    const activeUsers = filters.snapshot().users || [];
    rebuildChart(activeUsers, activeMovieIds);
    if (clearSelectionButton) clearSelectionButton.disabled = activeMovieIds.length === 0;
    if (cards) cards.syncSelection();
  });

  const filters = createFilterState({ onChange: (snapshot) => rerenderForFilters(snapshot) });
  const toolbar = createToolbar({ filters, users, colorMap });

  // ── Chart ───────────────────────────────────────────────────────────────

  function chartHeadingText(activeUsers, activeMovieIds) {
    if (activeMovieIds.length === 1) {
      return board.byId.get(activeMovieIds[0])?.title ?? 'Selected Movie';
    }
    if (activeMovieIds.length === 2) {
      return activeMovieIds.map((id) => board.byId.get(id)?.title ?? id).join(' · ');
    }
    if (activeMovieIds.length > 2) return `${activeMovieIds.length} Movies`;
    if (activeUsers.length === 1) {
      return `${usernames.get(activeUsers[0]) ?? activeUsers[0]}: Movie Profits`;
    }
    return 'Profit Over Time';
  }

  function rebuildChart(activeUsers, activeMovieIds) {
    if (chart) chart.destroy();
    chart = buildChart(campaign, activeUsers, activeMovieIds, colorMap);

    const heading = document.getElementById('chart-heading');
    if (heading) heading.textContent = chartHeadingText(activeUsers, activeMovieIds);
  }

  // ── Filters ─────────────────────────────────────────────────────────────

  function applyTableFilter(visibleIds) {
    if (!table) return;
    const wanted = new Set(visibleIds);
    table.setFilter((row) => wanted.has(row.imdbId));
  }

  // The chart answers only to the User selection and the plotted Movies. Search,
  // pick type and the rest narrow the table alone, so rebuilding the chart on
  // every one of them would tear it down and redraw it on each keystroke.
  let previousUsersSignature = '';

  function rerenderForFilters(snapshot) {
    toolbar.refresh();

    const visibleIds = filters.filter(board.rows, board.latestDate);
    if (renderedMode === 'cards') cards?.setVisibleIds(visibleIds);
    else applyTableFilter(visibleIds);

    const activeUsers = snapshot.users || [];
    const signature = activeUsers.slice().sort().join('|');
    if (signature !== previousUsersSignature) {
      previousUsersSignature = signature;
      rebuildChart(activeUsers, selection.toArray());
    }
  }

  // ── Sorting ─────────────────────────────────────────────────────────────

  function sortColumnFor(id) {
    const prefix = id.slice(0, id.lastIndexOf('_'));
    if (prefix === 'week') return latestWeekColumn;
    return SORT_COLUMNS[prefix] ?? null;
  }

  function tableSortSpec(id) {
    if (id === 'default' || !CARD_SORT[id]) return initialSort;

    const column = sortColumnFor(id);
    // A view can lack the column a sort names: the compact table has no ratings,
    // and a Campaign with no gross yet has no week columns. Falling back beats
    // asking Tabulator to sort on something that is not there.
    if (!column || !table?.getColumn(column)) return initialSort;

    return [{ column, dir: id.endsWith('_asc') ? 'asc' : 'desc' }];
  }

  // The reverse: which menu entry a click on a column header amounts to, so the
  // menu keeps showing what the table is actually sorted by.
  function idFromSorters(sorters) {
    if (!sorters || !sorters.length) return 'default';

    const [sorter] = sorters;
    const field = sorter.field
      ?? (sorter.column?.getField ? sorter.column.getField() : null);
    const suffix = sorter.dir === 'asc' ? 'asc' : 'desc';

    // A multi-column sort led by release date is the default order, not a
    // release-date sort the reader asked for.
    if (sorters.length > 1 && field === 'releaseDate') return 'default';

    if (field === 'releaseDate') return `release_${suffix}`;
    if (field === 'profitTd') return `profit_${suffix}`;
    if (field === 'roi') return `roi_${suffix}`;
    if (field === 'rating_letterboxd') return `lb_${suffix}`;
    if (latestWeekColumn && field === latestWeekColumn) return `week_${suffix}`;
    return 'custom';
  }

  function markActiveSort(id) {
    if (!sortMenu) return;
    for (const button of sortMenu.querySelectorAll('[data-sort]')) {
      button.classList.toggle('active', button.dataset.sort === id);
    }
  }

  function applySort(id) {
    sortId = id;
    if (id !== 'custom') localStorage.setItem(SORT_KEY, id);
    markActiveSort(id);

    if (renderedMode === 'cards') {
      const spec = CARD_SORT[id] || CARD_SORT.default;
      cards?.setSort(spec.field, spec.dir);
    } else if (table && id !== 'custom') {
      suppressSortEcho = true;
      table.setSort(tableSortSpec(id));
      suppressSortEcho = false;
    }
  }

  // ── Table and cards ─────────────────────────────────────────────────────

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
  const boardHasNegativeDaily = hasNegativeDaily(board.rows);
  function updateDailyFootnote(mode) {
    const footnote = document.getElementById('daily-neg-footnote');
    if (footnote) {
      footnote.classList.toggle('d-none', !(boardHasNegativeDaily && mode === 'detailed'));
    }
  }

  // Reserve the surface's height and fade a skeleton over it during the swap.
  // Tabulator renders asynchronously, so without this the page collapses to
  // nothing for a frame and takes the reader's scroll position with it.
  function beginSwap(isSwitch) {
    const surface = document.getElementById('table-surface');
    const overlay = document.getElementById('render-overlay');
    const scrollY = window.scrollY;

    if (isSwitch && surface) {
      const height = surface.offsetHeight;
      if (height) surface.style.minHeight = `${height}px`;
      if (overlay) {
        overlay.classList.remove('d-none');
        void overlay.offsetWidth; // reflow, so the opacity transition runs
        overlay.classList.add('is-visible');
      }
    }

    const shownAt = performance.now();
    let done = false;

    return function finish() {
      if (done) return;
      const elapsed = performance.now() - shownAt;
      if (isSwitch && elapsed < SWAP_MIN_MS) {
        setTimeout(finish, SWAP_MIN_MS - elapsed);
        return;
      }
      done = true;
      if (surface) surface.style.minHeight = '';
      if (isSwitch) window.scrollTo(0, scrollY);
      if (overlay) {
        overlay.classList.remove('is-visible');
        setTimeout(() => overlay.classList.add('d-none'), 200);
      }
    };
  }

  function renderTable(mode) {
    if (!CARD_SORT[sortId]) sortId = 'default';
    const finishSwap = beginSwap(!!(table || cards));

    if (table) { table.destroy(); table = null; }
    if (cards) { cards.destroy(); cards = null; }

    const tableElement = document.getElementById('movie-table');
    const cardsElement = document.getElementById('movie-cards');
    tableElement.classList.toggle('d-none', mode === 'cards');
    cardsElement.classList.toggle('d-none', mode !== 'cards');
    tableElement.classList.toggle('mode-compact', mode === 'compact');
    tableElement.classList.toggle('mode-detailed', mode === 'detailed');

    const visibleIds = filters.filter(board.rows, board.latestDate);
    renderedMode = mode;
    updateHelperText(mode);
    updateDailyFootnote(mode);

    if (mode === 'cards') {
      const spec = CARD_SORT[sortId] || CARD_SORT.default;
      cards = buildCards(board, colorMap, selection, visibleIds, spec.field, spec.dir);
      markActiveSort(sortId);
      requestAnimationFrame(finishSwap);
      return;
    }

    const built = mode === 'compact'
      ? buildCompactTable(board, colorMap)
      : buildDetailedTable(board, colorMap);

    table = built.table;
    initialSort = built.initialSort;

    const thisWeek = built.sortMap?.thisWeek;
    latestWeekColumn = /^week_/.test(thisWeek?.[0]?.column ?? '') ? thisWeek[0].column : null;

    suppressSortEcho = true;

    table.on('rowSelectionChanged', (selectedData) => {
      if (suppressSelectionEcho) return;
      selection.set(selectedData.map((row) => row.imdbId));
    });
    markActiveSort(sortId);

    table.on('dataSorted', (sorters) => {
      if (suppressSortEcho) return;
      const id = idFromSorters(sorters);
      sortId = id;
      if (id !== 'custom') localStorage.setItem(SORT_KEY, id);
      markActiveSort(id);
    });

    // Tabulator ignores `deselectRow`, `getRow`, `setFilter` and `setSort`
    // until the table has built its rows. Calling them synchronously after
    // construction warns and then silently does nothing, which dropped the
    // row highlight and the active filter on every view-mode swap: the
    // selection survived in `selection` (so the chart kept plotting it) while
    // the rebuilt table came back with nothing selected.
    const onBuilt = () => {
      syncSelectionIntoTable();
      applyTableFilter(visibleIds);
      if (sortId !== 'default') table.setSort(tableSortSpec(sortId));
      suppressSortEcho = false;
      requestAnimationFrame(finishSwap);
    };
    if (table.initialized) onBuilt();
    else table.on('tableBuilt', onBuilt);

    // In case tableBuilt has already fired. Both callbacks are idempotent.
    setTimeout(() => {
      suppressSortEcho = false;
      finishSwap();
    }, 250);
  }

  // ── First render ────────────────────────────────────────────────────────

  buildScorecards(standings, colorMap);
  buildInfoCards(highlights, colorMap);
  rebuildChart([], []);
  renderTable(renderedMode);
  toolbar.refresh();

  // ── Remaining controls ──────────────────────────────────────────────────

  createModeSwitcher({ initial: renderedMode, onChange: renderTable });

  createThemeSwitch((theme) => {
    if (chart) applyChartTheme(chart, theme);
    // Tabulator bakes theme colours into rendered cells, so it has to be told.
    if (table) table.redraw(true);
  });

  if (sortMenu) {
    sortMenu.addEventListener('click', (event) => {
      const button = event.target.closest('[data-sort]');
      if (button) applySort(button.dataset.sort);
    });
  }

  clearSelectionButton?.addEventListener('click', () => {
    selection.clear();
    if (table) {
      suppressSelectionEcho = true;
      table.deselectRow();
      suppressSelectionEcho = false;
    }
  });

  document.getElementById('reset-zoom')?.addEventListener('click', () => {
    if (!chart) return;
    if (chart._zoomReset) chart.zoomScale('x', chart._zoomReset);
    else chart.resetZoom();
  });

  const chartWrapper = document.getElementById('chart-wrapper');

  function toggleFullscreen(on) {
    chartWrapper.classList.toggle('is-fullscreen', on);
    if (chart) requestAnimationFrame(() => chart.resize());
  }

  document.getElementById('fullscreen-chart')?.addEventListener('click', () => {
    toggleFullscreen(!chartWrapper.classList.contains('is-fullscreen'));
  });
  document.getElementById('fullscreen-close')?.addEventListener('click', () => {
    toggleFullscreen(false);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && chartWrapper.classList.contains('is-fullscreen')) {
      toggleFullscreen(false);
    }
  });
}

// ── Header and footer ─────────────────────────────────────────────────────

// The artifact publishes its capture time in UTC, where the old data.json
// published it already localised. Rendering through a Date puts it back into the
// reader's own zone rather than showing them somebody else's clock.
function renderChrome(campaign) {
  // The link to this Campaign's own draft page. It is written from the League
  // and the year the artifact carries rather than from the address the page was
  // served at, so the catch-all's copy of the page points at the year it is
  // actually showing.
  //
  // The markup ships it hidden, so an artifact carrying neither a League nor a
  // year renders no link at all rather than one pointing back at this page.
  const draftLink = document.getElementById('campaign-draft-link');
  const draftLinkWrap = document.getElementById('campaign-draft-link-wrap');
  if (draftLink && draftLinkWrap && campaign.league_slug && campaign.year) {
    draftLink.setAttribute('href', draftHref(currentRoot(), campaign.league_slug, campaign.year));
    draftLinkWrap.hidden = false;
  }

  const capturedAt = campaign.generated_at ? new Date(campaign.generated_at) : null;

  if (capturedAt && !Number.isNaN(capturedAt.getTime())) {
    const element = document.getElementById('data-updated');
    if (element) element.textContent = `Data updated ${fmtTimestamp(capturedAt)}`;
  }

  if (!campaign.latest_date) return;

  // Day and month, with the leading zero kept on the day and dropped from the
  // month, which is how the old header read.
  const [day, month] = formatDayMonth(campaign.latest_date).split('/');
  const dateLabel = `Latest Gross: ${getWeekdayAbbr(campaign.latest_date)}`
    + ` ${day}/${parseInt(month, 10)}`;
  const updatedLabel = capturedAt ? `Updated ${fmtRelativeAgo(capturedAt)}` : '';

  const dateElement = document.getElementById('latest-gross-date');
  const updatedElement = document.getElementById('latest-gross-updated');
  if (dateElement) dateElement.textContent = dateLabel;
  if (updatedElement) updatedElement.textContent = updatedLabel;

  document.querySelector('.navbar-status')?.classList.remove('d-none');

  // The same two lines behind a popover, for the narrow layout that hides them.
  const toggle = document.getElementById('navbar-status-toggle');
  if (toggle && window.bootstrap?.Popover) {
    toggle.setAttribute('data-bs-content', dateLabel + (updatedLabel ? `<br>${updatedLabel}` : ''));
    toggle.classList.remove('d-none');
    new window.bootstrap.Popover(toggle, {
      html: true, trigger: 'click', placement: 'bottom', container: 'body',
    });
  }
}

// ── Load ──────────────────────────────────────────────────────────────────

// Show one Campaign, named by the caller. The markup goes in first so that the
// surfaces exist before anything paints into them, and the navigation goes in
// with the rest once the artifacts land. It waits on the whole load rather than
// on the Manifest alone because `loadManifest` does not dedupe, so mounting the
// navigation early would cost a second fetch of the same file to save a few
// milliseconds of a wave that is already running in parallel.
export async function startCampaignPage({ leagueSlug, year }) {
  const page = document.getElementById('page');
  if (page) page.innerHTML = CAMPAIGN_LAYOUT;

  paintCachedFavicon();

  let loaded;
  try {
    loaded = await loadCampaign({ leagueSlug, year });
  } catch (error) {
    renderLoadFailure(error, year);
    return;
  }

  mountNav(loaded.manifest);
  init(loaded);
}

// A Campaign path that leads nowhere is an ordinary outcome here: the catch-all
// page answers any year, published or not (#64). The notice replaces the whole
// page rather than sitting under an empty Board, and it carries the navigation
// so the years that do exist are one click away.
function renderLoadFailure(error, year) {
  if (error instanceof CampaignUnavailable) {
    renderNotice({
      manifest: error.manifest,
      heading: `No ${error.year} campaign`,
      message: error.published
        ? `The ${error.year} campaign is published but its file could not be read just now. Try again shortly.`
        : `The ${error.year} campaign has not been published yet, so there is nothing to show.`,
    });
    return;
  }

  // Anything else failed before the Manifest landed, so the navigation renders
  // with what it has, which is the Movies lookup and nothing else.
  renderNotice({
    manifest: null,
    heading: year ? `No ${year} campaign` : 'Nothing loaded',
    message: `Could not load the published artifacts: ${error.message}`,
  });
}
