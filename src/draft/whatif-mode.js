// What-if mode: the banner, the settings menu, the two-click swap gesture and
// the first-run tour.
//
// Ported from the old site's `js/draft/whatif-mode.js`. It is all document
// wiring and holds no state of its own beyond what is selected: the swaps live
// in `whatif-store.js`, which is where the port's tests are. Two things changed.
// Rows are keyed by User id rather than by an owner name, and the intro's replay
// is called directly rather than through a global the help button reached for,
// which the old file needed only because the two lived in different scripts.

import * as store from './whatif-store.js';

const SEASON_LABEL = { WINTER: 'Winter', SUMMER: 'Summer', FALL: 'Fall' };

let pillEl = null;
let bannerEl = null;
let appEl = null;
let counterEl = null;
let undoBtn = null;
let resetBtn = null;
let exitBtn = null;
let helpBtn = null;
let hideLockedBtn = null;
let dateInputEl = null;
let settingsBtn = null;
let settingsPanelEl = null;

// ── The banner ────────────────────────────────────────────────────────────

function renderBannerContent() {
  bannerEl.innerHTML = ''
    + '<div class="draft-whatif-banner-info">'
    + '<span class="draft-whatif-banner-label">WHAT-IF MODE</span>'
    + '<span class="draft-whatif-banner-counter" id="draft-whatif-counter"></span>'
    + '</div>'
    + '<div class="draft-whatif-banner-actions">'
    + '<button id="draft-whatif-settings" class="btn btn-sm btn-whatif-secondary draft-whatif-icon-btn" type="button" aria-label="What-if settings" aria-expanded="false" aria-controls="draft-whatif-settings-panel" title="Settings">'
    + '<span aria-hidden="true">⚙</span>'
    + '</button>'
    + '<button id="draft-whatif-exit" class="btn btn-sm btn-whatif-exit" type="button">Exit</button>'
    + '</div>'
    + '<div id="draft-whatif-settings-panel" class="draft-whatif-settings-panel" role="menu" hidden>'
    + '<label class="draft-whatif-settings-row draft-whatif-date-group" for="draft-whatif-date-input">'
    + '<span class="draft-whatif-date-label">Draft date</span>'
    + '<input type="date" id="draft-whatif-date-input" class="draft-whatif-date-input" />'
    + '</label>'
    + '<div class="draft-whatif-settings-divider" role="separator"></div>'
    + '<button id="draft-whatif-undo" class="draft-whatif-settings-item" type="button">'
    + '<span class="draft-whatif-settings-icon" aria-hidden="true">↶</span>'
    + '<span>Undo last swap</span>'
    + '</button>'
    + '<button id="draft-whatif-reset" class="draft-whatif-settings-item" type="button">'
    + '<span class="draft-whatif-settings-icon" aria-hidden="true">↻</span>'
    + '<span>Reset all swaps</span>'
    + '</button>'
    + '<button id="draft-whatif-hide-locked" class="draft-whatif-settings-item" type="button" aria-pressed="false">'
    + '<span class="draft-whatif-settings-icon" aria-hidden="true">👁</span>'
    + '<span class="draft-whatif-hide-locked-label">Hide locked picks</span>'
    + '</button>'
    + '<div class="draft-whatif-settings-divider" role="separator"></div>'
    + '<button id="draft-whatif-help" class="draft-whatif-settings-item" type="button">'
    + '<span class="draft-whatif-settings-icon" aria-hidden="true">?</span>'
    + '<span>Show intro</span>'
    + '</button>'
    + '</div>';

  counterEl = document.getElementById('draft-whatif-counter');
  undoBtn = document.getElementById('draft-whatif-undo');
  resetBtn = document.getElementById('draft-whatif-reset');
  exitBtn = document.getElementById('draft-whatif-exit');
  helpBtn = document.getElementById('draft-whatif-help');
  hideLockedBtn = document.getElementById('draft-whatif-hide-locked');
  dateInputEl = document.getElementById('draft-whatif-date-input');
  settingsBtn = document.getElementById('draft-whatif-settings');
  settingsPanelEl = document.getElementById('draft-whatif-settings-panel');

  undoBtn.addEventListener('click', () => { store.undo(); closeSettingsPanel(); });
  resetBtn.addEventListener('click', () => { store.reset(); closeSettingsPanel(); });
  exitBtn.addEventListener('click', () => { store.disable(); });
  helpBtn.addEventListener('click', () => {
    closeSettingsPanel();
    runIntroSequence();
  });
  hideLockedBtn.addEventListener('click', () => {
    store.setHideLocked(!store.getState().hideLocked);
  });
  dateInputEl.addEventListener('change', () => {
    const season = currentSeasonRef();
    if (!season) return;
    store.setDraftDate(season, dateInputEl.value || null);
  });
  settingsBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleSettingsPanel();
  });
  settingsPanelEl.addEventListener('click', (event) => {
    event.stopPropagation();
  });
}

function openSettingsPanel() {
  if (!settingsPanelEl || !settingsBtn) return;
  settingsPanelEl.hidden = false;
  settingsBtn.setAttribute('aria-expanded', 'true');
  document.addEventListener('click', onDocumentClickForPanel, true);
  document.addEventListener('keydown', onKeydownForPanel, true);
}

function closeSettingsPanel() {
  if (!settingsPanelEl || !settingsBtn) return;
  if (settingsPanelEl.hidden) return;
  settingsPanelEl.hidden = true;
  settingsBtn.setAttribute('aria-expanded', 'false');
  document.removeEventListener('click', onDocumentClickForPanel, true);
  document.removeEventListener('keydown', onKeydownForPanel, true);
}

function toggleSettingsPanel() {
  if (!settingsPanelEl) return;
  if (settingsPanelEl.hidden) openSettingsPanel();
  else closeSettingsPanel();
}

function onDocumentClickForPanel(event) {
  if (!settingsPanelEl || settingsPanelEl.hidden) return;
  if (settingsPanelEl.contains(event.target)) return;
  if (settingsBtn && settingsBtn.contains(event.target)) return;
  closeSettingsPanel();
}

function onKeydownForPanel(event) {
  if (event.key === 'Escape' || event.key === 'Esc') {
    closeSettingsPanel();
    if (settingsBtn) settingsBtn.focus();
  }
}

// The draft date is per Season, so the input follows the tab.
export function updateBannerForSeason(season) {
  if (!dateInputEl) return;
  dateInputEl.value = store.getDraftDate(season) || '';
}

function syncFromState() {
  const state = store.getState();

  pillEl.setAttribute('aria-pressed', state.enabled ? 'true' : 'false');
  bannerEl.classList.toggle('is-shown', state.enabled);
  appEl.classList.toggle('is-whatif', state.enabled);
  appEl.classList.toggle('hide-locked', state.enabled && state.hideLocked);

  if (hideLockedBtn) {
    hideLockedBtn.setAttribute('aria-pressed', state.hideLocked ? 'true' : 'false');
    const label = hideLockedBtn.querySelector('.draft-whatif-hide-locked-label');
    if (label) label.textContent = state.hideLocked ? 'Show locked picks' : 'Hide locked picks';
  }

  if (!state.enabled) {
    cancelIntro();
    closeSettingsPanel();
    clearLockedTooltips();
    clearPreDraftTooltips();
    clearSelection();
    return;
  }

  const count = state.swaps.length;
  if (counterEl) counterEl.textContent = count === 0 ? '' : `${count} active`;
  if (undoBtn) undoBtn.disabled = count === 0;
  if (resetBtn) resetBtn.disabled = count === 0;
  maybeRunIntro();
}

export function mountWhatifMode() {
  pillEl = document.getElementById('draft-whatif-pill');
  bannerEl = document.getElementById('draft-whatif-banner');
  appEl = document.getElementById('draft-app');
  if (!pillEl || !bannerEl || !appEl) return;

  renderBannerContent();

  pillEl.addEventListener('click', () => {
    if (store.getState().enabled) store.disable();
    else store.enable();
  });

  store.subscribe(syncFromState);
  syncFromState();
}

// ── Selection ─────────────────────────────────────────────────────────────

// What the reader has clicked first: a slot on the board, an emptied slot, or a
// candidate from the sidebar. The second click is what turns it into a swap.
let selected = null;
let currentSeasonRef = () => null;

function clearSelectionUI() {
  document.querySelectorAll('.draft-row-selected').forEach((el) => el.classList.remove('draft-row-selected'));
  document.querySelectorAll('.draft-row-candidate').forEach((el) => el.classList.remove('draft-row-candidate'));
}

function dispatchSelectionChanged() {
  if (!appEl) return;
  appEl.dispatchEvent(new CustomEvent('whatif:selection-changed', { detail: { selected } }));
}

// Paint everything the current selection could legally swap with. A film that
// opened before draft day is never one of them.
function paintCandidates() {
  if (!selected) return;

  if (selected.kind === 'slot-ghost') {
    document.querySelectorAll('#draft-unpicked tbody tr[data-kind="candidate"]').forEach((row) => {
      if (row.dataset.preDraft !== '1') row.classList.add('draft-row-candidate');
    });
  } else {
    document.querySelectorAll('#draft-picks tbody tr.draft-row-swappable:not(.draft-row-ghost)').forEach((row) => {
      if (row.dataset.imdb !== selected.imdbId && row.dataset.preDraft !== '1') {
        row.classList.add('draft-row-candidate');
      }
    });
    document.querySelectorAll('#draft-unpicked tbody tr[data-kind="candidate"]').forEach((row) => {
      if (row.dataset.imdb !== selected.imdbId && row.dataset.preDraft !== '1') {
        row.classList.add('draft-row-candidate');
      }
    });
    if (selected.kind === 'candidate') {
      document.querySelectorAll('#draft-picks tbody tr.draft-row-ghost').forEach((row) => {
        row.classList.add('draft-row-candidate');
      });
    }
  }

  let selectedEl = null;
  if (selected.kind === 'slot-ghost') {
    if (selected.clearedImdbId) {
      selectedEl = document.querySelector(`tr.draft-row-ghost[data-cleared-imdb="${selected.clearedImdbId}"]`);
    }
  } else if (selected.imdbId) {
    selectedEl = document.querySelector(`tr[data-imdb="${selected.imdbId}"]`);
  }
  if (selectedEl) selectedEl.classList.add('draft-row-selected');
}

function setSelectionFromRow(row) {
  selected = row.kind === 'slot-ghost'
    ? {
      kind: 'slot-ghost',
      imdbId: null,
      clearedImdbId: row.clearedImdbId,
      ghostUserId: row.userId,
      ghostPickType: row.pickType,
      ghostDraftPick: row.draftPick,
    }
    : { kind: row.kind, imdbId: row.imdbId };

  clearSelectionUI();
  paintCandidates();
  dispatchSelectionChanged();
}

function setSelection(kind, imdbId) {
  selected = { kind, imdbId };
  clearSelectionUI();
  paintCandidates();
  dispatchSelectionChanged();
}

function clearSelection() {
  selected = null;
  clearSelectionUI();
  dispatchSelectionChanged();
}

function rowFromEvent(event) {
  const row = event.target.closest('tr[data-imdb], tr[data-kind="slot-ghost"]');
  if (!row) return null;

  const inPicks = Boolean(row.closest('#draft-picks'));
  const inUnpicked = Boolean(row.closest('#draft-unpicked'));
  if (!inPicks && !inUnpicked) return null;

  if (row.dataset.kind === 'slot-ghost') {
    return {
      el: row,
      kind: 'slot-ghost',
      imdbId: null,
      clearedImdbId: row.dataset.clearedImdb || null,
      userId: row.dataset.user || '',
      pickType: row.dataset.pickType || '',
      draftPick: parseInt(row.dataset.draftPick, 10) || null,
    };
  }

  return {
    el: row,
    imdbId: row.dataset.imdb,
    kind: inPicks ? 'slot' : 'candidate',
    userId: row.dataset.user || '',
    pickType: row.dataset.pickType || '',
  };
}

// The year-long Picks cannot be moved, and neither can a film that had already
// opened when the Season was drafted.
function isLocked(row) {
  return row.kind === 'slot' && (row.pickType === 'hit' || row.pickType === 'bomb');
}

function isPreDraft(row) {
  return Boolean(row.el && row.el.dataset && row.el.dataset.preDraft === '1');
}

function fireSwap(slotRow, candidateRow) {
  selected = null;
  clearSelectionUI();
  store.pushSwap(slotRow.imdbId, candidateRow.imdbId, currentSeasonRef());
}

function fireFill(ghostSelection, candidateImdbId) {
  selected = null;
  clearSelectionUI();
  store.pushFill(
    ghostSelection.clearedImdbId,
    {
      userId: ghostSelection.ghostUserId,
      pickType: ghostSelection.ghostPickType,
      draftPick: ghostSelection.ghostDraftPick,
    },
    candidateImdbId,
    currentSeasonRef(),
  );
}

function onAppClick(event) {
  if (!store.getState().enabled) return;

  const clearButton = event.target.closest('.draft-clear-pick');
  if (clearButton) {
    const clearRow = clearButton.closest('tr[data-imdb]');
    if (clearRow && clearRow.dataset.imdb) {
      event.preventDefault();
      event.stopPropagation();
      selected = null;
      clearSelectionUI();
      store.pushClear(clearRow.dataset.imdb, currentSeasonRef());
    }
    return;
  }

  const row = rowFromEvent(event);
  if (!row) {
    // A click on the banner or the pill is the mode's own furniture, not the
    // reader giving up on a selection.
    if (!event.target.closest('.draft-whatif-banner') && !event.target.closest('.draft-whatif-pill')) {
      clearSelection();
    }
    return;
  }

  if (isLocked(row) || isPreDraft(row)) return;

  if (!selected) {
    setSelectionFromRow(row);
    return;
  }

  if (selected.kind === 'slot-ghost') {
    if (row.kind === 'candidate') {
      fireFill(selected, row.imdbId);
      return;
    }
    setSelectionFromRow(row);
    return;
  }

  if (row.kind === 'slot-ghost') {
    if (selected.kind === 'candidate') {
      fireFill(
        {
          clearedImdbId: row.clearedImdbId,
          ghostUserId: row.userId,
          ghostPickType: row.pickType,
          ghostDraftPick: row.draftPick,
        },
        selected.imdbId,
      );
      return;
    }
    setSelectionFromRow(row);
    return;
  }

  if (selected.imdbId === row.imdbId) {
    clearSelection();
    return;
  }

  // Two slots only swap across Slates. Clicking another of your own Picks
  // moves the selection instead, which is what a reader means by it.
  if (selected.kind === 'slot' && row.kind === 'slot') {
    const selectedRowData = (document.querySelector(`tr[data-imdb="${selected.imdbId}"]`) || {}).dataset || {};
    if (!selectedRowData.user || selectedRowData.user === row.userId) {
      setSelection(row.kind, row.imdbId);
      return;
    }
    fireSwap({ imdbId: selected.imdbId }, { imdbId: row.imdbId });
    return;
  }

  if (selected.kind === 'candidate' && row.kind === 'candidate') {
    setSelection(row.kind, row.imdbId);
    return;
  }

  const slot = selected.kind === 'slot' ? { imdbId: selected.imdbId } : { imdbId: row.imdbId };
  const candidate = selected.kind === 'candidate' ? { imdbId: selected.imdbId } : { imdbId: row.imdbId };
  fireSwap(slot, candidate);
}

function onKeydown(event) {
  if (!store.getState().enabled) return;

  if (event.key === 'Escape') {
    clearSelection();
    return;
  }

  if (event.key !== 'Delete' && event.key !== 'Backspace') return;
  if (!selected || selected.kind !== 'slot') return;

  // Not while the reader is in the draft date field.
  const tag = (event.target && event.target.tagName) || '';
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

  const row = document.querySelector(`tr[data-imdb="${selected.imdbId}"]`);
  if (!row || row.classList.contains('draft-row-locked')) return;

  event.preventDefault();
  const imdbId = selected.imdbId;
  selected = null;
  clearSelectionUI();
  store.pushClear(imdbId, currentSeasonRef());
}

export function attachSelectionHandlers(getCurrentSeason) {
  currentSeasonRef = getCurrentSeason;
  document.addEventListener('click', onAppClick);
  document.addEventListener('keydown', onKeydown);
}

// Every render replaces the rows, so the selection has to be painted back onto
// the new ones.
export function repaintSelectionAfterRender() {
  if (!store.getState().enabled) {
    selected = null;
    clearSelectionUI();
    paintSwappedRows();
    return;
  }
  clearSelectionUI();
  paintCandidates();
  paintSwappedRows();
}

function paintSwappedRows() {
  const affected = store.getAffectedImdbIds();
  document.querySelectorAll('#draft-picks tr[data-imdb], #draft-unpicked tr[data-imdb]').forEach((row) => {
    if (affected[row.dataset.imdb]) row.setAttribute('data-swapped', '1');
    else row.removeAttribute('data-swapped');
  });
}

export function clearSelectionOnTabChange() {
  clearSelection();
}

// ── Tooltips ──────────────────────────────────────────────────────────────

let lockedTooltipInstances = [];
let preDraftTooltipInstances = [];

function clearLockedTooltips() {
  lockedTooltipInstances.forEach((tooltip) => { try { tooltip.dispose(); } catch { /* already gone */ } });
  lockedTooltipInstances = [];
}

function clearPreDraftTooltips() {
  preDraftTooltipInstances.forEach((tooltip) => { try { tooltip.dispose(); } catch { /* already gone */ } });
  preDraftTooltipInstances = [];
}

// Both say why a row refused a click, so they only exist while the mode is on.
export function refreshLockedTooltips() {
  clearLockedTooltips();
  if (!store.getState().enabled) return;
  if (!window.bootstrap || !window.bootstrap.Tooltip) return;

  document.querySelectorAll('#draft-picks tr.draft-row-locked').forEach((row) => {
    const pickType = row.dataset.pickType;
    const title = pickType === 'hit'
      ? 'Hit picks are locked'
      : (pickType === 'bomb' ? 'Bomb picks are locked' : 'Locked');
    row.setAttribute('data-bs-toggle', 'tooltip');
    row.setAttribute('title', title);
    lockedTooltipInstances.push(new window.bootstrap.Tooltip(row, { trigger: 'hover', placement: 'top' }));
  });
}

export function refreshPreDraftTooltips() {
  clearPreDraftTooltips();
  if (!store.getState().enabled) return;
  if (!window.bootstrap || !window.bootstrap.Tooltip) return;

  const season = currentSeasonRef();
  const seasonLabel = (season && SEASON_LABEL[season]) || 'this season';
  const title = `Movie was released before ${seasonLabel} draft day, unavailable for selection.`;

  document.querySelectorAll('#draft-unpicked tr.draft-row-pre-draft').forEach((row) => {
    row.setAttribute('data-bs-toggle', 'tooltip');
    row.setAttribute('title', title);
    preDraftTooltipInstances.push(new window.bootstrap.Tooltip(row, { trigger: 'hover', placement: 'top' }));
  });
}

// ── The first-run tour ────────────────────────────────────────────────────

// The one what-if key that is deliberately not scoped to the Campaign, where
// `whatif-store.js` scopes all four of its own. The tour teaches the gesture,
// and the gesture is the same on every draft page, so a reader who has sat
// through it on 2026 should not be shown it again on 2027. The scoped keys hold
// a reader's swaps, which genuinely belong to one year's Board; this holds
// whether they have been taught, which belongs to the reader.
const INTRO_KEY = 'mb_whatif_seen_intro';

let currentIntroStep = 0; // 0 = idle, 1..6 = step number
let currentIntroPopover = null;
let currentIntroDocClick = null;
let currentIntroSelectionHandler = null;
let currentIntroStoreUnsub = null;
let currentIntroBaselineSwapCount = 0;
let currentPulseAnchor = null;
let currentIntroSettingsBtn = null;
let currentIntroSettingsHandler = null;

function reducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function scrollAnchorIntoView(element) {
  if (!element) return;
  element.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' });
}

function clearIntroPulses() {
  document.querySelectorAll('.draft-row-intro-pulse').forEach((el) => el.classList.remove('draft-row-intro-pulse'));
  document.querySelectorAll('.draft-intro-pulse-btn').forEach((el) => el.classList.remove('draft-intro-pulse-btn'));
}

function applyStep2Pulses() {
  document.querySelectorAll('#draft-picks tbody tr.draft-row-swappable:not(.draft-row-ghost):not(.draft-row-pre-draft)')
    .forEach((row) => row.classList.add('draft-row-intro-pulse'));
  document.querySelectorAll('#draft-unpicked tbody tr[data-kind="candidate"]:not(.draft-row-pre-draft)')
    .forEach((row) => row.classList.add('draft-row-intro-pulse'));
}

function applyStep3Pulses() {
  document.querySelectorAll('.draft-row-candidate').forEach((row) => row.classList.add('draft-row-intro-pulse'));
}

function disposeCurrentPopover() {
  if (currentIntroPopover) {
    try { currentIntroPopover.dispose(); } catch { /* already gone */ }
    currentIntroPopover = null;
  }
  if (currentIntroDocClick) {
    document.removeEventListener('click', currentIntroDocClick, true);
    currentIntroDocClick = null;
  }
}

function teardownStepHandlers() {
  if (currentIntroSelectionHandler && appEl) {
    appEl.removeEventListener('whatif:selection-changed', currentIntroSelectionHandler);
    currentIntroSelectionHandler = null;
  }
  if (currentIntroStoreUnsub) {
    try { currentIntroStoreUnsub(); } catch { /* already gone */ }
    currentIntroStoreUnsub = null;
  }
  if (currentIntroSettingsBtn && currentIntroSettingsHandler) {
    currentIntroSettingsBtn.removeEventListener('click', currentIntroSettingsHandler, true);
    currentIntroSettingsBtn = null;
    currentIntroSettingsHandler = null;
  }
}

function clearPulseAnchor() {
  if (!currentPulseAnchor) return;
  currentPulseAnchor.classList.remove('draft-intro-pulse-btn');
  currentPulseAnchor = null;
}

// Changing tab or leaving the mode ends the tour where it stands: its anchors
// are rows that are about to be replaced.
export function cancelIntro() {
  if (currentIntroStep === 0) return;
  disposeCurrentPopover();
  teardownStepHandlers();
  clearIntroPulses();
  clearPulseAnchor();
  if (currentIntroStep === 5) closeSettingsPanel();
  currentIntroStep = 0;
}

function finishIntro() {
  disposeCurrentPopover();
  teardownStepHandlers();
  clearIntroPulses();
  clearPulseAnchor();
  closeSettingsPanel();
  currentIntroStep = 0;
  try { localStorage.setItem(INTRO_KEY, '1'); } catch { /* a storage that will not take a write still shows the tour */ }
}

// opts: { anchor, title, body, skip, gotIt, gotItLabel, onSkip, onAdvance, placement, step, total }
function showStep(opts) {
  const { anchor } = opts;
  if (!anchor || !window.bootstrap || !window.bootstrap.Popover) {
    // Bootstrap missing or nothing to point at: the tour is not worth a broken
    // page, so it completes silently.
    finishIntro();
    return;
  }

  scrollAnchorIntoView(anchor);

  // After the scroll settles, so the popover is placed against where the anchor
  // has come to rest.
  setTimeout(() => {
    const footer = '<div class="draft-whatif-popover-footer">'
      + (opts.skip ? '<button class="draft-whatif-skip btn btn-sm btn-link" type="button">Skip intro</button>' : '<span></span>')
      + (opts.gotIt ? `<button class="draft-whatif-gotit btn btn-sm btn-warning" type="button">${opts.gotItLabel || 'Got it'}</button>` : '<span></span>')
      + '</div>';

    const content = `<div class="draft-whatif-popover-body"><p class="mb-0">${opts.body}</p>${footer}</div>`;

    const title = (opts.step && opts.total)
      ? `<span class="draft-whatif-step-counter">Step ${opts.step} of ${opts.total}</span>`
        + `<span class="draft-whatif-step-title">${opts.title}</span>`
      : opts.title;

    const popover = new window.bootstrap.Popover(anchor, {
      title,
      content,
      html: true,
      trigger: 'manual',
      placement: opts.placement || 'auto',
      sanitize: false,
      customClass: 'draft-whatif-popover',
    });
    popover.show();
    currentIntroPopover = popover;

    function onClick(event) {
      if (event.target.classList.contains('draft-whatif-gotit')) {
        if (opts.onAdvance) opts.onAdvance();
      } else if (event.target.classList.contains('draft-whatif-skip')) {
        if (opts.onSkip) opts.onSkip();
      }
      // A click anywhere else does not dismiss: the tour is a sequence, and
      // half of its steps are waiting for the reader to do the thing.
    }
    currentIntroDocClick = onClick;
    setTimeout(() => document.addEventListener('click', onClick, true), 50);
  }, reducedMotion() ? 0 : 350);
}

function startStep1() {
  currentIntroStep = 1;
  showStep({
    anchor: document.getElementById('draft-whatif-banner'),
    title: 'What-if mode',
    body: 'Numbers and standings update as you swap picks. Toggle off any time.',
    skip: true,
    gotIt: true,
    placement: 'bottom',
    step: 1,
    total: 5,
    onAdvance: () => { disposeCurrentPopover(); startStep2(); },
    onSkip: finishIntro,
  });
}

function startStep2() {
  currentIntroStep = 2;
  applyStep2Pulses();

  const anchor = document.querySelector('#draft-picks tbody tr.draft-row-swappable:not(.draft-row-ghost):not(.draft-row-pre-draft)')
    || document.querySelector('#draft-unpicked tbody tr[data-kind="candidate"]:not(.draft-row-pre-draft)');
  if (!anchor) {
    finishIntro();
    return;
  }

  function handleSelection(event) {
    if (!event.detail || !event.detail.selected) return;
    appEl.removeEventListener('whatif:selection-changed', handleSelection);
    currentIntroSelectionHandler = null;
    disposeCurrentPopover();
    clearIntroPulses();
    startStep3();
  }
  currentIntroSelectionHandler = handleSelection;
  appEl.addEventListener('whatif:selection-changed', handleSelection);

  showStep({
    anchor,
    title: 'Try a swap',
    body: 'Click any of the highlighted picks to start a swap.',
    skip: true,
    gotIt: false,
    step: 2,
    total: 5,
    onSkip: finishIntro,
  });
}

function startStep3() {
  currentIntroStep = 3;
  currentIntroBaselineSwapCount = store.getState().swaps.length;

  function showStep3Popover() {
    applyStep3Pulses();
    const anchor = document.querySelector('tr.draft-row-candidate');
    if (!anchor) return; // nothing to swap with: wait for the next selection
    showStep({
      anchor,
      title: 'Pick a target',
      body: 'Now pick a target — any highlighted row works.',
      skip: true,
      gotIt: false,
      step: 3,
      total: 5,
      onSkip: finishIntro,
    });
  }

  // The selection can change under the popover, taking the row it was anchored
  // to with it.
  function handleSelection(event) {
    disposeCurrentPopover();
    clearIntroPulses();
    if (event.detail && event.detail.selected) showStep3Popover();
  }
  currentIntroSelectionHandler = handleSelection;
  appEl.addEventListener('whatif:selection-changed', handleSelection);

  function handleStore() {
    const op = store.getLastOp();
    if ((op === 'swap' || op === 'fill') && store.getState().swaps.length > currentIntroBaselineSwapCount) {
      teardownStepHandlers();
      disposeCurrentPopover();
      clearIntroPulses();
      // The page's own subscriber re-renders the board straight after this one,
      // so the next step waits a tick for the post-swap rows to exist.
      setTimeout(startStep4, 0);
    }
  }
  currentIntroStoreUnsub = store.subscribe(handleStore);

  showStep3Popover();
}

function startStep4() {
  currentIntroStep = 4;

  // The reader may have opened the panel already during an earlier step.
  if (settingsPanelEl && !settingsPanelEl.hidden) {
    startStep5();
    return;
  }

  const anchor = document.getElementById('draft-whatif-settings');
  if (!anchor) {
    finishIntro();
    return;
  }
  currentPulseAnchor = anchor;
  anchor.classList.add('draft-intro-pulse-btn');

  function onSettingsClick() {
    anchor.removeEventListener('click', onSettingsClick, true);
    currentIntroSettingsBtn = null;
    currentIntroSettingsHandler = null;
    clearPulseAnchor();
    disposeCurrentPopover();
    // The button's own handler opens the panel on this same click, so the next
    // step waits a tick for Undo to be on screen.
    setTimeout(startStep5, 0);
  }
  currentIntroSettingsBtn = anchor;
  currentIntroSettingsHandler = onSettingsClick;
  anchor.addEventListener('click', onSettingsClick, true);

  showStep({
    anchor,
    title: 'Find Undo and Reset',
    body: 'Open the settings menu to recover any swap.',
    skip: false,
    gotIt: false,
    placement: 'left',
    step: 4,
    total: 5,
  });
}

function startStep5() {
  currentIntroStep = 5;
  const anchor = document.getElementById('draft-whatif-undo');
  if (!anchor) {
    finishIntro();
    return;
  }
  currentPulseAnchor = anchor;
  anchor.classList.add('draft-intro-pulse-btn');

  function handleStore() {
    const op = store.getLastOp();
    if (op !== 'undo' && op !== 'reset') return;
    teardownStepHandlers();
    disposeCurrentPopover();
    clearPulseAnchor();
    // Undo and Reset both close the panel right after they fire, so the closing
    // step waits a tick before anchoring back on the gear.
    setTimeout(startClosure, 0);
  }
  currentIntroStoreUnsub = store.subscribe(handleStore);

  showStep({
    anchor,
    title: 'Recover any time',
    body: 'Undo reverts this swap. Reset clears them all.',
    skip: false,
    gotIt: true,
    placement: 'left',
    step: 5,
    total: 5,
    onAdvance: finishIntro,
  });
}

function startClosure() {
  currentIntroStep = 6;
  const anchor = document.getElementById('draft-whatif-settings');
  if (!anchor) {
    finishIntro();
    return;
  }
  showStep({
    anchor,
    title: "You're all set",
    body: "That's the tour. Happy swapping.",
    skip: false,
    gotIt: true,
    gotItLabel: 'Done',
    placement: 'left',
    onAdvance: finishIntro,
  });
}

// Replay always runs, whatever the flag says. That is what the help item is for.
function runIntroSequence() {
  if (currentIntroStep !== 0) cancelIntro();
  startStep1();
}

function maybeRunIntro() {
  let seen = false;
  try { seen = localStorage.getItem(INTRO_KEY) === '1'; } catch { /* no storage: show it */ }
  if (seen) return;
  if (currentIntroStep !== 0) return;
  runIntroSequence();
}
