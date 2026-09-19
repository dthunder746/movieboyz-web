// The filter panel sections that are not about one page's subject: the title
// search, the release date range and the Released segment.
//
// These began as closures inside `campaign/toolbar.js`. The Movies lookup asks
// the same three questions in the same words, so they are lifted here rather
// than written twice (#161). What stayed behind on each page is what only that
// page filters by: Owner and Pick type on a Campaign, release year and Season
// on the lookup.
//
// Markup only, plus the bind and sync helpers that go with each section. No
// filter state lives here: a bind helper pushes into the page's own filter
// state and a sync helper reads a snapshot back out of it.

import { escapeHtml } from './format.js';

export const RELEASED_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'released', label: 'Released only' },
  { key: 'upcoming', label: 'Upcoming only' },
];

// `data-released-status` as the dataset reads it. One conversion, so a section
// and the handler that answers it name the same attribute string.
function datasetKey(attribute) {
  return attribute.replace(/-([a-z])/g, (whole, letter) => letter.toUpperCase());
}

// ── Sections ──────────────────────────────────────────────────────────────

export function searchSection(snapshot) {
  return '<div class="filter-row">'
    + '<span class="filter-label">Search</span>'
    + '<input type="text" id="filter-search" class="form-control form-control-sm"'
    + ` style="max-width:280px" placeholder="Title contains…" value="${escapeHtml(snapshot.search)}">`
    + '</div>';
}

export function dateSection(snapshot) {
  return '<div class="filter-row">'
    + '<span class="filter-label">Release date</span>'
    + '<input type="date" id="filter-date-from" class="form-control form-control-sm"'
    + ` style="width:auto" value="${snapshot.releaseFrom || ''}">`
    + '<span class="text-muted" style="font-size:0.78rem">to</span>'
    + '<input type="date" id="filter-date-to" class="form-control form-control-sm"'
    + ` style="width:auto" value="${snapshot.releaseTo || ''}">`
    + '</div>';
}

export function segmentedSection(label, options, attribute, current) {
  const buttons = options.map((option) => `<button class="filter-segmented-btn`
    + `${current === option.key ? ' on' : ''}" data-${attribute}="${option.key}"`
    + ` type="button">${option.label}</button>`).join('');

  return `<div class="filter-row"><span class="filter-label">${label}</span>`
    + `<div class="filter-segmented">${buttons}</div></div>`;
}

export function releasedSection(snapshot) {
  return segmentedSection('Released', RELEASED_OPTIONS, 'released-status', snapshot.released);
}

// ── Binding ───────────────────────────────────────────────────────────────

// Typing debounced: without it every keystroke re-filters the table, and on the
// Campaign's detailed view that is a full redraw per character.
export function bindSearch(panel, filters, debounceMs) {
  let debounce = null;
  panel.addEventListener('input', (event) => {
    if (event.target.id !== 'filter-search') return;
    const { value } = event.target;
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => filters.setSearch(value), debounceMs);
  });
}

// Both bounds go in together, because either one alone is a range with an open
// end rather than a half-written filter.
export function bindDateRange(panel, filters) {
  panel.addEventListener('change', (event) => {
    if (event.target.id !== 'filter-date-from' && event.target.id !== 'filter-date-to') return;
    const from = panel.querySelector('#filter-date-from');
    const to = panel.querySelector('#filter-date-to');
    filters.setReleaseRange(from ? from.value : '', to ? to.value : '');
  });
}

export function bindReleasedStatus(panel, filters) {
  panel.addEventListener('click', (event) => {
    const button = event.target.closest('[data-released-status]');
    if (button) filters.setReleasedStatus(button.dataset.releasedStatus);
  });
}

// ── Syncing ───────────────────────────────────────────────────────────────
//
// An open panel is repainted in place rather than rebuilt, so an input the
// reader is mid-way through typing in keeps its focus and its caret.

export function syncSearch(panel, snapshot) {
  const search = panel.querySelector('#filter-search');
  if (search && document.activeElement !== search) search.value = snapshot.search;
}

export function syncDateRange(panel, snapshot) {
  const from = panel.querySelector('#filter-date-from');
  const to = panel.querySelector('#filter-date-to');
  if (from && document.activeElement !== from) from.value = snapshot.releaseFrom || '';
  if (to && document.activeElement !== to) to.value = snapshot.releaseTo || '';
}

export function syncSegmented(panel, attribute, current) {
  const key = datasetKey(attribute);
  for (const button of panel.querySelectorAll(`[data-${attribute}]`)) {
    button.classList.toggle('on', current === button.dataset[key]);
  }
}
