// The sidebar: the Movies of this Season nobody took, split into the ones that
// have opened and the ones still to come.
//
// Ported from the old site's `js/draft/unpicked-cards.js`. The two lists are
// what-if mode's candidates, which is why the pre-draft marking lives here: a
// film that had already opened on draft day was never available to take.
//
// The one thing that changed is where "today" comes from. The old page had no
// argument to take it from: `js/draft/season-helpers.js` called its own
// `todayIso()` and read the clock. The port takes it in, so the selectors stay
// pure and testable. What the two decide is the same, because the page passes
// the same day the old helper would have computed.

import { colorClass, escapeHtml, fmt, fmtPct, formatShortDate } from '../shared/format.js';
import { pickOrSeasonIcon, userBadge } from '../shared/icons.js';

import { SEASON_LABEL } from './board.js';
import {
  profitRanksForSeason,
  unpickedReleasedForDraft,
  unpickedUnreleasedForDraft,
} from './season-helpers.js';
import { getDraftDate } from './whatif-store.js';
import {
  draftDateSeasonFor,
  profitRanksEverySeason,
  yearReleasedCandidates,
  yearUnreleasedCandidates,
  YEAR_TAB,
} from './year-picks.js';

const RANK_TIP = "Profit rank within the movie's release season";

// Who holds the film, drawn the way the picks tables draw it: the same
// `userBadge`, in the same place at the head of the title cell, so a held row
// in the sidebar reads as the held row it is (#89).
//
// Only the year tab passes a `colorMap`. A Season sidebar lists films nobody
// holds by definition, so a badge there would be a column of grey dashes.
function ownerBadge(movie, colorMap) {
  if (!colorMap) return '';
  return userBadge(movie.userId, movie.username, colorMap);
}

// A film that opened before draft day cannot be drafted, so what-if marks it
// and refuses it as a swap target.
function releasedRow(movie, ranks, draftDate, colorMap) {
  const roi = movie.breakeven ? (movie.profitTd / movie.breakeven) * 100 : null;
  const profitHtml = `<span class="${colorClass(movie.profitTd)}">${fmt(movie.profitTd)}</span>`
    + ` <span class="text-neu" style="font-size:0.9em">(${roi !== null ? fmtPct(roi) : '—'})</span>`;

  const rank = ranks[movie.imdbId];
  const rankHtml = rank != null
    ? `<span class="text-neu">#${rank}</span>`
    : '<span class="text-neu">—</span>';

  const preDraft = Boolean(draftDate && movie.releaseDate && movie.releaseDate < draftDate);
  const preDraftAttr = preDraft ? ' data-pre-draft="1" class="draft-row-pre-draft"' : '';
  const preDraftTitle = preDraft ? ' Pre-draft release.' : '';

  return `<tr data-imdb="${escapeHtml(movie.imdbId)}" data-kind="candidate"${preDraftAttr}>`
    + `<td class="cell-title" title="${escapeHtml(movie.title)}">${ownerBadge(movie, colorMap)}${pickOrSeasonIcon(movie.pickType, movie.season)}${escapeHtml(movie.title)}</td>`
    + `<td class="cell-profit text-end">${profitHtml}</td>`
    + `<td class="text-end" title="${RANK_TIP}${preDraftTitle}">${rankHtml}</td>`
    + '</tr>';
}

function unreleasedRow(movie, colorMap) {
  const dateLabel = !movie.releaseDate || movie.releaseDate === 'TBA'
    ? 'TBA'
    : formatShortDate(movie.releaseDate);

  return `<tr data-imdb="${escapeHtml(movie.imdbId)}" data-kind="candidate">`
    + `<td class="cell-title" title="${escapeHtml(movie.title)}">${ownerBadge(movie, colorMap)}${pickOrSeasonIcon(movie.pickType, movie.season)}${escapeHtml(movie.title)}</td>`
    + `<td class="text-end">${escapeHtml(dateLabel)}</td>`
    + '</tr>';
}

function releasedCard(rows, label, ranks, draftDate, colorMap) {
  if (!rows.length) {
    return '<div class="info-tab-card draft-unpicked-card draft-unpicked-released">'
      + `<div class="draft-unpicked-header">Released - Unpicked - ${label}</div>`
      + '<p class="draft-empty draft-unpicked-empty">No unpicked releases with profit data.</p>'
      + '</div>';
  }

  const body = rows.map((movie) => releasedRow(movie, ranks, draftDate, colorMap)).join('');

  return '<div class="info-tab-card draft-unpicked-card draft-unpicked-released">'
    + `<div class="draft-unpicked-header">Released - Unpicked - ${label}</div>`
    + '<div class="info-card-table-wrap draft-unpicked-scroll">'
    + '<table class="scorecard-movie-table">'
    + '<colgroup><col class="col-title"><col class="col-profit"><col class="col-rank"></colgroup>'
    + '<thead><tr>'
    + '<th>Movie</th>'
    + '<th class="text-end">Profit (ROI)</th>'
    + `<th class="text-end" title="${RANK_TIP}">Rank</th>`
    + '</tr></thead>'
    + `<tbody>${body}</tbody>`
    + '</table>'
    + '</div>'
    + '</div>';
}

function unreleasedCard(rows, label, colorMap) {
  if (!rows.length) return '';
  const body = rows.map((movie) => unreleasedRow(movie, colorMap)).join('');

  return '<div class="info-tab-card draft-unpicked-card draft-unpicked-unreleased">'
    + `<div class="draft-unpicked-header">Unreleased - Unpicked - ${label}</div>`
    + '<div class="info-card-table-wrap draft-unpicked-scroll">'
    + '<table class="scorecard-movie-table">'
    + '<thead><tr><th>Movie</th><th class="text-end">Release date</th></tr></thead>'
    + `<tbody>${body}</tbody>`
    + '</table>'
    + '</div>'
    + '</div>';
}

export function buildUnpickedCards(view, season, today, mountEl) {
  if (!mountEl) return;

  const label = SEASON_LABEL[season] || season;
  const released = unpickedReleasedForDraft(view, season, today);
  const unreleased = unpickedUnreleasedForDraft(view, season, today);
  const ranks = profitRanksForSeason(view, season);
  const draftDate = getDraftDate(season);

  mountEl.innerHTML = releasedCard(released, label, ranks, draftDate, null)
    + unreleasedCard(unreleased, label, null);
  balanceUnpickedCards(mountEl);
}

// The year tab's sidebar: the same two cards, drawn over the whole year rather
// than one Season of it, and carrying an owner badge each because the pool is
// no longer only unheld films (#89). A hit or a bomb was picked before anybody
// held anything, so it can trade with a film somebody holds now, and the badge
// is what says which ones those are.
//
// Nothing here is marked pre-draft, because the films that would carry the mark
// are not in the list: a year-long Pick can trade with any film of the year, so
// the ones already in cinemas on draft day are filtered out in `year-picks.js`
// rather than dimmed. Dimming is the Season boards' answer because there the
// list is short enough to read past; here it would be 19 unclickable rows.
export function buildYearUnpickedCards(view, today, colorMap, mountEl) {
  if (!mountEl) return;

  const label = 'All Year';
  const draftDate = getDraftDate(draftDateSeasonFor(YEAR_TAB));
  const released = yearReleasedCandidates(view, draftDate, today);
  const unreleased = yearUnreleasedCandidates(view, draftDate, today);
  const ranks = profitRanksEverySeason(view);

  // No draft date is passed down to the rows: there is nothing left in them for
  // it to mark.
  mountEl.innerHTML = releasedCard(released, label, ranks, null, colorMap)
    + unreleasedCard(unreleased, label, colorMap);
  balanceUnpickedCards(mountEl);
}

// Both cards scroll inside a fixed height, and the height is whatever the
// shorter one needs, so the sidebar does not run past the picks table beside
// it. Below the layout's breakpoint the cards stack and the cap comes off.
function balanceUnpickedCards(mountEl) {
  const cards = mountEl.querySelectorAll('.draft-unpicked-card');
  cards.forEach((card) => { card.style.maxHeight = ''; });
  if (window.innerWidth <= 935) return;

  cards.forEach((card) => {
    const header = card.querySelector('.draft-unpicked-header');
    const wrap = card.querySelector('.info-card-table-wrap');
    const table = wrap ? wrap.querySelector('table') : null;
    const natural = (header ? header.offsetHeight : 0) + (table ? table.offsetHeight : 0) + 8;
    if (natural > 0) card.style.maxHeight = `${natural}px`;
  });
}

let resizeListenerInstalled = false;

// Installed once per page load. The cap is measured, so it has to be measured
// again when the window changes width.
export function installSidebarResizeListener() {
  if (resizeListenerInstalled) return;
  resizeListenerInstalled = true;
  window.addEventListener('resize', () => {
    const mountEl = document.getElementById('draft-unpicked');
    if (mountEl) balanceUnpickedCards(mountEl);
  });
}
