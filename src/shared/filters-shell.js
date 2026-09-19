// The Filters button, the chips row and the panel behind them, without any
// knowledge of what is being filtered.
//
// A page hands in its own sections and its own chip labels; everything about
// folding the panel open, reconciling the chips and painting the count badge is
// here, so both the Campaign and the Movies lookup behave the same way (#160).
//
// The shell holds no filter state of its own. It reads a filter state through a
// small interface and every control pushes back into it, so the panel and the
// chips cannot disagree with what is actually being shown:
//
//   filters.snapshot()            → an object carrying `activeCount`, plus
//                                   whatever the page's own sections read
//   filters.clearDimension(key)   → drop the dimension a chip's × names
//
// The chip keys are the page's own: `chipsFor` names them and
// `clearDimension` is handed the same string back.

import { escapeHtml } from './format.js';

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

export function foldOpen(element) {
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

export function foldClose(element) {
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

export function wireFold(element) {
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

// ── Chips ─────────────────────────────────────────────────────────────────

export function chipInner(chip) {
  return `${escapeHtml(chip.label)} <button class="filter-chip-close" type="button"`
    + ` aria-label="Clear ${chip.key}">×</button>`;
}

// The whole row in one string, for the case where the row itself is arriving
// and every chip on it is new.
export function chipsMarkup(chips) {
  return chips.map((chip) => '<span class="filter-chip"'
    + ` data-dim="${chip.key}" data-label="${escapeHtml(chip.label)}">`
    + `${chipInner(chip)}</span>`).join('');
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
function reconcileChips(chipsElement, desired) {
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

// ── The shell ─────────────────────────────────────────────────────────────

export function createFilterShell({
  filters, sections, chipsFor, bindPanel, syncPanel,
}) {
  // These four ids are the markup contract both pages carry: a page that wants
  // this shell renders a `filters-toggle` button holding a `filters-badge`, an
  // empty `filters-panel` for the sections and an empty `filter-chips` row.
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

  function renderPanel() {
    const snapshot = filters.snapshot();
    panel.innerHTML = sections.map((section) => section(snapshot)).join('');
    // Delegated once, because the panel's markup is replaced whenever it opens.
    if (!panelBound) {
      panelBound = true;
      bindPanel(panel);
    }
  }

  function renderChips() {
    const snapshot = filters.snapshot();
    const chips = chipsFor(snapshot);
    const nowShown = chips.length > 0;

    if (nowShown && !chipsShown) {
      // The row appearing: render every chip, then fold the row itself down.
      chipsElement.innerHTML = chipsMarkup(chips);
      foldOpen(chipsElement);
    } else if (!nowShown && chipsShown) {
      foldClose(chipsElement);
    } else if (nowShown && chipsShown) {
      reconcileChips(chipsElement, chips);
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
      if (panelOpen) syncPanel(panel, filters.snapshot());
    },
  };
}
