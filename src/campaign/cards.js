// The card view: one card per Movie, for screens too narrow to read a table on.
//
// The arithmetic behind the visuals lives in `table-rows.js` (`cardRows`,
// `compareCards`, `roiMeter`, `weekAxisIndexes`, `weekDeltas`). What is here is
// the markup those numbers go into and the pointer gestures on top of it.

import {
  colorClass,
  escapeHtml,
  fmt,
  formatShortDate,
  ratingColorClass,
} from './format.js';
import { pickOrSeasonIcon, userBadge } from './icons.js';
import {
  cardRows,
  collectWeekKeys,
  compareCards,
  roiMeter,
  weekAxisIndexes,
  weekDeltas,
} from './table-rows.js';

const UNHELD_COLOR = '#6c757d';

const PLOT_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>';

const LETTERBOXD_ICON = '<img class="rating-icon" src="https://www.google.com/s2/favicons?domain=letterboxd.com&sz=32" alt="Letterboxd" width="14" height="14">';

// ── The weekly sparkline ──────────────────────────────────────────────────

const SPARK_WIDTH = 140;
const SPARK_HEIGHT = 30;
const MIN_BAR_HEIGHT = 1.5; // a week that took nothing still leaves a mark

// Bars for gross by week, oldest to newest, with the latest one at full
// opacity. Below them an axis labelling a few of the weeks by number.
//
// The caption reports the *current* week specifically rather than the last bar,
// which are different things for most Movies: a Movie that finished its run
// months ago still has bars, but nothing this week.
function weeklyModule(weeks, color, thisWeek) {
  if (!weeks || weeks.length < 1) return '';

  const values = weeks.map((week) => week.gross || 0);
  const max = Math.max(...values);
  const thisWeekText = thisWeek !== null && thisWeek !== undefined ? fmt(thisWeek) : null;

  // One week is not a shape, and a run of empty weeks has nothing to draw. In
  // that case the caption stands alone, and only when there is a figure to put
  // in it.
  if (values.length < 2 || max <= 0) {
    if (thisWeekText === null) return '';
    return '<div class="spark-caption spark-caption-solo">'
      + '<span class="spark-cap-val"><span class="spark-cap-wk">Gross this week</span>'
      + `${thisWeekText}</span></div>`;
  }

  const gap = values.length > 24 ? 1 : 2;
  const barWidth = (SPARK_WIDTH - gap * (values.length - 1)) / values.length;

  const bars = values.map((value, index) => {
    const height = Math.max(MIN_BAR_HEIGHT, (value / max) * SPARK_HEIGHT);
    const x = index * (barWidth + gap);
    const isLatest = index === values.length - 1;
    return `<rect x="${x.toFixed(1)}" y="${(SPARK_HEIGHT - height).toFixed(1)}"`
      + ` width="${barWidth.toFixed(1)}" height="${height.toFixed(1)}"`
      + ` rx="0.6" fill="${color}" opacity="${isLatest ? 1 : 0.5}"/>`;
  }).join('');

  const svg = `<svg class="spark" viewBox="0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}"`
    + ` preserveAspectRatio="none" aria-hidden="true">${bars}</svg>`;

  const captionValue = thisWeekText !== null
    ? `<span class="spark-cap-val"><span class="spark-cap-wk">This week</span>${thisWeekText}</span>`
    : '';
  const caption = '<div class="spark-caption"><span class="spark-cap-label">Weekly gross</span>'
    + `${captionValue}</div>`;

  const axis = weekAxisIndexes(values.length).map((index) => {
    const centre = ((index * (barWidth + gap) + barWidth / 2) / SPARK_WIDTH) * 100;
    return `<span style="left:${centre.toFixed(1)}%">W${weeks[index].num}</span>`;
  }).join('');

  return `${caption}${svg}<div class="spark-weeks">${axis}</div>`;
}

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

// Week by week, newest first, each against the week before it. Read the other
// way round the deltas would compare a week to its successor, which is not a
// change anybody experienced.
function weekTable(weeks) {
  if (!weeks.length) return '<div class="extra-empty">No weekly data yet</div>';

  const body = weekDeltas(weeks).map((week) => {
    const delta = week.deltaPct === null
      ? '<td class="wk-delta text-neu">—</td>'
      : `<td class="wk-delta ${colorClass(week.deltaPct)}">`
        + `${week.deltaPct > 0 ? '+' : ''}${week.deltaPct}%</td>`;
    return `<tr><td>#${week.num}</td><td>${fmt(week.gross)}</td>${delta}</tr>`;
  }).reverse().join('');

  return '<table class="week-table">'
    + '<thead><tr><th>Week</th><th>Gross</th><th>Δ%</th></tr></thead>'
    + `<tbody>${body}</tbody>`
    + '</table>';
}

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
    + '<button class="movie-card-plot-btn" type="button"'
    + ` aria-label="Plot on chart" title="Plot on chart">${PLOT_ICON}</button>`
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
    + '</div>'
    + '</div>';
}

// ── Gestures ──────────────────────────────────────────────────────────────

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE = 10; // px of slop still counted as a tap rather than a drag

export function buildCards(board, colorMap, selection, visibleIds, sortField, sortDir) {
  const container = document.getElementById('movie-cards');
  if (!container) return null;

  let field = sortField || 'default';
  let direction = sortDir || 'asc';

  const weekKeys = collectWeekKeys(board.rows || []);
  const allRows = cardRows(board);

  let visible = visibleIds || null;

  function rowsToShow() {
    if (!visible) return allRows.slice();
    const wanted = new Set(visible);
    return allRows.filter((row) => wanted.has(row.imdbId));
  }

  let rows = rowsToShow();

  function render() {
    rows.sort(compareCards(field, direction, weekKeys));
    container.innerHTML = rows.length
      ? rows.map((row) => cardMarkup(row, colorMap, selection.has(row.imdbId))).join('')
      : '<div class="cards-empty text-muted">No movies match the current filters.</div>';
  }

  render();

  // #movie-cards outlives any one render, so every listener is scoped to an
  // AbortController. Without it, re-entering the card view stacks a second set
  // and each tap fires once per stale set.
  const controller = new AbortController();
  const { signal } = controller;

  let press = null;

  function cancelTimer() {
    if (press && press.timer) {
      clearTimeout(press.timer);
      press.timer = null;
    }
  }

  function abortPress() {
    cancelTimer();
    press = null;
  }

  // Expanding is handled on pointerup rather than click: a few pixels of
  // movement between down and up suppresses the synthesised click, which would
  // otherwise swallow the tap entirely. A stationary press held past
  // LONG_PRESS_MS plots the Movie instead.
  container.addEventListener('pointerdown', (event) => {
    if (!event.isPrimary || event.target.closest('.movie-card-plot-btn')) {
      press = null;
      return;
    }
    const card = event.target.closest('.movie-card');
    if (!card) {
      press = null;
      return;
    }

    press = {
      card,
      id: card.dataset.imdbId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      longFired: false,
      timer: null,
    };
    press.timer = setTimeout(() => {
      if (!press) return;
      press.longFired = true;
      press.timer = null;
      selection.toggle(press.id);
    }, LONG_PRESS_MS);
  }, { signal });

  container.addEventListener('pointermove', (event) => {
    if (!press || press.moved) return;
    if (Math.abs(event.clientX - press.x) > MOVE_TOLERANCE
      || Math.abs(event.clientY - press.y) > MOVE_TOLERANCE) {
      press.moved = true; // a scroll or a drag, not a tap
      cancelTimer();
    }
  }, { signal });

  container.addEventListener('pointerup', (event) => {
    if (!press) return;
    cancelTimer();
    const { longFired, moved, card } = press;
    press = null;
    if (longFired || moved) return;
    if (event.target.closest('.movie-card') !== card) return;
    card.querySelector('.movie-card-extra')?.classList.toggle('d-none');
  }, { signal });

  container.addEventListener('pointercancel', abortPress, { signal });
  container.addEventListener('pointerleave', abortPress, { signal });

  // The plot button is a real button, so its click fires reliably.
  container.addEventListener('click', (event) => {
    if (!event.target.closest('.movie-card-plot-btn')) return;
    const card = event.target.closest('.movie-card');
    if (card) selection.toggle(card.dataset.imdbId);
  }, { signal });

  // On a desktop, a right-click plots too. It is the same gesture as a
  // long-press for a reader with a mouse.
  container.addEventListener('contextmenu', (event) => {
    const card = event.target.closest('.movie-card');
    if (!card) return;
    event.preventDefault();
    selection.toggle(card.dataset.imdbId);
  }, { signal });

  return {
    rerender: render,

    setSort(nextField, nextDir) {
      field = nextField || 'default';
      direction = nextDir || 'asc';
      render();
    },

    setVisibleIds(ids) {
      visible = ids || null;
      rows = rowsToShow();
      render();
    },

    // Selection is repainted rather than re-rendered: a card the reader has
    // expanded should stay expanded when another one is plotted.
    syncSelection() {
      const selected = new Set(selection.toArray());
      for (const card of container.querySelectorAll('.movie-card')) {
        card.classList.toggle('is-selected', selected.has(card.dataset.imdbId));
      }
    },

    destroy() {
      controller.abort();
      container.innerHTML = '';
    },
  };
}
