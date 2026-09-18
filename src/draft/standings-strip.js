// The what-if Standings strip: one row per roster member, above the board on
// every Season tab (#88).
//
// It sits above the Season leaderboard because it answers the bigger question
// of the two. The leaderboard says who won a Season's draft; this says what the
// year would look like, which is what a reader moving Picks around is actually
// asking. It is drawn only while what-if mode is on, collapsing in and out with
// the mode banner above it.
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

// An empty cell, not a zero and not `fmt`'s em dash. The strip is collapsed
// while the mode is off, so nobody reads these; they stay blank rather than
// zeroed because a zero would claim a measurement was taken and came out level,
// and this module should say what it means whatever is on screen.
const EMPTY_CELL = '';

// The move, in brackets beside the place. Nothing at all when a User has not
// moved, so a still table reads as a still one.
function movementHtml(rankChange) {
  if (rankChange === null || rankChange === 0) return '';

  const up = rankChange > 0;
  const places = Math.abs(rankChange);
  const label = `${up ? 'Up' : 'Down'} ${places} place${places === 1 ? '' : 's'}`;

  // Coloured with the site's own money classes rather than colours of its own,
  // so the arrows follow the light and dark tokens everything else does. The
  // place beside it stays muted: it is a position, not a gain.
  return ` <span class="draft-standings-move ${up ? 'text-pos' : 'text-neg'}" aria-label="${label}" title="${label}">`
    + `(<span aria-hidden="true">${up ? '▲' : '▼'}</span>${places})`
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

    // The delta and the movement are what-if's own columns: off, they are blank
    // rather than zeroed.
    const deltaHtml = enabled && row.delta !== null
      ? `<span class="${colorClass(row.delta)}">${fmtDelta(row.delta)}</span>`
      : EMPTY_CELL;
    const orderHtml = `<span class="text-neu">${row.rank}</span>`
      + (enabled ? movementHtml(row.rankChange) : EMPTY_CELL);

    return `<div class="draft-standings-row" data-user="${escapeHtml(row.userId)}">`
      + `<span class="draft-standings-order">${orderHtml}</span>`
      + '<span class="draft-standings-name">'
      + `<span class="owner-dot" style="background:${color}"></span>`
      + escapeHtml(row.username ?? row.userId)
      + '</span>'
      + `<span class="draft-standings-total ${colorClass(row.total)}">${fmt(row.total)}</span>`
      + `<span class="draft-standings-delta">${deltaHtml}</span>`
      + '</div>';
  }).join('');

  // The heading does not change with the mode. These are the overall Standings
  // either way, and saying so differently when the mode is on would suggest the
  // figures are computed differently, which they are not.
  mountEl.innerHTML = '<div class="draft-standings-strip">'
    + '<div class="draft-standings-head">Overall standings</div>'
    + '<div class="draft-standings-rows">'
    + '<div class="draft-standings-row draft-standings-colhead">'
    + '<span class="draft-standings-order">#</span>'
    + '<span class="draft-standings-name">Name</span>'
    + '<span class="draft-standings-total">Total</span>'
    + '<span class="draft-standings-delta">Change</span>'
    + '</div>'
    + body
    + '</div>'
    + '</div>';
}
