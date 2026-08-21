// The six-tab info card beside the scorecard strip. The queries behind each tab
// live in `highlights.js`; this module is the markup, the tab state and the
// height sync.

import { fmt, fmtPct, colorClass, escapeHtml, formatShortDate } from '../shared/format.js';

import { pickOrSeasonIcon, userBadge } from './icons.js';

const TAB_COOKIE = 'info_active_tab';

function readTabCookie() {
  const match = document.cookie.match(/(?:^|;)\s*info_active_tab=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function writeTabCookie(id) {
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `${TAB_COOKIE}=${encodeURIComponent(id)}`
    + `; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

function movieCell(row, colorMap) {
  return userBadge(row.userId, row.username, colorMap)
    + pickOrSeasonIcon(row.pickType, row.season)
    + escapeHtml(row.title);
}

function pctCell(value) {
  if (value === null || value === undefined) return '<span class="text-neu">—</span>';
  return `<span class="${colorClass(value)}">${fmtPct(value)}</span>`;
}

function tableWrap(inner) {
  return `<div class="info-card-table-wrap">${inner}</div>`;
}

function table(head, body) {
  return `<table class="scorecard-movie-table"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

function upcomingPane(rows, colorMap) {
  const head = '<tr><th>Movie</th><th>Date</th></tr>';
  const body = rows.map((row) => '<tr>'
    + `<td>${movieCell(row, colorMap)}</td>`
    + `<td>${formatShortDate(row.releaseDate)}</td>`
    + '</tr>').join('');
  return tableWrap(table(head, body));
}

function profitPane(rows, colorMap) {
  const head = '<tr><th>Movie</th><th class="text-end">Profit</th><th class="text-end">ROI</th></tr>';
  const body = rows.map((row) => '<tr>'
    + `<td>${movieCell(row, colorMap)}</td>`
    + `<td class="text-end ${colorClass(row.profitTd)}">${fmt(row.profitTd)}</td>`
    + `<td class="text-end text-neu">${row.roi !== null ? fmtPct(row.roi) : '—'}</td>`
    + '</tr>').join('');
  return tableWrap(table(head, body));
}

function dailyPane(rows, colorMap) {
  const head = '<tr>'
    + '<th>Movie</th>'
    + '<th class="text-end" title="Daily gross">'
    + '<span class="d-none d-sm-inline">Daily Gross</span>'
    + '<span class="d-inline d-sm-none">DG</span>'
    + '</th>'
    + '<th class="text-end info-pct-col" title="Change vs yesterday’s daily gross">%YD</th>'
    + '<th class="text-end info-pct-col" title="Change vs same weekday last week">%LW</th>'
    + '</tr>';
  const body = rows.map((row) => '<tr>'
    + `<td>${movieCell(row.movie, colorMap)}</td>`
    + `<td class="text-end">${fmt(row.gross)}</td>`
    + `<td class="text-end">${pctCell(row.pctYd)}</td>`
    + `<td class="text-end">${pctCell(row.pctLw)}</td>`
    + '</tr>').join('');
  return tableWrap(table(head, body));
}

function weeklyPane(rows, colorMap) {
  const head = '<tr>'
    + '<th>Movie</th>'
    + '<th class="text-end">Gross</th>'
    + '<th class="text-end info-pct-col" title="Change vs last week to the same weekday">%LW</th>'
    + '</tr>';
  const body = rows.map((row) => '<tr>'
    + `<td>${movieCell(row.movie, colorMap)}</td>`
    + `<td class="text-end">${fmt(row.gross)}</td>`
    + `<td class="text-end">${pctCell(row.pctLw)}</td>`
    + '</tr>').join('');
  return tableWrap(table(head, body));
}

function streamingSection(title, rows, colorMap) {
  if (!rows.length) return '';
  const head = '<tr>'
    + '<th>Movie</th>'
    + '<th>Digital</th>'
    + '<th class="text-end" title="Days from theatrical release to digital release.">Window</th>'
    + '</tr>';
  const body = rows.map((row) => '<tr>'
    + `<td>${movieCell(row, colorMap)}</td>`
    + `<td>${formatShortDate(row.releasedDigital)}</td>`
    + `<td class="text-end">${formatWindow(row.digitalWindowDays)}</td>`
    + '</tr>').join('');
  return `<div class="info-section-header">${title}</div>${table(head, body)}`;
}

function formatWindow(days) {
  if (days === null || days === undefined) return '—';
  return `${days >= 0 ? '+' : ''}${days}d`;
}

function streamingPane(streaming, colorMap) {
  return tableWrap(
    streamingSection('Upcoming Digital Releases', streaming.upcomingDigital, colorMap)
    + streamingSection('Available Now', streaming.availableNow, colorMap),
  );
}

// The strip is the taller of the two on a wide screen, and the info card has to
// match it rather than the other way round. `align-items: stretch` will not do
// it: it would let this card's content grow the row, which stops the strip ever
// shrinking. Setting an explicit height gives the flex chain inside a definite
// size to work against.
function syncHeightTo(element, strip) {
  function sync() {
    if (window.innerWidth < 936 || !strip) {
      element.style.height = '';
      return;
    }
    element.style.height = `${strip.offsetHeight}px`;
  }

  if (typeof ResizeObserver !== 'undefined' && strip) {
    new ResizeObserver(sync).observe(strip);
  }
  sync();
  window.addEventListener('resize', sync);
}

export function buildInfoCards(highlights, colorMap) {
  const element = document.getElementById('info-cards');
  if (!element) return;

  const tabs = [
    {
      id: 'upcoming',
      label: 'Upcoming',
      row: 1,
      empty: highlights.upcoming.length === 0,
      pane: () => upcomingPane(highlights.upcoming, colorMap),
    },
    {
      id: 'profitable',
      label: 'Most Profitable',
      row: 1,
      empty: highlights.profitable.length === 0,
      pane: () => profitPane(highlights.profitable, colorMap),
    },
    {
      id: 'worst',
      label: 'Least Profitable',
      row: 1,
      empty: highlights.worst.length === 0,
      pane: () => profitPane(highlights.worst, colorMap),
    },
    {
      id: 'streaming',
      label: 'Streaming',
      row: 2,
      empty: highlights.streaming.all.length === 0,
      pane: () => streamingPane(highlights.streaming, colorMap),
    },
    {
      id: 'daily',
      label: highlights.daily.label,
      row: 2,
      empty: highlights.daily.rows.length === 0,
      pane: () => dailyPane(highlights.daily.rows, colorMap),
    },
    {
      id: 'weekly',
      label: highlights.weekly.label,
      row: 2,
      empty: highlights.weekly.rows.length === 0,
      pane: () => weeklyPane(highlights.weekly.rows, colorMap),
    },
  ];

  const activeTab = readTabCookie() || 'upcoming';

  const button = (tab) => `<button class="info-tab-btn${tab.id === activeTab ? ' active' : ''}"`
    + ` data-tab="${tab.id}">${tab.label}</button>`;

  const row1 = tabs.filter((tab) => tab.row === 1).map(button).join('');
  const row2 = tabs.filter((tab) => tab.row === 2).map(button).join('');

  const panes = tabs.map((tab) => `<div class="info-tab-pane${tab.id === activeTab ? ' active' : ''}"`
    + ` data-tab="${tab.id}">`
    + (tab.empty ? '<p class="info-tab-empty">No data available</p>' : tab.pane())
    + '</div>').join('');

  element.innerHTML = '<div class="info-tab-card">'
    + `<div class="info-tab-nav">${row1}</div>`
    + `<div class="info-tab-nav info-tab-nav-secondary">${row2}</div>`
    + `<div class="info-tab-body">${panes}</div>`
    + '</div>';

  syncHeightTo(element, document.getElementById('weekend-strip'));

  element.addEventListener('click', (event) => {
    const button = event.target.closest('.info-tab-btn');
    if (!button) return;
    const id = button.dataset.tab;
    for (const other of element.querySelectorAll('.info-tab-btn')) {
      other.classList.toggle('active', other.dataset.tab === id);
    }
    for (const pane of element.querySelectorAll('.info-tab-pane')) {
      pane.classList.toggle('active', pane.dataset.tab === id);
    }
    writeTabCookie(id);
  });
}
