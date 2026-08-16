// The scorecard strip: one collapsible card per User, ranked, with their Slate
// underneath. Ported from the old site's `weekend-strip.js`.
//
// Every figure comes off the Standings, which the processor computed. Nothing
// here scores anything; the module's whole job is markup and a collapse toggle.
//
// The old card's share button is gone (decision 4): it was the only thing that
// needed the `html-to-image` package, and dropping it keeps this repo free of
// the dependency.

import { fmt, fmtPct, colorClass, escapeHtml } from './format.js';
import { pickIcon } from './icons.js';

const BOMB_ICON_SM = '<svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="13" r="9"/><path d="m19.5 9.5 1.8-1.8a2.4 2.4 0 0 0 0-3.4l-1.6-1.6a2.4 2.4 0 0 0-3.4 0l-1.8 1.8"/><path d="m22 2-1.5 1.5"/></svg>';

const LETTERBOXD_LOGO = '<img src="https://www.google.com/s2/favicons?domain=letterboxd.com&sz=32" width="14" height="14" style="vertical-align:middle;margin-left:2px" alt="Letterboxd">';

const COLLAPSED_COOKIE = 'scorecard_collapsed';

function readCollapsed() {
  const match = document.cookie.match(/(?:^|;)\s*scorecard_collapsed=([^;]*)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1]));
  } catch {
    return null;
  }
}

function writeCollapsed(state) {
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `${COLLAPSED_COOKIE}=${encodeURIComponent(JSON.stringify(state))}`
    + `; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

function statCell(value, labelHtml, format) {
  let display;
  let cls;
  if (value === null || value === undefined) {
    display = '—';
    cls = 'text-neu';
  } else if (format === 'pct') {
    display = fmtPct(value);
    cls = colorClass(value);
  } else {
    display = fmt(value);
    cls = colorClass(value);
  }
  return '<div class="scorecard-stat">'
    + `<div class="scorecard-stat-value ${cls}">${display}</div>`
    + `<div class="scorecard-stat-label">${labelHtml}</div>`
    + '</div>';
}

// Letterboxd publishes out of 100 and the league reads out of 5.
function ratingCell(avgLetterboxd) {
  const value = avgLetterboxd === null
    ? '<div class="scorecard-stat-value text-neu">—</div>'
    : `<div class="scorecard-stat-value">${(avgLetterboxd / 20).toFixed(1)}/5${LETTERBOXD_LOGO}</div>`;
  return `<div class="scorecard-stat">${value}<div class="scorecard-stat-label">Avg. Rating</div></div>`;
}

function movieTable(released) {
  if (!released.length) {
    return '<div class="scorecard-movies"><div class="scorecard-no-movies">No movies released yet</div></div>';
  }

  const rows = released.map((pick) => '<tr>'
    + `<td>${pickIcon(pick.pickType, pick.season)}${escapeHtml(pick.title)}</td>`
    + `<td>${pick.breakeven !== null ? fmt(pick.breakeven) : '<span class="text-neu">—</span>'}</td>`
    + `<td>${pick.grossTd !== null ? fmt(pick.grossTd) : '<span class="text-neu">—</span>'}</td>`
    + `<td class="${colorClass(pick.profitTd)}">${fmt(pick.profitTd)}</td>`
    + '</tr>').join('');

  return '<div class="scorecard-movies">'
    + '<table class="scorecard-movie-table">'
    + '<thead><tr>'
    + '<th>Movie</th>'
    + '<th>B/E</th>'
    + '<th><span class="d-none d-sm-inline">Gross TD</span><span class="d-inline d-sm-none">Gr.</span></th>'
    + '<th><span class="d-none d-sm-inline">Profit TD</span><span class="d-inline d-sm-none">Pr.</span></th>'
    + '</tr></thead>'
    + `<tbody>${rows}</tbody>`
    + '</table>'
    + '</div>';
}

function footer(nextPick) {
  const inner = nextPick
    ? `<div class="scorecard-next-title" title="${escapeHtml(nextPick.title)}">`
      + '<span class="scorecard-next-title-text">'
      + `${pickIcon(nextPick.pickType, nextPick.season)}${escapeHtml(nextPick.title)}`
      + '</span>'
      + `<span class="scorecard-next-days-badge">${nextPick.daysUntil}d</span>`
      + '</div>'
    : '<div class="scorecard-next-title"><span class="scorecard-next-title-text">None scheduled</span></div>';

  return '<div class="scorecard-footer">'
    + '<div class="scorecard-footer-left">'
    + '<div class="scorecard-next-label">Next</div>'
    + inner
    + '</div>'
    + '</div>';
}

export function buildScorecards(standings, colorMap) {
  const element = document.getElementById('weekend-strip');
  if (!element) return;

  if (!standings.rows.length) {
    element.classList.add('d-none');
    return;
  }

  // Which cards start open. Only the leader's does by default, since five
  // expanded cards is more than a phone can show at once, but any card the
  // reader has opened or closed before wins over that.
  const collapsed = readCollapsed();
  function isOpen(row) {
    if (collapsed && Object.prototype.hasOwnProperty.call(collapsed, row.userId)) {
      return collapsed[row.userId] === true;
    }
    return row.rank === 1;
  }

  const cards = standings.rows.map((row) => {
    const color = colorMap[row.userId] || '#888';

    const seasonTotal = row.total !== null
      ? `<span class="scorecard-season-total ${colorClass(row.total)}">${fmt(row.total)}</span>`
      : '<span class="scorecard-season-total text-neu">—</span>';

    const header = `<div class="scorecard-header" data-user="${escapeHtml(row.userId)}">`
      + '<div class="scorecard-header-left">'
      + '<span class="scorecard-toggle-icon"></span>'
      + `<span class="owner-dot" style="background:${color}"></span>`
      + '<div>'
      + `<div class="scorecard-owner-name">${escapeHtml(row.username)}</div>`
      + `<div class="scorecard-owner-rank">#${row.rank}</div>`
      + '</div>'
      + '</div>'
      + '<div class="scorecard-header-right">'
      + seasonTotal
      + '<div class="scorecard-season-label">Season Total</div>'
      + '</div>'
      + '</div>';

    const stats = '<div class="scorecard-stats">'
      + statCell(row.slateProfit, 'Picks Total', 'plain')
      + statCell(row.bombImpact, 'Bomb Impact', 'plain')
      + ratingCell(row.avgLetterboxd)
      + statCell(row.roi, `ROI excl. ${BOMB_ICON_SM}`, 'pct')
      + '</div>';

    return `<div class="scorecard-card${isOpen(row) ? ' is-open' : ''}"`
      + ` style="border-top:3px solid ${color};--scorecard-hover-bg:color-mix(in srgb,${color} 15%,transparent)">`
      + header
      + '<div class="scorecard-body">'
      + stats
      + movieTable(row.released)
      + footer(row.nextPick)
      + '</div>'
      + '</div>';
  }).join('');

  element.classList.remove('d-none');
  element.innerHTML = `<div class="scorecard-strip">${cards}</div>`;

  element.addEventListener('click', (event) => {
    const header = event.target.closest('.scorecard-header');
    if (!header) return;
    const card = header.closest('.scorecard-card');
    if (!card) return;

    card.classList.toggle('is-open');
    const state = readCollapsed() || {};
    state[header.dataset.user] = card.classList.contains('is-open');
    writeCollapsed(state);
  });
}
