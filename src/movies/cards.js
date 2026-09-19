// The Movies lookup card: what one Movie looks like on this page's card view.
//
// The grid, the sparkline, the week table, the link through to the Movie and
// every pointer gesture are the shared card view's (`shared/cards.js`). What is
// here is the markup this page puts in a card and nothing else. It is the one
// piece the Campaign's card is copied rather than shared, and that is by
// design: the shared builder owns the gestures and the modules, each page owns
// its card's face (#162).
//
// It is the Campaign's card with the League taken out. No holder badge, no
// owner colour edge, and no Profit, Breakeven, ROI meter or profit rank: the
// headline is what the Movie took, because that is the only figure this page
// has (#62).

import {
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
import { pickOrSeasonIcon } from '../shared/icons.js';

import { cardCompare } from './rows.js';

const LETTERBOXD_ICON = '<img class="rating-icon" src="https://www.google.com/s2/favicons?domain=letterboxd.com&sz=32" alt="Letterboxd" width="14" height="14">';

// The sparkline takes the colour off the card rather than a figure, because
// there is no holder here to colour it by. `.movies-card .spark` sets it, in
// each theme.
const SPARK_COLOR = 'currentColor';

// A Movie from a slice written before the identity fields has no title (#60).
// Its imdb id is the only name it has, which is what the table shows too.
function titleText(row) {
  return row.title
    ? `<span class="movie-title-text">${escapeHtml(row.title)}</span>`
    : `<span class="movie-title-text text-neu">${escapeHtml(row.imdbId)}</span>`;
}

// Release date, budget and how long it has been out. The ≈ marks a budget
// upstream estimated rather than reported, the same mark the table's column
// carries, and the year is spelled out because this page spans every published
// year rather than one.
function metaLine(row) {
  const parts = [];

  parts.push(row.releaseDate
    ? `Opened ${formatShortDate(row.releaseDate)} ${row.releaseDate.slice(0, 4)}`
    : 'Release TBA');

  if (row.budget !== null && row.budget !== undefined) {
    parts.push(row.estimatedBudget
      ? `Budget <span class="budget-estimated">≈${fmt(row.budget)}</span>`
      : `Budget ${fmt(row.budget)}`);
  }

  if (row.daysRunning !== null && row.daysRunning !== undefined) {
    parts.push(`Day ${row.daysRunning}`);
  }

  return parts.join('  ·  ');
}

function cardMarkup(row, isSelected) {
  // Gross to date, neutral: it is the only headline figure this page has, and
  // there is nothing for it to be good or bad against. A Movie that is not out
  // yet has taken nothing rather than zero, so it reads as a dash.
  const hasGross = row.grossTd !== null && row.grossTd !== undefined;
  const gross = hasGross ? fmt(row.grossTd) : '—';

  const letterboxd = row.rating_letterboxd;
  const ratingChip = letterboxd === null || letterboxd === undefined ? ''
    : `<span class="rating-chip ${ratingColorClass(letterboxd)}">`
      + `${LETTERBOXD_ICON}${(letterboxd / 20).toFixed(1)}</span>`;

  const spark = weeklyModule(row.weeks, SPARK_COLOR, row.thisWeek);

  return `<div class="movie-card movies-card${isSelected ? ' is-selected' : ''}"`
    + ` data-imdb-id="${escapeHtml(row.imdbId)}">`
    + '<div class="movie-card-header">'
    + '<div class="movie-card-title">'
    + pickOrSeasonIcon(null, row.season)
    + titleText(row)
    + '</div>'
    + plotButton()
    + '</div>'
    + `<div class="movie-card-meta">${metaLine(row)}</div>`
    + '<div class="movie-card-hero">'
    + `<span class="hero-profit ${hasGross ? '' : 'text-neu'}">${gross}</span>`
    + '<span class="hero-unit">gross</span>'
    + ratingChip
    + '</div>'
    + (spark ? `<div class="movie-card-spark">${spark}</div>` : '')
    + '<div class="movie-card-extra d-none">'
    + weekTable(row.weeks || [])
    + movieLink(row)
    + '</div>'
    + '</div>';
}

// `rows` is every Movie the page holds; `visibleIds` is what the filters have
// left, which is how the shared builder narrows without losing the rest.
export function buildMovieCards(rows, { selection, visibleIds, sortField, sortDir }) {
  return buildSharedCards({
    rows,
    compare: cardCompare,
    cardMarkup,
    selection,
    visibleIds,
    sortField,
    sortDir,
  });
}
