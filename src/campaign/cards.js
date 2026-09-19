// The League's card: what one Movie looks like on the Campaign's card view.
//
// The grid itself, the sparkline, the week table, the link through to the Movie
// and every pointer gesture are the shared card view's (`shared/cards.js`).
// What is here is the markup a League puts in a card, ROI meter and all, and
// the rows it is drawn from.
//
// The arithmetic behind the visuals lives in `table-rows.js` (`cardRows`,
// `compareCards`, `roiMeter`).

import {
  colorClass,
  escapeHtml,
  fmt,
  formatShortDate,
  ratingColorClass,
} from '../shared/format.js';
import {
  buildCards as buildSharedCards,
  movieLink,
  plotButton,
  weekTable,
  weeklyModule,
} from '../shared/cards.js';

import { pickOrSeasonIcon, userBadge } from '../shared/icons.js';
import {
  cardRows,
  collectWeekKeys,
  compareCards,
  roiMeter,
} from './table-rows.js';

const UNHELD_COLOR = '#6c757d';

const LETTERBOXD_ICON = '<img class="rating-icon" src="https://www.google.com/s2/favicons?domain=letterboxd.com&sz=32" alt="Letterboxd" width="14" height="14">';

// ── The ROI meter ─────────────────────────────────────────────────────────

// The geometry comes from `roiMeter`; this is only where it goes. The tick is
// break-even and the cap is the +100% mark, both fixed in the CSS, so the only
// thing driven from here is how far each fill reaches.
function roiMeterMarkup(roi) {
  const meter = roiMeter(roi);
  if (!meter) return '';

  const breakout = meter.breakoutPct !== null
    ? `<span class="roi-over" style="width:${meter.breakoutPct.toFixed(1)}%"></span>`
    : '';

  return '<div class="roi-meter">'
    + '<div class="roi-bar">'
    + `<span class="roi-bar-fill ${meter.positive ? 'pos' : 'neg'}"`
    + ` style="width:${meter.fillPct.toFixed(1)}%"></span>`
    + '</div>'
    + '<span class="roi-tick"></span>'
    + '<span class="roi-cap"></span>'
    + breakout
    + '<div class="roi-scale">'
    + '<span class="s-min">-100%</span>'
    + '<span class="s-be">break-even</span>'
    + '<span class="s-max">+100%</span>'
    + '</div>'
    + '</div>';
}

// ── The card ──────────────────────────────────────────────────────────────

function cardMarkup(row, colorMap, isSelected) {
  const unheld = row.userId === null || row.userId === undefined;
  const color = unheld ? UNHELD_COLOR : (colorMap[row.userId] || '#888');
  const holder = unheld ? 'Unowned' : row.username;

  const profit = row.profitTd === null ? '—' : fmt(row.profitTd);
  const profitClass = row.profitTd === null ? 'text-neu' : colorClass(row.profitTd);

  const roiChip = row.roi === null ? ''
    : `<span class="roi-chip ${colorClass(row.roi)}">`
      + `${row.roi > 0 ? '+' : ''}${Math.round(row.roi)}%</span>`;

  const ratingChip = row.ratingLetterboxd === null ? ''
    : `<span class="rating-chip ${ratingColorClass(row.ratingLetterboxd)}">`
      + `${LETTERBOXD_ICON}${(row.ratingLetterboxd / 20).toFixed(1)}</span>`;

  const breakevenMeta = row.breakeven ? `  ·  B/E ${fmt(row.breakeven)}` : '';
  const opened = row.releaseDate === 'TBA' ? 'TBA' : formatShortDate(row.releaseDate);

  // Rank is over the whole Board, so it stays put as the toolbar is worked. A
  // Movie with no published profit has no rank and the line is left out.
  const rankLine = row.rank
    ? `<div class="extra-rank">Profit rank <strong>#${row.rank}</strong> of ${row.rankTotal}</div>`
    : '';

  const spark = weeklyModule(row.weeks, color, row.thisWeek);

  return `<div class="movie-card${isSelected ? ' is-selected' : ''}${unheld ? ' is-unowned' : ''}"`
    + ` data-imdb-id="${escapeHtml(row.imdbId)}" style="--owner:${color}">`
    + '<div class="movie-card-header">'
    + '<div class="movie-card-title">'
    + pickOrSeasonIcon(row.pickType, row.season)
    + `<span class="movie-title-text">${escapeHtml(row.title)}</span>`
    + '</div>'
    + userBadge(row.userId, row.username, colorMap)
    + plotButton()
    + '</div>'
    + `<div class="movie-card-meta">${escapeHtml(holder)}  ·  Opened ${opened}${breakevenMeta}</div>`
    + '<div class="movie-card-hero">'
    + `<span class="hero-profit ${profitClass}">${profit}</span>`
    + roiChip
    + ratingChip
    + '</div>'
    + roiMeterMarkup(row.roi)
    + (spark ? `<div class="movie-card-spark">${spark}</div>` : '')
    + '<div class="movie-card-extra d-none">'
    + rankLine
    + weekTable(row.weeks)
    + movieLink(row)
    + '</div>'
    + '</div>';
}

export function buildCards(board, colorMap, selection, visibleIds, sortField, sortDir) {
  const weekKeys = collectWeekKeys(board.rows || []);

  return buildSharedCards({
    rows: cardRows(board),
    compare: (field, direction) => compareCards(field, direction, weekKeys),
    cardMarkup: (row, isSelected) => cardMarkup(row, colorMap, isSelected),
    selection,
    visibleIds,
    sortField,
    sortDir,
  });
}
