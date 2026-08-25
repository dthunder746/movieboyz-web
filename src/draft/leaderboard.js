// One card per roster member for the Season on screen: their total, their rank,
// and the three Picks it is made of.
//
// Ported from the old site's `js/draft/leaderboard.js`. What changed is who the
// cards are for: the old page listed the five names it had in its source, and
// this lists the Campaign's roster, keyed by User id with the published name on
// the front (#52).

import { colorClass, escapeHtml, fmt } from '../shared/format.js';

import { isSeasonalOrAlt, leaderboardForDraft, picksForDraft } from './season-helpers.js';
import { getAffectedImdbIds } from './whatif-store.js';

// The signed form the picks list uses. The card's own total is unsigned, so the
// two read as a figure and its parts rather than as two figures.
function fmtSigned(value) {
  if (value == null) return '—';
  if (value === 0) return fmt(0);
  return (value > 0 ? '+' : '-') + fmt(Math.abs(value));
}

// A Slate is three slots wide whatever it holds, so an empty one is a gap in a
// row of three rather than a shorter card.
function pickRow(pick, affected) {
  if (!pick) {
    return '<div class="draft-lb-pick">'
      + '<span class="draft-lb-pick-name text-neu">—</span>'
      + '<span class="draft-lb-pick-profit text-neu">—</span>'
      + '</div>';
  }

  if (pick.ghost) {
    return '<div class="draft-lb-pick draft-lb-pick-ghost">'
      + '<span class="draft-lb-pick-name text-neu">(cleared)</span>'
      + '<span class="draft-lb-pick-profit text-neu">—</span>'
      + '</div>';
  }

  const profitHtml = pick.profitTd == null
    ? '<span class="text-neu">—</span>'
    : `<span class="${colorClass(pick.profitTd)}">${fmtSigned(pick.profitTd)}</span>`;
  const swappedAttr = affected[pick.imdbId] ? ' data-swapped="1"' : '';

  return `<div class="draft-lb-pick"${swappedAttr} title="${escapeHtml(pick.title)}">`
    + `<span class="draft-lb-pick-name">${escapeHtml(pick.title)}</span>`
    + `<span class="draft-lb-pick-profit">${profitHtml}</span>`
    + '</div>';
}

export function buildLeaderboard(view, season, colorMap, mountEl) {
  if (!mountEl) return;

  // Nothing to rank until the Season has been drafted. The year-long Picks on
  // the Winter board are not a draft, which is why this asks for the two types
  // the leaderboard scores rather than for any Pick at all.
  const anySeasonalPicks = picksForDraft(view, season).some(isSeasonalOrAlt);
  if (!anySeasonalPicks) {
    mountEl.innerHTML = '<p class="draft-empty draft-leaderboard-empty">No picks yet — leaderboard will populate after the draft.</p>';
    return;
  }

  const rows = leaderboardForDraft(view, season);
  const affected = getAffectedImdbIds();

  const cards = rows.map((row, index) => {
    const totalHtml = `<span class="${colorClass(row.total)}">${fmt(row.total)}</span>`;
    const hasSwap = row.picks.some((pick) => pick && affected[pick.imdbId]);
    const changedAttr = hasSwap ? ' data-changed="1"' : '';
    const color = colorMap[row.userId] || '#ccc';

    return `<div class="draft-lb-card" data-user="${escapeHtml(row.userId)}"${changedAttr}>`
      + '<div class="draft-lb-head">'
      + '<span class="draft-lb-owner">'
      + `<span class="owner-dot" style="background:${color}"></span>`
      + escapeHtml(row.username ?? row.userId)
      + '</span>'
      + `<span class="draft-lb-rank">#${index + 1}</span>`
      + '</div>'
      + `<div class="draft-lb-total">${totalHtml}</div>`
      + '<div class="draft-lb-picks">'
      + pickRow(row.picks[0], affected)
      + pickRow(row.picks[1], affected)
      + pickRow(row.picks[2], affected)
      + '</div>'
      + '</div>';
  }).join('');

  mountEl.innerHTML = `<div class="draft-lb-grid">${cards}</div>`;
}
