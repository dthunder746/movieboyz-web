// PROTOTYPE — throwaway. How the cascade opens, for platform#168.
//
// One small script rather than Bootstrap's dropdown, because Bootstrap has no
// second level and its own key handling would have to be fought rather than
// extended. Deliberately not general: it knows there are exactly two levels.
//
// What it guarantees, in all three `?touch=` modes:
//   Tab           reaches the toggle, and every row once a level is open
//   Enter/Space   opens the toggle, or a League's second level
//   ArrowDown/Up  moves between the rows of the level that has focus
//   ArrowRight    opens a League's second level and lands on its first row
//   ArrowLeft     closes back a level, landing on the League row
//   Escape        the same, and from level one closes the menu to the toggle
//
// Hover opens the second level as well, but only in the wide reading: a hover
// that opens something has no answer on a phone, which is the whole of why
// `?touch=` exists.

let outsideWired = false;

export function wireMenus(root) {
  for (const menu of root.querySelectorAll('[data-menu]')) wireMenu(menu);

  // A click outside closes whatever is open. Wired once, because the page
  // re-renders on every control change and the listener would otherwise stack.
  if (outsideWired) return;
  outsideWired = true;
  document.addEventListener('click', (event) => {
    for (const menu of root.querySelectorAll('[data-menu]')) {
      if (!menu.contains(event.target)) closeMenu(menu);
    }
  });
}

function wireMenu(menu) {
  const toggle = menu.querySelector('[data-toggle]');

  toggle.addEventListener('click', () => {
    if (menu.classList.contains('is-open')) closeMenu(menu);
    else openMenu(menu);
  });

  // Opening a League. In `split` this is the chevron; in the other two it is
  // the whole row, which is also why the row is a button there and a link here.
  for (const opener of menu.querySelectorAll('[data-open]')) {
    opener.addEventListener('click', (event) => {
      event.preventDefault();
      const block = opener.closest('.proto-l1');
      if (block.classList.contains('is-open')) closeLevelTwo(menu);
      else openLevelTwo(menu, block);
    });
  }

  for (const back of menu.querySelectorAll('[data-back]')) {
    back.addEventListener('click', (event) => {
      event.preventDefault();
      const block = back.closest('.proto-l1');
      closeLevelTwo(menu);
      focus(rowOf(block));
    });
  }

  // Hover, wide only. The compact overlay never opens anything on hover,
  // because a finger cannot hover.
  if (menu.classList.contains('proto-menu--wide')) {
    for (const block of menu.querySelectorAll('.proto-l1')) {
      block.addEventListener('mouseenter', () => {
        if (menu.classList.contains('is-open')) openLevelTwo(menu, block, { focusFirst: false });
      });
    }
  }

  menu.addEventListener('keydown', (event) => onKey(event, menu, toggle));

  // Tabbing out of the menu closes it, which is what a reader who has moved on
  // means. `relatedTarget` is where focus went, and null means the page.
  menu.addEventListener('focusout', (event) => {
    if (!menu.contains(event.relatedTarget)) closeMenu(menu);
  });
}

function onKey(event, menu, toggle) {
  const key = event.key;
  const target = event.target;

  if (target === toggle) {
    if (key === 'Enter' || key === ' ' || key === 'ArrowDown') {
      event.preventDefault();
      openMenu(menu);
    }
    if (key === 'Escape') closeMenu(menu);
    return;
  }

  const panel = panelOf(target);
  if (!panel) return;
  const level = Number(panel.dataset.level);

  if (key === 'ArrowDown' || key === 'ArrowUp') {
    event.preventDefault();
    const items = rows(panel);
    const index = items.indexOf(nearestRow(target));
    const next = (index + (key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    focus(items[next]);
    return;
  }

  if (key === 'ArrowRight' && level === 1) {
    const block = target.closest('.proto-l1');
    if (!block) return;
    event.preventDefault();
    openLevelTwo(menu, block);
    return;
  }

  if (key === 'ArrowLeft' || key === 'Escape') {
    event.preventDefault();
    if (level === 2) {
      const block = target.closest('.proto-l1');
      closeLevelTwo(menu);
      focus(rowOf(block));
    } else {
      closeMenu(menu);
      focus(toggle);
    }
    return;
  }

  // A row that opens something is a button, so Enter and Space already fire
  // its click, and the `split` chevron is a button too. Nothing else to do.
}

function openMenu(menu) {
  menu.classList.add('is-open');
  const panel = menu.querySelector('.proto-panel-1');
  panel.hidden = false;
  menu.querySelector('[data-toggle]').setAttribute('aria-expanded', 'true');

  // Land on the League the reader is inside when there is one, so the keyboard
  // reading starts where the mouse reading's highlight already points.
  const inside = menu.querySelector('.proto-l1 .is-inside')?.closest('.proto-l1');
  focus((inside && rowOf(inside)) ?? rows(panel)[0]);
}

function closeMenu(menu) {
  if (!menu.classList.contains('is-open')) return;
  closeLevelTwo(menu);
  menu.classList.remove('is-open');
  menu.querySelector('.proto-panel-1').hidden = true;
  menu.querySelector('[data-toggle]').setAttribute('aria-expanded', 'false');
}

function openLevelTwo(menu, block, { focusFirst = true } = {}) {
  closeLevelTwo(menu);
  block.classList.add('is-open');
  menu.setAttribute('data-open-league', block.dataset.league);
  const panel = block.querySelector('.proto-panel-2');
  panel.hidden = false;
  for (const opener of block.querySelectorAll('[data-open]')) {
    opener.setAttribute('aria-expanded', 'true');
  }
  if (focusFirst) focus(rows(panel)[0]);
}

function closeLevelTwo(menu) {
  for (const block of menu.querySelectorAll('.proto-l1.is-open')) {
    block.classList.remove('is-open');
    block.querySelector('.proto-panel-2').hidden = true;
    for (const opener of block.querySelectorAll('[data-open]')) {
      opener.setAttribute('aria-expanded', 'false');
    }
  }
  menu.removeAttribute('data-open-league');
}

// ── Rows ──────────────────────────────────────────────────────────────────

// The panel a row belongs to, which is the nearest one above it. A level two
// panel sits inside a level one panel, so `closest` has to be taken from the
// row rather than searched for from the menu.
function panelOf(element) {
  return element.closest?.('[data-level]') ?? null;
}

// The rows of one panel, in document order, skipping the ones a nested panel
// owns and the ones the stylesheet has hidden (the back row, everywhere but
// drill-compact).
function rows(panel) {
  return [...panel.querySelectorAll('[data-row], [data-row-draft]')]
    .filter((row) => panelOf(row) === panel)
    .filter((row) => row.offsetParent !== null || row.getClientRects().length);
}

// The row an element stands for. The `split` chevron is not itself a row: it
// belongs to the League row beside it, so Arrow keys treat the pair as one.
function nearestRow(element) {
  const hit = element.closest('[data-row], [data-row-chev], [data-row-draft]');
  if (hit?.hasAttribute('data-row-chev')) return rowOf(hit.closest('.proto-l1'));
  return hit;
}

function rowOf(block) {
  return block?.querySelector('[data-row]');
}

function focus(element) {
  element?.focus();
}
