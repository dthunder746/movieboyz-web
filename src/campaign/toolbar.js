// The Filters button, the chips row and the panel behind them.
//
// This module holds no filter state of its own. Every control pushes into
// `filters.js` and every repaint reads back out of it, so the panel and the
// chips cannot disagree with what the table is actually showing.

import { escapeHtml } from '../shared/format.js';

const SEARCH_DEBOUNCE_MS = 150;

const PICK_TYPES = [
  { key: 'hit', label: 'Hit' },
  { key: 'seasonal', label: 'Seasonal' },
  { key: 'bomb', label: 'Bomb' },
];

const RELEASED_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'released', label: 'Released only' },
  { key: 'upcoming', label: 'Upcoming only' },
];

const PROFITABILITY_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'profitable', label: 'Profitable' },
  { key: 'red', label: 'In the red' },
];

function capitalise(value) {
  return (value || '').charAt(0).toUpperCase() + (value || '').slice(1);
}

// ── Folding ───────────────────────────────────────────────────────────────
// Neither the panel nor the chips row can transition `display`, so both fold
// their height (and the padding, margin and opacity that go with it) between
// zero and their natural size. The content has to be in place before `foldOpen`
// measures the target.

function clearFold(element) {
  element.style.height = '';
  element.style.paddingTop = '';
  element.style.paddingBottom = '';
  element.style.marginBottom = '';
  element.style.opacity = '';
}

function foldOpen(element) {
  element.classList.remove('fold-closing', 'fold-opening');
  clearFold(element);
  element.classList.remove('d-none');

  const target = element.getBoundingClientRect().height;

  element.style.height = '0px';
  element.style.paddingTop = '0px';
  element.style.paddingBottom = '0px';
  element.style.marginBottom = '0px';
  element.style.opacity = '0';
  void element.offsetWidth; // lock the collapsed start before transitioning

  element.classList.add('fold-opening');
  element.style.height = `${target}px`;
  element.style.paddingTop = '';
  element.style.paddingBottom = '';
  element.style.marginBottom = '';
  element.style.opacity = '';
}

function foldClose(element) {
  element.classList.remove('fold-opening');

  const height = element.getBoundingClientRect().height;
  element.style.height = `${height}px`;
  void element.offsetWidth; // lock the starting height before transitioning

  element.classList.add('fold-closing');
  element.style.height = '0px';
  element.style.paddingTop = '0px';
  element.style.paddingBottom = '0px';
  element.style.marginBottom = '0px';
  element.style.opacity = '0';
}

function wireFold(element) {
  element.addEventListener('transitionend', (event) => {
    if (event.propertyName !== 'height') return;
    if (element.classList.contains('fold-closing')) {
      element.classList.add('d-none');
      element.classList.remove('fold-closing');
      clearFold(element);
    } else if (element.classList.contains('fold-opening')) {
      element.classList.remove('fold-opening');
      clearFold(element);
    }
  });
}

export function createToolbar({ filters, users, colorMap }) {
  const panel = document.getElementById('filters-panel');
  const toggleButton = document.getElementById('filters-toggle');
  const badge = document.getElementById('filters-badge');
  const chipsElement = document.getElementById('filter-chips');
  if (!panel || !toggleButton || !badge || !chipsElement) return { refresh: () => {} };

  let panelOpen = false;
  let panelBound = false;
  let chipsShown = false;

  wireFold(panel);
  wireFold(chipsElement);

  // ── Panel sections ──────────────────────────────────────────────────────

  function searchSection(snapshot) {
    return '<div class="filter-row">'
      + '<span class="filter-label">Search</span>'
      + '<input type="text" id="filter-search" class="form-control form-control-sm"'
      + ` style="max-width:280px" placeholder="Title contains…" value="${escapeHtml(snapshot.search)}">`
      + '</div>';
  }

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

  function dateSection(snapshot) {
    return '<div class="filter-row">'
      + '<span class="filter-label">Release date</span>'
      + '<input type="date" id="filter-date-from" class="form-control form-control-sm"'
      + ` style="width:auto" value="${snapshot.releaseFrom || ''}">`
      + '<span class="text-muted" style="font-size:0.78rem">to</span>'
      + '<input type="date" id="filter-date-to" class="form-control form-control-sm"'
      + ` style="width:auto" value="${snapshot.releaseTo || ''}">`
      + '</div>';
  }

  function segmentedSection(label, options, attribute, current) {
    const buttons = options.map((option) => `<button class="filter-segmented-btn`
      + `${current === option.key ? ' on' : ''}" data-${attribute}="${option.key}"`
      + ` type="button">${option.label}</button>`).join('');

    return `<div class="filter-row"><span class="filter-label">${label}</span>`
      + `<div class="filter-segmented">${buttons}</div></div>`;
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

  function renderPanel() {
    const snapshot = filters.snapshot();
    panel.innerHTML = searchSection(snapshot)
      + userSection(snapshot)
      + pickTypeSection(snapshot)
      + dateSection(snapshot)
      + segmentedSection('Released', RELEASED_OPTIONS, 'released-status', snapshot.released)
      + segmentedSection('Profitability', PROFITABILITY_OPTIONS, 'profitability', snapshot.profitability)
      + otherSection(snapshot);
    bindPanel();
  }

  // Repaint the open panel in place rather than rebuilding it, so an input the
  // reader is mid-way through typing in keeps its focus and its caret.
  function syncPanel() {
    const snapshot = filters.snapshot();
    const activeUsers = snapshot.users ? new Set(snapshot.users) : null;
    const activeTypes = snapshot.pickTypes ? new Set(snapshot.pickTypes) : null;

    for (const button of panel.querySelectorAll('[data-user]')) {
      button.classList.toggle('on', !!activeUsers && activeUsers.has(button.dataset.user));
    }
    for (const button of panel.querySelectorAll('[data-pick-type]')) {
      button.classList.toggle('on', !!activeTypes && activeTypes.has(button.dataset.pickType));
    }
    for (const button of panel.querySelectorAll('[data-released-status]')) {
      button.classList.toggle('on', snapshot.released === button.dataset.releasedStatus);
    }
    for (const button of panel.querySelectorAll('[data-profitability]')) {
      button.classList.toggle('on', snapshot.profitability === button.dataset.profitability);
    }

    const from = panel.querySelector('#filter-date-from');
    const to = panel.querySelector('#filter-date-to');
    if (from && document.activeElement !== from) from.value = snapshot.releaseFrom || '';
    if (to && document.activeElement !== to) to.value = snapshot.releaseTo || '';

    const unowned = panel.querySelector('#filter-unowned');
    if (unowned) unowned.checked = snapshot.showUnowned;

    const search = panel.querySelector('#filter-search');
    if (search && document.activeElement !== search) search.value = snapshot.search;
  }

  // Delegated once, because the panel's markup is replaced whenever it opens.
  function bindPanel() {
    if (panelBound) return;
    panelBound = true;

    panel.addEventListener('click', (event) => {
      const userButton = event.target.closest('[data-user]');
      if (userButton) return filters.toggleUser(userButton.dataset.user);

      const typeButton = event.target.closest('[data-pick-type]');
      if (typeButton) return filters.togglePickType(typeButton.dataset.pickType);

      const releasedButton = event.target.closest('[data-released-status]');
      if (releasedButton) return filters.setReleasedStatus(releasedButton.dataset.releasedStatus);

      const profitButton = event.target.closest('[data-profitability]');
      if (profitButton) return filters.setProfitability(profitButton.dataset.profitability);

      if (event.target.id === 'filter-clear-all') filters.clearAll();
      return undefined;
    });

    panel.addEventListener('change', (event) => {
      if (event.target.id === 'filter-date-from' || event.target.id === 'filter-date-to') {
        const from = panel.querySelector('#filter-date-from');
        const to = panel.querySelector('#filter-date-to');
        filters.setReleaseRange(from ? from.value : '', to ? to.value : '');
        return;
      }
      if (event.target.id === 'filter-unowned') filters.setShowUnowned(event.target.checked);
    });

    // Typing debounced: without it every keystroke re-filters the table, and on
    // the detailed view that is a full redraw per character.
    let debounce = null;
    panel.addEventListener('input', (event) => {
      if (event.target.id !== 'filter-search') return;
      const { value } = event.target;
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => filters.setSearch(value), SEARCH_DEBOUNCE_MS);
    });
  }

  // ── Chips ───────────────────────────────────────────────────────────────

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

  const usernames = new Map(users.map((user) => [user.userId, user.username]));
  function usernameFor(userId) {
    return usernames.get(userId) ?? userId;
  }

  function chipInner(chip) {
    return `${escapeHtml(chip.label)} <button class="filter-chip-close" type="button"`
      + ` aria-label="Clear ${chip.key}">×</button>`;
  }

  function createChip(chip) {
    const element = document.createElement('span');
    element.className = 'filter-chip';
    element.setAttribute('data-dim', chip.key);
    element.setAttribute('data-label', chip.label);
    element.innerHTML = chipInner(chip);
    return element;
  }

  // A chip widens in and collapses out. The filter itself has already been
  // applied by the time either runs, so this is purely visual.
  function animateChipIn(element) {
    const target = element.getBoundingClientRect().width;
    element.style.overflow = 'hidden';
    element.style.width = '0px';
    element.style.opacity = '0';
    element.style.marginRight = '0px';
    element.style.paddingLeft = '0px';
    element.style.paddingRight = '0px';
    void element.offsetWidth;
    element.style.width = `${target}px`;
    element.style.opacity = '';
    element.style.marginRight = '';
    element.style.paddingLeft = '';
    element.style.paddingRight = '';
    element.addEventListener('transitionend', function done(event) {
      if (event.propertyName !== 'width') return;
      element.removeEventListener('transitionend', done);
      element.style.width = '';
      element.style.overflow = '';
    });
  }

  function animateChipOut(element) {
    element.classList.add('chip-leaving');
    const width = element.getBoundingClientRect().width;
    element.style.overflow = 'hidden';
    element.style.width = `${width}px`;
    void element.offsetWidth;
    element.style.width = '0px';
    element.style.opacity = '0';
    element.style.marginRight = '0px';
    element.style.paddingLeft = '0px';
    element.style.paddingRight = '0px';
    element.addEventListener('transitionend', function done(event) {
      if (event.propertyName !== 'width') return;
      element.removeEventListener('transitionend', done);
      element.remove();
    });
  }

  // Reconciled by dimension rather than re-rendered wholesale, so a removed chip
  // gets to animate out and the ones either side of it stay put.
  function reconcileChips(desired) {
    const present = {};
    for (const element of chipsElement.querySelectorAll('.filter-chip')) {
      if (!element.classList.contains('chip-leaving')) {
        present[element.getAttribute('data-dim')] = element;
      }
    }

    const wanted = new Set();
    let previous = null;
    for (const chip of desired) {
      wanted.add(chip.key);
      let element = present[chip.key];
      if (element) {
        if (element.getAttribute('data-label') !== chip.label) {
          element.setAttribute('data-label', chip.label);
          element.innerHTML = chipInner(chip);
        }
      } else {
        element = createChip(chip);
        chipsElement.insertBefore(element, previous ? previous.nextSibling : chipsElement.firstChild);
        animateChipIn(element);
      }
      previous = element;
    }

    for (const element of chipsElement.querySelectorAll('.filter-chip')) {
      if (!wanted.has(element.getAttribute('data-dim'))
        && !element.classList.contains('chip-leaving')) {
        animateChipOut(element);
      }
    }
  }

  function renderChips() {
    const snapshot = filters.snapshot();
    const chips = chipsForSnapshot(snapshot);
    const nowShown = chips.length > 0;

    if (nowShown && !chipsShown) {
      // The row appearing: render every chip, then fold the row itself down.
      chipsElement.innerHTML = chips.map((chip) => '<span class="filter-chip"'
        + ` data-dim="${chip.key}" data-label="${escapeHtml(chip.label)}">`
        + `${chipInner(chip)}</span>`).join('');
      foldOpen(chipsElement);
    } else if (!nowShown && chipsShown) {
      foldClose(chipsElement);
    } else if (nowShown && chipsShown) {
      reconcileChips(chips);
    }

    chipsShown = nowShown;
    if (snapshot.activeCount > 0) badge.textContent = String(snapshot.activeCount);
    badge.classList.toggle('is-collapsed', snapshot.activeCount === 0);
  }

  chipsElement.addEventListener('click', (event) => {
    const chip = event.target.closest('.filter-chip-close')?.closest('.filter-chip');
    if (chip) filters.clearDimension(chip.dataset.dim);
  });

  toggleButton.addEventListener('click', () => {
    panelOpen = !panelOpen;
    toggleButton.classList.toggle('active', panelOpen);
    toggleButton.setAttribute('aria-expanded', panelOpen ? 'true' : 'false');
    if (panelOpen) {
      renderPanel(); // the content has to exist before foldOpen can measure it
      foldOpen(panel);
    } else {
      foldClose(panel);
    }
  });

  return {
    refresh() {
      renderChips();
      if (panelOpen) syncPanel();
    },
  };
}
