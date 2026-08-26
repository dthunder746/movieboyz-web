// The draft page: it fetches the Campaign artifact, builds the Board out of it,
// and renders one Season's draft into the four surfaces the layout provides.
//
// Ported from the old site's `js/draft/page.js` together with the shell that
// loaded it (`js/draft-app.js`), which had no reason to stay separate once the
// page reads which Campaign it is showing off its own URL rather than off the
// one `data.json` there would ever be (#85).
//
// Everything decided rather than rendered lives next door with a test beside
// it: the Board and the opening tab in `board.js`, every selector in
// `season-helpers.js`, and what a swap does to the Board in `whatif-store.js`.
// What is left here is wiring and markup, untested by design as the rest of the
// site's is (`league/page.js`).
//
// Which Campaign to show is not decided here. `entry.js` reads it off the URL
// and calls in, which is what lets the same page serve both the real directory
// for the current year and the catch-all for every other year (#64).

import { CampaignUnavailable } from '../shared/campaign-unavailable.js';
import { colorClass, fmt, fmtPct, fmtTimestamp } from '../shared/format.js';
import { paintCachedFavicon, paintLeaderFavicon } from '../shared/favicon.js';
import { currentRoot } from '../shared/location.js';
import { mountNav } from '../shared/nav.js';
import { renderNotice } from '../shared/notice.js';
import { buildColorMap } from '../shared/palettes.js';
import { campaignHref } from '../shared/route.js';
import { createThemeSwitch } from '../shared/theme.js';

import { buildDraftBoard, initialSeason, SEASON_LABEL, SEASON_ORDER } from './board.js';
import { loadDraft } from './data.js';
import { buildHighlights } from './highlights.js';
import { DRAFT_LAYOUT } from './layout.js';
import { buildLeaderboard } from './leaderboard.js';
import { buildPicksTable } from './picks-table.js';
import { picksForDraft, snapshotForSeason } from './season-helpers.js';
import { buildUnpickedCards, installSidebarResizeListener } from './unpicked-cards.js';
import {
  amberOutlineRows,
  fadeResetEnvelope,
  flashCellDirection,
  playLeaderboardFlip,
  snapshotLeaderboardPositions,
  tweenNumber,
} from './whatif-animate.js';
import {
  attachSelectionHandlers,
  cancelIntro,
  clearSelectionOnTabChange,
  mountWhatifMode,
  refreshLockedTooltips,
  refreshPreDraftTooltips,
  repaintSelectionAfterRender,
  updateBannerForSeason,
} from './whatif-mode.js';
import * as whatifStore from './whatif-store.js';

// Which tab was open last. A cookie rather than localStorage, carried over from
// the old site so a reader who has already picked a Season keeps it across the
// cutover, and unscoped because the three tabs mean the same thing on every
// draft page (`board.js`).
const SEASON_COOKIE = 'draft_active_season';

// How long a figure takes to travel to its new value after a swap.
const TWEEN_MS = 250;

function readCookie(name) {
  const match = document.cookie.match(new RegExp(`(?:^|;)\\s*${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name, value, years = 1) {
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + years);
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

// The calendar day, which is what says whether a Movie has opened. Deliberately
// not the Board's own latest date: a Movie that opened yesterday has not been
// scored yet and still belongs in the released list, which is where the old
// page put it.
function todayIso() {
  return new Date().toISOString().split('T')[0];
}

// ── The page body ─────────────────────────────────────────────────────────

// The tabs, the what-if pill and the four surfaces the renderers fill. Written
// once, because nothing above `#draft-app` changes when the Season does.
function draftShell(openSeason) {
  const tabs = SEASON_ORDER.map(
    (season) =>
      `<button class="draft-tab-btn${season === openSeason ? ' active' : ''}" data-season="${season}">${SEASON_LABEL[season]}</button>`,
  ).join('');

  return `<div class="draft-tab-nav" role="tablist">
      <div class="draft-tab-nav-seasons">${tabs}</div>
      <div class="draft-tab-nav-actions">
        <button class="draft-whatif-pill" id="draft-whatif-pill" type="button" aria-pressed="false" aria-label="Toggle what-if mode">
          <span class="draft-whatif-pill-icon" aria-hidden="true">⇄</span>
          <span class="draft-whatif-pill-label">what-if mode</span>
        </button>
      </div>
    </div>
    <div id="draft-whatif-banner" class="draft-whatif-banner"></div>
    <div id="draft-leaderboard"></div>
    <div class="draft-body">
      <section class="draft-main">
        <div id="draft-picks"></div>
        <div id="draft-highlights"></div>
      </section>
      <aside class="draft-sidebar">
        <div id="draft-unpicked"></div>
      </aside>
    </div>`;
}

function init({ campaign }) {
  const board = buildDraftBoard(campaign);
  const today = todayIso();

  // Colours are handed out over the Users the Campaign scored, in sorted order,
  // exactly as the Campaign page does it, so a User is the same colour on both
  // pages. The roster is not the list to hand out over: it is what the
  // leaderboard draws a card per, and a member the Campaign has not scored
  // would shift the colour of everyone sorted behind them.
  const userIds = (campaign.users || []).map((user) => user.user_id).sort();
  const colorMap = buildColorMap(userIds);

  const usernames = new Map(board.users.map((user) => [user.userId, user.username]));
  paintLeaderFavicon(
    // `users` is published ranked, highest total first, so the leader is the
    // first entry and the page re-derives nothing.
    (campaign.users || []).map((user) => ({
      userId: user.user_id,
      username: usernames.get(user.user_id) ?? user.user_id,
    })),
    colorMap,
  );

  renderChrome(board, campaign);

  const root = document.getElementById('draft-app');
  if (!root) return;

  let currentSeason = initialSeason(
    readCookie(SEASON_COOKIE),
    board.latestDate,
    board.seasonBoundaries,
  );

  root.innerHTML = draftShell(currentSeason);

  const picksEl = document.getElementById('draft-picks');
  const leaderboardEl = document.getElementById('draft-leaderboard');
  const highlightsEl = document.getElementById('draft-highlights');
  const unpickedEl = document.getElementById('draft-unpicked');

  mountWhatifMode();

  // The Board as what-if has left it. Rebuilt on every render rather than kept
  // in step, so the four surfaces cannot disagree about what is on the board.
  let currentView = whatifStore.viewOf(board);

  function render(season) {
    currentSeason = season;
    currentView = whatifStore.viewOf(board);

    // A Season nobody has drafted yet is the whole page's answer, not four
    // empty surfaces. The sidebar in particular would otherwise list every
    // Movie of that Season as unpicked, which reads as a draft that went badly
    // rather than as one that has not happened.
    if (!picksForDraft(currentView, season).length) {
      leaderboardEl.innerHTML = '';
      highlightsEl.innerHTML = '';
      unpickedEl.innerHTML = '';
      picksEl.innerHTML = `<div class="draft-empty-page"><p>No picks yet for the ${SEASON_LABEL[season] || season} draft — check back later.</p></div>`;
      updateBannerForSeason(season);
      return;
    }

    buildPicksTable(currentView, season, colorMap, picksEl);
    buildLeaderboard(currentView, season, colorMap, leaderboardEl);
    buildHighlights(currentView, season, colorMap, highlightsEl);
    buildUnpickedCards(currentView, season, today, unpickedEl);

    repaintSelectionAfterRender();
    refreshLockedTooltips();
    refreshPreDraftTooltips();
    updateBannerForSeason(season);
  }

  // ── The tabs ────────────────────────────────────────────────────────────

  root.addEventListener('click', (event) => {
    const button = event.target.closest('.draft-tab-btn');
    if (!button) return;

    const season = button.dataset.season;
    if (!SEASON_ORDER.includes(season)) return;

    for (const tab of root.querySelectorAll('.draft-tab-btn')) {
      tab.classList.toggle('active', tab.dataset.season === season);
    }
    writeCookie(SEASON_COOKIE, season);
    cancelIntro();
    render(season);
    clearSelectionOnTabChange();
  });

  // ── What-if mode's motion ───────────────────────────────────────────────
  //
  // A swap re-renders the whole board, so the figures that moved are found by
  // comparing a snapshot taken before the render with one taken after. The
  // elements themselves are new either way, which is why the leaderboard flip
  // records positions rather than nodes.

  // The cells a tween writes into, found by class rather than by position. The
  // old page indexed into the row's cells and had profit at 4 and ROI at 5,
  // where they are at 3 and 4, so a profit tween wrote a dollar figure into the
  // ROI column until the next render corrected it. A deliberate deviation from
  // "ported as it stands", noted on #85.
  function cellSpan(row, className) {
    const cell = row.querySelector(`.${className}`);
    if (!cell) return null;
    return cell.querySelector('span') || cell;
  }

  function runNumberTweens(before, after) {
    for (const card of document.querySelectorAll('#draft-leaderboard .draft-lb-card')) {
      const userId = card.dataset.user;
      const totalEl = card.querySelector('.draft-lb-total');
      if (!totalEl || !userId) continue;

      const from = before.totals[userId];
      const to = after.totals[userId];
      if (from == null || to == null) continue;
      tweenNumber(totalEl.querySelector('span') || totalEl, from, to, TWEEN_MS, fmt, colorClass);
    }

    for (const row of document.querySelectorAll('#draft-picks tbody tr')) {
      const imdbId = row.dataset.imdb;
      if (!imdbId) continue;

      const profitSpan = cellSpan(row, 'cell-profit');
      const fromProfit = before.profits[imdbId];
      const toProfit = after.profits[imdbId];
      if (profitSpan && fromProfit != null && toProfit != null && fromProfit !== toProfit) {
        tweenNumber(profitSpan, fromProfit, toProfit, TWEEN_MS, fmt, colorClass);
      }

      const roiSpan = cellSpan(row, 'cell-roi');
      const fromRoi = before.rois[imdbId];
      const toRoi = after.rois[imdbId];
      if (roiSpan && fromRoi != null && toRoi != null && fromRoi !== toRoi) {
        tweenNumber(roiSpan, fromRoi, toRoi, TWEEN_MS, fmtPct, colorClass);
      }
    }
  }

  function flashDirectionalCells(before, after) {
    for (const row of document.querySelectorAll('#draft-picks tbody tr')) {
      const imdbId = row.dataset.imdb;
      if (!imdbId) continue;
      const cell = row.querySelector('.cell-profit');
      if (cell) flashCellDirection(cell, before.profits[imdbId], after.profits[imdbId]);
    }

    for (const card of document.querySelectorAll('#draft-leaderboard .draft-lb-card')) {
      const userId = card.dataset.user;
      if (!userId) continue;
      flashCellDirection(
        card.querySelector('.draft-lb-total'),
        before.totals[userId],
        after.totals[userId],
      );
    }
  }

  function currentRowImdbIds() {
    return [...document.querySelectorAll(
      '#draft-picks tbody tr[data-imdb], #draft-unpicked tbody tr[data-imdb]',
    )].map((row) => row.dataset.imdb);
  }

  function flashNewRows(previousIds) {
    const seen = new Set(previousIds);
    amberOutlineRows(currentRowImdbIds().filter((imdbId) => !seen.has(imdbId)));
  }

  whatifStore.subscribe(() => {
    // Leaving what-if mode drops every swap at once, so there is nothing to
    // travel between: the board goes back to what it was published as.
    if (!whatifStore.getState().enabled) {
      render(currentSeason);
      return;
    }

    // A reset changes everything at once, so it fades the page rather than
    // flashing every row it touched.
    if (whatifStore.getLastOp() === 'reset') {
      fadeResetEnvelope(() => render(currentSeason), () => {});
      return;
    }

    const before = snapshotForSeason(currentView, currentSeason);
    const positions = snapshotLeaderboardPositions();
    const previousRows = currentRowImdbIds();

    render(currentSeason);

    const after = snapshotForSeason(currentView, currentSeason);
    playLeaderboardFlip(positions);
    runNumberTweens(before, after);
    flashDirectionalCells(before, after);
    flashNewRows(previousRows);
  });

  // ── First render ────────────────────────────────────────────────────────

  render(currentSeason);
  updateBannerForSeason(currentSeason);
  attachSelectionHandlers(() => currentSeason);
  installSidebarResizeListener();
  // Nothing on this page bakes a colour into rendered markup the way the
  // Campaign page's chart and Tabulator instance do, so the switch has
  // nothing to tell.
  createThemeSwitch(() => {});
}

// ── Header and footer ─────────────────────────────────────────────────────

// The title, the link back to the Campaign's own page and the capture time. The
// artifact publishes that time in UTC, where the old data.json published it
// already localised, so it goes through a Date to come back in the reader's own
// zone rather than somebody else's clock.
function renderChrome(board, campaign) {
  const leagueName = board.leagueName ?? 'MovieBoyz';
  const title = `${leagueName} ${board.year} drafts`;

  document.title = title;
  const heading = document.getElementById('draft-title');
  if (heading) heading.textContent = title;

  // Hidden in the markup until there is somewhere to point it, so a Board
  // carrying neither a League nor a year renders no link rather than one
  // leading back to this page.
  const link = document.getElementById('draft-standings-link');
  if (link && board.leagueSlug && board.year) {
    link.setAttribute('href', campaignHref(currentRoot(), board.leagueSlug, board.year));
    link.hidden = false;
  }

  const capturedAt = campaign.generated_at ? new Date(campaign.generated_at) : null;
  if (capturedAt && !Number.isNaN(capturedAt.getTime())) {
    const element = document.getElementById('data-updated');
    if (element) element.textContent = `Data updated ${fmtTimestamp(capturedAt)}`;
  }
}

// ── Load ──────────────────────────────────────────────────────────────────

// Show one Campaign's drafts, named by the caller. The markup goes in first so
// the surfaces exist before anything paints into them, and the navigation goes
// in with the rest once the artifacts land.
//
// The what-if state is hydrated before anything renders, and it is hydrated
// with this Campaign: its keys are scoped to the League and the year, so a
// swap made on one year's board never lands on another's, where its IMDB ids
// name nothing (`whatif-store.js`).
export async function startDraftPage({ leagueSlug, year }) {
  const page = document.getElementById('page');
  if (page) page.innerHTML = DRAFT_LAYOUT;

  paintCachedFavicon();
  whatifStore.hydrate({ leagueSlug, year });

  let loaded;
  try {
    loaded = await loadDraft({ leagueSlug, year });
  } catch (error) {
    renderLoadFailure(error, year);
    return;
  }

  mountNav(loaded.manifest);
  init(loaded);
}

// A draft path that leads nowhere is an ordinary outcome here: the catch-all
// answers any year, published or not (#64). The notice replaces the whole page
// rather than sitting under an empty board, and it carries the navigation so
// the years that do exist are one click away.
function renderLoadFailure(error, year) {
  if (error instanceof CampaignUnavailable) {
    renderNotice({
      manifest: error.manifest,
      heading: `No ${error.year} draft`,
      message: error.published
        ? `The ${error.year} campaign is published but its file could not be read just now. Try again shortly.`
        : `The ${error.year} campaign has not been published yet, so there is no draft to show.`,
    });
    return;
  }

  renderNotice({
    manifest: null,
    heading: year ? `No ${year} draft` : 'Nothing loaded',
    message: `Could not load the published artifacts: ${error.message}`,
  });
}
