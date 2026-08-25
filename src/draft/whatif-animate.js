// What-if mode's motion: the leaderboard cards sliding into their new order, the
// figures counting up to their new values, and the flashes that say which rows
// a swap touched.
//
// Ported from the old site's `js/draft/whatif-animate.js`. It reads and writes
// the document directly and decides nothing, so it has no test beside it, as
// the site's other DOM wiring has none.
//
// The old file's `snapshotNumbers` is not ported: nothing imported it, and it
// carried the cell-position bug the port fixes (`page.js`).
//
// Every effect is skipped outright under `prefers-reduced-motion`, which leaves
// the page landing on the same state without the travel.

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Where each card sits before the re-render, so the flip below can start it
// from where it was rather than from where it now is.
export function snapshotLeaderboardPositions() {
  const snapshot = {};
  document.querySelectorAll('#draft-leaderboard .draft-lb-card').forEach((card) => {
    const userId = card.dataset.user;
    if (!userId) return;
    const rect = card.getBoundingClientRect();
    snapshot[userId] = { top: rect.top, left: rect.left };
  });
  return snapshot;
}

export function playLeaderboardFlip(previousPositions) {
  if (prefersReducedMotion()) return;
  if (!previousPositions) return;

  document.querySelectorAll('#draft-leaderboard .draft-lb-card').forEach((card) => {
    const previous = previousPositions[card.dataset.user];
    if (!previous) return;

    const rect = card.getBoundingClientRect();
    const dx = previous.left - rect.left;
    const dy = previous.top - rect.top;
    if (dx === 0 && dy === 0) return;

    // Put the card back where it was with no transition, then let it travel to
    // where the re-render has already placed it.
    card.style.transition = 'none';
    card.style.transform = `translate(${dx}px, ${dy}px)`;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        card.style.transition = 'transform 250ms ease-out';
        card.style.transform = 'translate(0, 0)';
        setTimeout(() => {
          card.style.transition = '';
          card.style.transform = '';
        }, 280);
      });
    });
  });
}

function applyColor(element, className) {
  if (!element) return;
  element.classList.remove('text-pos', 'text-neg', 'text-neu');
  if (className) element.classList.add(className);
}

// Count one figure up or down to its new value. The colour is applied at the
// end rather than per frame, so a figure crossing zero does not flicker.
export function tweenNumber(element, from, to, ms, formatter, colorFor) {
  if (!element) return;

  if (from == null || to == null || from === to) {
    if (colorFor && to != null) applyColor(element, colorFor(to));
    return;
  }

  if (prefersReducedMotion()) {
    element.textContent = formatter(to);
    if (colorFor) applyColor(element, colorFor(to));
    return;
  }

  const start = performance.now();

  function frame(now) {
    const progress = Math.min(1, (now - start) / ms);
    const eased = 1 - (1 - progress) ** 3;
    element.textContent = formatter(from + (to - from) * eased);

    if (progress < 1) {
      requestAnimationFrame(frame);
      return;
    }
    element.textContent = formatter(to);
    if (colorFor) applyColor(element, colorFor(to));
  }

  requestAnimationFrame(frame);
}

export function flashCellDirection(element, fromValue, toValue) {
  if (!element || fromValue == null || toValue == null || fromValue === toValue) return;
  const className = toValue > fromValue ? 'draft-flash-pos' : 'draft-flash-neg';
  element.classList.remove('draft-flash-pos', 'draft-flash-neg');
  // Reading the layout restarts the animation for a cell that flashed the same
  // way twice running.
  void element.offsetWidth;
  element.classList.add(className);
}

export function amberOutlineRows(imdbIds) {
  imdbIds.forEach((imdbId) => {
    document.querySelectorAll(`tr[data-imdb="${imdbId}"]`).forEach((row) => {
      row.classList.remove('draft-amber-outline');
      void row.offsetWidth;
      row.classList.add('draft-amber-outline');
    });
  });
}

// A reset changes everything at once, so it fades the page's four surfaces out
// and back rather than flashing every row it touched.
export function fadeResetEnvelope(beforeRender, afterRender) {
  const targets = [
    document.getElementById('draft-leaderboard'),
    document.getElementById('draft-picks'),
    document.getElementById('draft-highlights'),
    document.getElementById('draft-unpicked'),
  ].filter(Boolean);

  const primary = targets[0];
  if (prefersReducedMotion() || !primary) {
    beforeRender();
    afterRender();
    return;
  }

  targets.forEach((element) => {
    element.style.transition = 'opacity 180ms ease-out';
    element.style.opacity = '0';
  });

  let fired = false;

  // The timeout is the backstop: a surface that was already transparent, or a
  // tab in the background, never fires `transitionend`.
  function onFadeOut() {
    if (fired) return;
    fired = true;
    primary.removeEventListener('transitionend', onFadeOut);

    beforeRender();
    targets.forEach((element) => {
      element.style.transition = 'opacity 220ms ease-out';
      element.style.opacity = '1';
    });
    afterRender();

    setTimeout(() => {
      targets.forEach((element) => {
        element.style.transition = '';
        element.style.opacity = '';
      });
    }, 240);
  }

  primary.addEventListener('transitionend', onFadeOut);
  setTimeout(onFadeOut, 220);
}
