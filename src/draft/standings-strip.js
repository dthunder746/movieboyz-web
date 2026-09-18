// The what-if Standings strip: one row per roster member, above the board on
// every Season tab (#88).
//
// It sits above the Season leaderboard because it answers the bigger question
// of the two. The leaderboard says who won a Season's draft; this says what the
// year would look like, which is what a reader moving Picks around is actually
// asking.
//
// Everything decided is next door in `standings.js`. What is here is markup.

import { colorClass, escapeHtml, fmt } from '../shared/format.js';

// `fmt` signs only negatives, so a gain has to have its plus put on here, the
// way `fmtPct` already does it for percentages. Zero is a measurement that came
// out level and reads as one.
function fmtDelta(value) {
  if (value === 0) return fmt(0);
  return (value > 0 ? '+' : '') + fmt(value);
}

// An empty cell, not a zero and not `fmt`'s em dash. With what-if off nothing
// has been measured, and a zero would claim a measurement was taken and came
// out level.
const EMPTY_CELL = '';

function rankChangeHtml(rankChange) {
  if (rankChange === null || rankChange === 0) return EMPTY_CELL;

  const up = rankChange > 0;
  const places = Math.abs(rankChange);
  const label = `${up ? 'Up' : 'Down'} ${places} place${places === 1 ? '' : 's'}`;

  // Coloured with the site's own money classes rather than a colour of its
  // own, so the arrows follow the light and dark tokens everything else does.
  return `<span class="draft-standings-move ${up ? 'text-pos' : 'text-neg'}" aria-label="${label}" title="${label}">`
    + `<span aria-hidden="true">${up ? '▲' : '▼'}</span>`
    + `<span class="draft-standings-move-places" aria-hidden="true">${places}</span>`
    + '</span>';
}

export function buildStandingsStrip(rows, colorMap, mountEl, { enabled } = {}) {
  if (!mountEl) return;

  if (!rows.length) {
    mountEl.innerHTML = '';
    return;
  }

  const body = rows.map((row) => {
    const color = colorMap[row.userId] || '#ccc';

    // The delta and the rank change are what-if's own columns: off, they are
    // blank rather than zeroed.
    const deltaHtml = enabled && row.delta !== null
      ? `<span class="${colorClass(row.delta)}">${fmtDelta(row.delta)}</span>`
      : EMPTY_CELL;
    const moveHtml = enabled ? rankChangeHtml(row.rankChange) : EMPTY_CELL;

    return `<div class="draft-standings-row" data-user="${escapeHtml(row.userId)}">`
      + `<span class="draft-standings-move-cell">${moveHtml}</span>`
      + '<span class="draft-standings-name">'
      + `<span class="owner-dot" style="background:${color}"></span>`
      + escapeHtml(row.username ?? row.userId)
      + '</span>'
      + `<span class="draft-standings-total ${colorClass(row.total)}">${fmt(row.total)}</span>`
      + `<span class="draft-standings-delta">${deltaHtml}</span>`
      + '</div>';
  }).join('');

  // The heading says whose figures these are, because with what-if off they are
  // the real Standings and with it on they are not.
  mountEl.innerHTML = '<div class="draft-standings-strip">'
    + `<div class="draft-standings-head">${enabled ? 'Standings under your swaps' : 'Standings'}</div>`
    + `<div class="draft-standings-rows">${body}</div>`
    + '</div>';
}
