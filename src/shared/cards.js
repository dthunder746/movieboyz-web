// The card view: one card per Movie, for screens too narrow to read a table on.
//
// What is here is the parts of a card that are the same whoever is looking at
// it (the weekly sparkline, the week-by-week table, the way through to the
// Movie's own page) and the pointer gestures over the grid. The markup for one
// card is the page's own and comes in as `cardMarkup` (#160).
//
// ── The row fields this module reads ──────────────────────────────────────
// A page that wants these cards gives each row:
//
//   imdbId    — the Movie's id, and the card's `data-imdb-id`
//   weeks     — oldest first, each `{ num, gross }`: `num` is the ISO week
//               number the axis labels, `gross` what the Movie took that week
//   thisWeek  — what it has taken in the current week, or null
//
// Ticket 41 (#162) makes the Movies page's rows carry the same names.
//
// How much of the list a first draw puts on screen is the builder's too, and
// so is the button that asks for more of it (#163). A Movies page holding
// hundreds of Movies used to build every card up front, which is a long wait
// for a reader who only ever reads the first screenful, so the grid is drawn a
// page at a time. Both pages get it from here rather than each carrying its
// own copy.
//
// ── The card markup contract ──────────────────────────────────────────────
// The gestures below find a card by `.movie-card` and read its
// `data-imdb-id`; a tap toggles `.movie-card-extra`, and the plot button is
// `.movie-card-plot-btn` (render it with `plotButton()`). A `cardMarkup` that
// leaves any of those out loses the gesture that depends on it.

import { colorClass, escapeHtml, fmt } from './format.js';
import { MOVIE_LINK_CLASS, movieUrl } from './location.js';

const PLOT_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>';

// The control that plots a Movie on the chart, for a reader who would rather
// press a button than hold the card down.
export function plotButton() {
  return '<button class="movie-card-plot-btn" type="button"'
    + ` aria-label="Plot on chart" title="Plot on chart">${PLOT_ICON}</button>`;
}

// ── The weekly sparkline ──────────────────────────────────────────────────

const SPARK_WIDTH = 140;
const SPARK_HEIGHT = 30;
const MIN_BAR_HEIGHT = 1.5; // a week that took nothing still leaves a mark

// Which sparkline bars get an axis label. The first and the latest always do,
// with a few evenly spaced between, scaled to the run so a long season does not
// end up with the labels overprinting each other.
export function weekAxisIndexes(n) {
  if (n <= 0) return [];
  let count;
  if (n <= 4) count = n;
  else if (n <= 8) count = 4;
  else if (n <= 12) count = 5;
  else count = 6;

  // Every branch above leaves count no greater than n, so the step between
  // labels is never less than one bar and no two labels can land together.
  const indexes = [];
  for (let j = 0; j < count; j += 1) {
    indexes.push(Math.round((j * (n - 1)) / (count - 1 || 1)));
  }
  return indexes;
}

// Week-on-week change for the card's expanded table. The divisor is the size of
// the previous week rather than its signed value: a revised-down week reads
// negative, and dividing by it would flip the sign and show a recovery as a
// collapse.
export function weekDeltas(weeks) {
  return weeks.map((week, i) => {
    const previous = i > 0 ? weeks[i - 1].gross : null;
    const deltaPct = (previous === null || previous === 0)
      ? null
      : Math.round(((week.gross - previous) / Math.abs(previous)) * 100);
    return { ...week, deltaPct };
  });
}

// Bars for gross by week, oldest to newest, with the latest one at full
// opacity. Below them an axis labelling a few of the weeks by number.
//
// The caption reports the *current* week specifically rather than the last bar,
// which are different things for most Movies: a Movie that finished its run
// months ago still has bars, but nothing this week.
export function weeklyModule(weeks, color, thisWeek) {
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

// ── The expanded area ─────────────────────────────────────────────────────

// Week by week, newest first, each against the week before it. Read the other
// way round the deltas would compare a week to its successor, which is not a
// change anybody experienced.
export function weekTable(weeks) {
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

// The way into the Movie's own page (#63), and it sits in the expanded area
// rather than on the card's title. A card is a gesture surface: a tap expands
// it and a long press plots it, so a link in the title would be followed by the
// tap that was meant to open the card. Cards are the default under 768px, so
// without this the readers most likely to be on a phone would have no way in
// at all.
export function movieLink(row) {
  return `<a class="${MOVIE_LINK_CLASS} movie-card-link" href="${escapeHtml(movieUrl(row.imdbId))}">`
    + 'Open Movie page</a>';
}

// The same way in, worn by the card's own title, for a page that wants the
// name itself to lead somewhere as well as the line in the expanded area.
//
// It is safe to put on the title because it carries `MOVIE_LINK_CLASS`, which
// is the class every gesture below stands off: a pointerdown on it starts no
// press, so the tap navigates instead of expanding the card and a hold plots
// nothing, and a right-click gets the browser's own menu rather than the
// plot. `inner` is the page's own title markup, already escaped.
export function movieTitleLink(imdbId, inner) {
  return `<a class="${MOVIE_LINK_CLASS}" href="${escapeHtml(movieUrl(imdbId))}">${inner}</a>`;
}

// ── Paging ────────────────────────────────────────────────────────────────

// How many cards a page of the grid holds. Twenty-four is a few screenfuls on
// a phone, which is enough that a reader scrolling casually reaches the button
// rather than meeting it straight away.
const DEFAULT_PAGE_SIZE = 24;

const SHOW_MORE_CLASS = 'cards-show-more';

// The label counts what pressing it will actually draw, so the last press says
// how short the last page is rather than promising a full one.
function showMoreLabel(remaining, pageSize) {
  return `Show ${Math.min(pageSize, remaining)} more`;
}

function showMoreHtml(remaining, pageSize) {
  return `<button type="button" class="btn btn-sm btn-outline-secondary ${SHOW_MORE_CLASS}">`
    + `${showMoreLabel(remaining, pageSize)}</button>`;
}

// ── Gestures ──────────────────────────────────────────────────────────────

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE = 10; // px of slop still counted as a tap rather than a drag

// `compare(field, direction)` hands back the comparator for one sort, and
// `cardMarkup(row, isSelected)` the markup for one card. Everything else here
// is the same whichever page is asking.
export function buildCards({
  rows: allRows, compare, cardMarkup, selection, visibleIds, sortField, sortDir,
  pageSize = DEFAULT_PAGE_SIZE,
}) {
  // `movie-cards` is part of the markup contract both pages carry: the grid the
  // cards are drawn into.
  const container = document.getElementById('movie-cards');
  if (!container) return null;

  let field = sortField || 'default';
  let direction = sortDir || 'asc';

  let visible = visibleIds || null;

  function rowsToShow() {
    if (!visible) return allRows.slice();
    const wanted = new Set(visible);
    return allRows.filter((row) => wanted.has(row.imdbId));
  }

  let rows = rowsToShow();

  // How far down the sorted list the grid has been drawn. Every full render
  // starts again from the top, because a new sort or a new set of filters is a
  // different list and the reader is being shown its beginning.
  let drawn = 0;

  function cardsHtml(from, to) {
    return rows.slice(from, to).map((row) => cardMarkup(row, selection.has(row.imdbId))).join('');
  }

  function render() {
    rows.sort(compare(field, direction));
    if (!rows.length) {
      drawn = 0;
      container.innerHTML = '<div class="cards-empty text-muted">No movies match the current filters.</div>';
      return;
    }
    drawn = Math.min(pageSize, rows.length);
    container.innerHTML = cardsHtml(0, drawn)
      + (drawn < rows.length ? showMoreHtml(rows.length - drawn, pageSize) : '');
  }

  // The next page is appended rather than redrawn: a card the reader has
  // already opened stays open, and the page does not jump under them. The
  // button keeps its place at the end by having the new cards put in front of
  // it, and goes away once there is nothing left to ask for.
  function showMore() {
    const button = container.querySelector(`.${SHOW_MORE_CLASS}`);
    if (!button) return;

    const next = Math.min(drawn + pageSize, rows.length);
    button.insertAdjacentHTML('beforebegin', cardsHtml(drawn, next));
    drawn = next;

    if (drawn >= rows.length) button.remove();
    else button.textContent = showMoreLabel(rows.length - drawn, pageSize);
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
    // The plot button and the Movie link are their own controls. Neither one
    // starts a press, so neither expands the card or plots it by being used.
    if (!event.isPrimary
      || event.target.closest('.movie-card-plot-btn')
      || event.target.closest(`.${MOVIE_LINK_CLASS}`)) {
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
    // The show-more button sits in the grid but outside every card, so it is
    // answered here and nowhere near the card gestures.
    if (event.target.closest(`.${SHOW_MORE_CLASS}`)) {
      showMore();
      return;
    }
    if (!event.target.closest('.movie-card-plot-btn')) return;
    const card = event.target.closest('.movie-card');
    if (card) selection.toggle(card.dataset.imdbId);
  }, { signal });

  // On a desktop, a right-click plots too. It is the same gesture as a
  // long-press for a reader with a mouse.
  container.addEventListener('contextmenu', (event) => {
    // A right-click on the link is the reader asking for the browser's own
    // menu, which is where "open in new tab" lives.
    if (event.target.closest(`.${MOVIE_LINK_CLASS}`)) return;
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
