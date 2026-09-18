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
  reapplyCaps = () => balanceUnpickedCards(mountEl);
  reapplyCaps();
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
export function buildYearUnpickedCards(view, today, colorMap, mountEl, mainEl) {
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
  reapplyCaps = () => fitUnpickedCardsTo(mountEl, mainEl);
  reapplyCaps();
}

// The gap between the two cards, which `.draft-unpicked-card + .draft-unpicked-card`
// sets to 0.75rem. A measured cap has to take it off the space it is dividing
// up, or the second card lands a gap's worth past the foot of the sidebar.
const CARD_GAP = 12;

function headerHeight(card) {
  const header = card.querySelector('.draft-unpicked-header');
  return header ? header.offsetHeight : 0;
}

// What the card would be if nothing capped it: its header plus its whole table,
// scroll and all, with a little room for the card's own border and padding.
function naturalHeight(card) {
  const wrap = card.querySelector('.info-card-table-wrap');
  const table = wrap ? wrap.querySelector('table') : null;
  return headerHeight(card) + (table ? table.offsetHeight : 0) + 8;
}

function sidebarCards(mountEl) {
  return [...mountEl.querySelectorAll('.draft-unpicked-card')];
}

// Below the layout's breakpoint the cards stack down the page and the cap comes
// off: there is no table beside them to line up with.
function clearCaps(cards) {
  cards.forEach((card) => { card.style.maxHeight = ''; });
  return window.innerWidth > 935;
}

// Both cards scroll inside a fixed height, and the height is whatever the
// shorter one needs, so the sidebar does not run past the picks table beside
// it. Below the layout's breakpoint the cards stack and the cap comes off.
function balanceUnpickedCards(mountEl) {
  const cards = sidebarCards(mountEl);
  if (!clearCaps(cards)) return;

  cards.forEach((card) => {
    const natural = naturalHeight(card);
    if (natural > 0) card.style.maxHeight = `${natural}px`;
  });
}

// The year tab's cap, which is the opposite problem (#89). A Season board is
// long and the cards are the short side; the year board is ten rows and the
// cards are the long side, so capping each at its own natural height left the
// sidebar ending well above the table beside it.
//
// So here the table is what the cards are measured against: together they get
// exactly its height. The split is even, except that a card too short to use
// its half lends the rest to the other one, which is what keeps a five-row
// unreleased list from sitting in half a sidebar of its own whitespace.
function fitUnpickedCardsTo(mountEl, mainEl) {
  const cards = sidebarCards(mountEl);
  if (!clearCaps(cards) || !cards.length) return;

  const available = (mainEl ? mainEl.offsetHeight : 0) - CARD_GAP * (cards.length - 1);
  const headers = cards.reduce((sum, card) => sum + headerHeight(card), 0);

  // Nothing worth measuring: either the layout has not been flushed yet, or the
  // table really is shorter than the headers alone, and crushing the cards to
  // fit it would be worse than letting them run on.
  if (available <= headers) {
    balanceUnpickedCards(mountEl);
    return;
  }

  const naturals = cards.map(naturalHeight);
  // Both lists fit inside the table's height already. Uncapped, the cards grow
  // to fill the sidebar on their own (`.draft-sidebar .info-tab-card` is
  // `flex: 1 1 0`), which lines the foot up without anything to scroll.
  if (naturals.reduce((sum, height) => sum + height, 0) <= available) return;

  const share = available / cards.length;
  const spare = naturals.reduce((sum, height) => sum + Math.max(0, share - height), 0);
  const overflowing = naturals.filter((height) => height > share).length;

  cards.forEach((card, index) => {
    const height = naturals[index] <= share
      ? naturals[index]
      : share + spare / overflowing;
    card.style.maxHeight = `${Math.round(Math.max(height, headerHeight(card)))}px`;
  });
}

// Which cap the sidebar is currently under, so a resize can re-apply the same
// one. Set by whichever builder drew last, because the two tabs want different
// answers and only the builder knows which tab is open.
let reapplyCaps = () => {};

let resizeListenerInstalled = false;

// Installed once per page load. The cap is measured, so it has to be measured
// again when the window changes width.
export function installSidebarResizeListener() {
  if (resizeListenerInstalled) return;
  resizeListenerInstalled = true;
  window.addEventListener('resize', () => { reapplyCaps(); });
}
