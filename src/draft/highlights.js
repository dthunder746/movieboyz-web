// The strip of tiles over the picks table: the steal, the bust, the best ROI,
// the steadiest Slate and the two ends of the Season.
//
// Ported from the old site's `js/draft/highlights.js`. Everything it decides is
// next door in `season-helpers.js` with a test beside it; this is the markup and
// the gate.

import { escapeHtml, fmt, fmtPct } from '../shared/format.js';

import { everyHolderHasScored, highlightsForDraft, highlightsGatePicks } from './season-helpers.js';

function fmtSigned(value) {
  if (value == null) return '—';
  if (value === 0) return fmt(0);
  return (value > 0 ? '+' : '-') + fmt(Math.abs(value));
}

function userChip(userId, username, colorMap) {
  const color = colorMap[userId] || '#ccc';
  return `<span class="owner-dot" style="background:${color}"></span>${escapeHtml(username ?? userId)}`;
}

function tile(tone, label, valueHtml, subHtml, tagline) {
  return `<div class="draft-hl-tile draft-hl-${tone}">`
    + `<div class="draft-hl-label">${label}</div>`
    + `<div class="draft-hl-value">${valueHtml}</div>`
    + `<div class="draft-hl-sub">${subHtml}</div>`
    + `<div class="draft-hl-tagline">${tagline}</div>`
    + '</div>';
}

export function buildHighlights(view, season, colorMap, mountEl) {
  if (!mountEl) return;

  const gatePicks = highlightsGatePicks(view, season);
  if (!gatePicks.length) {
    mountEl.innerHTML = '';
    return;
  }

  // Until every holder has a Movie that has opened, the tiles would be ranking
  // Slates on how many of their Picks happen to have come out.
  if (!everyHolderHasScored(gatePicks)) {
    mountEl.innerHTML = '<div class="draft-hl-placeholder">Highlights unlock once every owner has at least one released movie.</div>';
    return;
  }

  const highlights = highlightsForDraft(view, season);
  let html = '';

  if (highlights.steal) {
    html += tile('pos', 'Steal of the Draft',
      escapeHtml(highlights.steal.movie),
      `${userChip(highlights.steal.userId, highlights.steal.username, colorMap)} &middot; Pick #${highlights.steal.draftPick} &rarr; Profit rank #${highlights.steal.profitRank}`,
      'Lowest pick with the highest profit');
  }
  if (highlights.bust) {
    html += tile('neg', 'Bust of the Draft',
      escapeHtml(highlights.bust.movie),
      `${userChip(highlights.bust.userId, highlights.bust.username, colorMap)} &middot; Pick #${highlights.bust.draftPick} &rarr; Profit rank #${highlights.bust.profitRank}`,
      'Highest pick with the lowest profit');
  }
  if (highlights.roi) {
    html += tile('pos', 'Highest ROI',
      escapeHtml(highlights.roi.movie),
      `${userChip(highlights.roi.userId, highlights.roi.username, colorMap)} &middot; ${fmtPct(highlights.roi.ratio * 100)}`,
      'Best profit-to-budget multiple');
  }
  if (highlights.mostConsistent) {
    html += tile('pos', 'Mr. Consistent',
      userChip(highlights.mostConsistent.userId, highlights.mostConsistent.username, colorMap),
      `${fmt(highlights.mostConsistent.range)} range across picks`,
      'Smallest gap between best and worst pick');
  }
  if (highlights.biggestWinner) {
    html += tile('pos', 'Biggest Winner',
      escapeHtml(highlights.biggestWinner.movie),
      `${userChip(highlights.biggestWinner.userId, highlights.biggestWinner.username, colorMap)} &middot; ${fmtSigned(highlights.biggestWinner.profit)}`,
      'Highest single-pick profit');
  }
  if (highlights.biggestLoser) {
    html += tile('neg', 'Biggest Loser',
      escapeHtml(highlights.biggestLoser.movie),
      `${userChip(highlights.biggestLoser.userId, highlights.biggestLoser.username, colorMap)} &middot; ${fmtSigned(highlights.biggestLoser.profit)}`,
      'Lowest single-pick profit');
  }

  mountEl.innerHTML = html ? `<div class="draft-hl-strip">${html}</div>` : '';
}
