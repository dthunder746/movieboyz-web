// The draft order for one Season: every slot, in the order it was taken.
//
// Ported from the old site's `js/draft/picks-table.js`. The cells the swap
// animation writes into carry a class rather than being found by position, which
// is the one change to the markup and is explained where the page uses them.

import { escapeHtml, fmt, fmtPct, colorClass } from '../shared/format.js';
import { pickIcon, userBadge } from '../shared/icons.js';

import { SEASON_LABEL } from './board.js';
import { picksForDraft, profitRanksForSeason } from './season-helpers.js';

const RANK_TIP = "Profit rank within the movie's release season";

function profitCell(profit) {
  if (profit == null) return '<span class="text-neu">—</span>';
  return `<span class="${colorClass(profit)}">${fmt(profit)}</span>`;
}

function roiCell(profit, breakeven) {
  if (profit == null || breakeven == null || breakeven === 0) {
    return '<span class="text-neu">—</span>';
  }
  const roi = (profit / breakeven) * 100;
  return `<span class="${colorClass(roi)}">${fmtPct(roi)}</span>`;
}

function rankCell(rank) {
  if (rank == null) return '<span class="text-neu">—</span>';
  return `<span class="text-neu">#${rank}</span>`;
}

// An emptied slot. It keeps its place in the draft order so it can be filled
// again, which is why it renders as a row rather than disappearing.
function ghostRow(slot, colorMap) {
  const titleAttr = slot.clearedTitle ? ` title="Cleared: ${escapeHtml(slot.clearedTitle)}"` : '';

  return `<tr class="draft-row-ghost draft-row-swappable" data-kind="slot-ghost"
      data-user="${escapeHtml(slot.userId ?? '')}"
      data-pick-type="${escapeHtml(slot.pickType ?? '')}"
      data-draft-pick="${escapeHtml(slot.draftPick ?? '')}"
      data-cleared-imdb="${escapeHtml(slot.clearedImdbId ?? '')}"${titleAttr}>
      <td class="text-end">${slot.draftPick}</td>
      <td>${userBadge(slot.userId, slot.username, colorMap)}<span class="draft-row-ghost-label">— cleared —</span></td>
      <td class="text-end"><span class="text-neu">—</span></td>
      <td class="text-end cell-profit"><span class="text-neu">—</span></td>
      <td class="text-end cell-roi"><span class="text-neu">—</span></td>
      <td class="text-end"><span class="text-neu">—</span></td>
      <td class="cell-clear"></td>
    </tr>`;
}

function pickRow(pick, ranksBySeason, colorMap) {
  // `hit` and `bomb` are the year's fixed Picks. What-if cannot move them, so
  // they are shown dimmed and are not swap targets.
  const type = (pick.pickType || '').toLowerCase();
  const locked = type === 'hit' || type === 'bomb';

  const classes = locked
    ? 'draft-row-dimmed draft-row-locked'
    : 'draft-row-swappable';

  const ranks = ranksBySeason[pick.season] || {};
  const clearCell = locked
    ? '<td class="cell-clear"></td>'
    : '<td class="cell-clear"><button type="button" class="draft-clear-pick" aria-label="Clear pick">×</button></td>';

  return `<tr class="${classes}" data-imdb="${escapeHtml(pick.imdbId)}"
      data-user="${escapeHtml(pick.userId ?? '')}"
      data-pick-type="${escapeHtml(pick.pickType ?? '')}" data-kind="slot">
      <td class="text-end">${pick.draftPick}</td>
      <td class="cell-title" title="${escapeHtml(pick.title)}">${userBadge(pick.userId, pick.username, colorMap)}${pickIcon(pick.pickType, pick.season)}<span class="draft-pick-title">${escapeHtml(pick.title)}</span></td>
      <td class="text-end">${pick.breakeven != null ? fmt(pick.breakeven) : '<span class="text-neu">—</span>'}</td>
      <td class="text-end cell-profit">${profitCell(pick.profitTd)}</td>
      <td class="text-end cell-roi">${roiCell(pick.profitTd, pick.breakeven)}</td>
      <td class="text-end" title="${RANK_TIP}">${rankCell(ranks[pick.imdbId])}</td>
      ${clearCell}
    </tr>`;
}

export function buildPicksTable(view, season, colorMap, mountEl) {
  if (!mountEl) return;

  const picks = picksForDraft(view, season);
  if (!picks.length) {
    mountEl.innerHTML = '<p class="draft-empty">Draft hasn’t happened yet — check back after the picks are made.</p>';
    return;
  }

  // A Pick is ranked against the Season its Movie opened in, which is not
  // always the Season it was drafted in: a `hit` sits on the Winter board
  // whenever its film comes out.
  const ranksBySeason = {
    WINTER: profitRanksForSeason(view, 'WINTER'),
    SUMMER: profitRanksForSeason(view, 'SUMMER'),
    FALL: profitRanksForSeason(view, 'FALL'),
  };

  const rows = picks
    .map((pick) => (pick.ghost ? ghostRow(pick, colorMap) : pickRow(pick, ranksBySeason, colorMap)))
    .join('');

  mountEl.innerHTML = `<div class="info-tab-card draft-picks-card">
    <div class="draft-unpicked-header">${SEASON_LABEL[season] || season} Draft Order</div>
    <div class="draft-picks-wrap">
      <table class="draft-picks-table">
        <thead><tr>
          <th class="text-end">#</th>
          <th>Movie</th>
          <th class="text-end">B/E</th>
          <th class="text-end">Profit</th>
          <th class="text-end">ROI</th>
          <th class="text-end" title="${RANK_TIP}">Rank</th>
          <th class="cell-clear" aria-hidden="true"></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  </div>`;
}
