// The Campaign's filter sections, and the League labels on its chips.
//
// The Filters button, the panel's folding and the chips row itself are the
// shared shell's (`shared/filters-shell.js`); what is here is what a Campaign
// filters by. This module holds no filter state of its own. Every control
// pushes into `filters.js` and every repaint reads back out of it, so the panel
// and the chips cannot disagree with what the table is actually showing.

import {
  bindDateRange,
  bindReleasedStatus,
  bindSearch,
  dateSection,
  releasedSection,
  searchSection,
  segmentedSection,
  syncDateRange,
  syncSearch,
  syncSegmented,
} from '../shared/filter-sections.js';
import { escapeHtml } from '../shared/format.js';
import { createFilterShell } from '../shared/filters-shell.js';

const SEARCH_DEBOUNCE_MS = 150;

const PICK_TYPES = [
  { key: 'hit', label: 'Hit' },
  { key: 'seasonal', label: 'Seasonal' },
  { key: 'bomb', label: 'Bomb' },
];

const PROFITABILITY_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'profitable', label: 'Profitable' },
  { key: 'red', label: 'In the red' },
];

function capitalise(value) {
  return (value || '').charAt(0).toUpperCase() + (value || '').slice(1);
}

export function createToolbar({ filters, users, colorMap }) {
  // ── Panel sections ──────────────────────────────────────────────────────

  // Keyed on user id, so the colour a chip carries is the colour that User's
  // line has on the chart.
  function userSection(snapshot) {
    const active = snapshot.users ? new Set(snapshot.users) : null;
    const chips = users.map((user) => {
      const on = active !== null && active.has(user.userId);
      const color = colorMap[user.userId] || '#888';
      return `<button class="filter-chip-toggle${on ? ' on' : ''}"`
        + ` data-user="${escapeHtml(user.userId)}" type="button">`
        + `<span class="owner-dot" style="background:${color}"></span>`
        + `${escapeHtml(user.username)}</button>`;
    }).join('');

    return '<div class="filter-row"><span class="filter-label">Owner</span>'
      + `<div class="filter-chips-toggle">${chips}</div></div>`;
  }

  function pickTypeSection(snapshot) {
    const active = snapshot.pickTypes ? new Set(snapshot.pickTypes) : null;
    const chips = PICK_TYPES.map((type) => {
      const on = active !== null && active.has(type.key);
      return `<button class="filter-chip-toggle${on ? ' on' : ''}"`
        + ` data-pick-type="${type.key}" type="button">${type.label}</button>`;
    }).join('');

    return '<div class="filter-row"><span class="filter-label">Pick type</span>'
      + `<div class="filter-chips-toggle">${chips}</div></div>`;
  }

  function profitabilitySection(snapshot) {
    return segmentedSection('Profitability', PROFITABILITY_OPTIONS, 'profitability', snapshot.profitability);
  }

  function otherSection(snapshot) {
    return '<div class="filter-row">'
      + '<span class="filter-label">Other</span>'
      + '<label class="form-check-label" style="font-size:0.85rem">'
      + '<input type="checkbox" id="filter-unowned" class="form-check-input me-1"'
      + `${snapshot.showUnowned ? ' checked' : ''}>Show unowned movies</label>`
      + '<button id="filter-clear-all" class="btn btn-link btn-sm ms-auto" type="button"'
      + ' style="font-size:0.8rem">Clear all filters</button>'
      + '</div>';
  }

  // Repaint the open panel in place rather than rebuilding it, so an input the
  // reader is mid-way through typing in keeps its focus and its caret.
  function syncPanel(panel, snapshot) {
    const activeUsers = snapshot.users ? new Set(snapshot.users) : null;
    const activeTypes = snapshot.pickTypes ? new Set(snapshot.pickTypes) : null;

    for (const button of panel.querySelectorAll('[data-user]')) {
      button.classList.toggle('on', !!activeUsers && activeUsers.has(button.dataset.user));
    }
    for (const button of panel.querySelectorAll('[data-pick-type]')) {
      button.classList.toggle('on', !!activeTypes && activeTypes.has(button.dataset.pickType));
    }
    syncSegmented(panel, 'released-status', snapshot.released);
    syncSegmented(panel, 'profitability', snapshot.profitability);
    syncDateRange(panel, snapshot);
    syncSearch(panel, snapshot);

    const unowned = panel.querySelector('#filter-unowned');
    if (unowned) unowned.checked = snapshot.showUnowned;
  }

  function bindPanel(panel) {
    panel.addEventListener('click', (event) => {
      const userButton = event.target.closest('[data-user]');
      if (userButton) return filters.toggleUser(userButton.dataset.user);

      const typeButton = event.target.closest('[data-pick-type]');
      if (typeButton) return filters.togglePickType(typeButton.dataset.pickType);

      const profitButton = event.target.closest('[data-profitability]');
      if (profitButton) return filters.setProfitability(profitButton.dataset.profitability);

      if (event.target.id === 'filter-clear-all') filters.clearAll();
      return undefined;
    });

    panel.addEventListener('change', (event) => {
      if (event.target.id === 'filter-unowned') filters.setShowUnowned(event.target.checked);
    });

    bindReleasedStatus(panel, filters);
    bindDateRange(panel, filters);
    bindSearch(panel, filters, SEARCH_DEBOUNCE_MS);
  }

  // ── Chips ───────────────────────────────────────────────────────────────

  const usernames = new Map(users.map((user) => [user.userId, user.username]));
  function usernameFor(userId) {
    return usernames.get(userId) ?? userId;
  }

  // One chip per narrowed dimension. Users are named while there are few enough
  // to read, and counted after that.
  function chipsForSnapshot(snapshot) {
    const chips = [];

    if (snapshot.search) chips.push({ key: 'search', label: `Search: "${snapshot.search}"` });

    if (snapshot.users && snapshot.users.length > 0) {
      const names = snapshot.users.map(usernameFor);
      chips.push({
        key: 'users',
        label: names.length <= 2 ? `Owners: ${names.join(', ')}` : `Owners: ${names.length}`,
      });
    }

    if (snapshot.pickTypes && snapshot.pickTypes.length > 0) {
      chips.push({ key: 'pickTypes', label: `Type: ${snapshot.pickTypes.map(capitalise).join(', ')}` });
    }

    if (snapshot.releaseFrom || snapshot.releaseTo) {
      chips.push({
        key: 'releaseRange',
        label: `Released: ${snapshot.releaseFrom || '…'} to ${snapshot.releaseTo || '…'}`,
      });
    }

    if (snapshot.released !== 'all') {
      chips.push({
        key: 'released',
        label: snapshot.released === 'released' ? 'Released only' : 'Upcoming only',
      });
    }

    if (snapshot.profitability !== 'all') {
      chips.push({
        key: 'profitability',
        label: snapshot.profitability === 'profitable' ? 'Profitable' : 'In the red',
      });
    }

    if (snapshot.showUnowned) chips.push({ key: 'unowned', label: 'Unowned included' });

    return chips;
  }

  return createFilterShell({
    filters,
    sections: [
      searchSection,
      userSection,
      pickTypeSection,
      dateSection,
      releasedSection,
      profitabilitySection,
      otherSection,
    ],
    chipsFor: chipsForSnapshot,
    bindPanel,
    syncPanel,
  });
}
