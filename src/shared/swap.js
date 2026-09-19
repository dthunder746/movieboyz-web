// The skeleton that stands in while a view is swapped.
//
// Reserve the surface's height and fade a skeleton over it during the swap.
// Tabulator renders asynchronously, so without this the page collapses to
// nothing for a frame and takes the reader's scroll position with it.
//
// Page-agnostic: what is being swapped in is the caller's business, and the
// caller decides when the new view is ready by calling the function handed
// back (#160).

// How long the skeleton stays up during a view swap. Below this the overlay
// reads as a flicker rather than a transition.
export const SWAP_MIN_MS = 220;

// How long the overlay's fade out runs, matching the CSS transition on it.
const FADE_OUT_MS = 200;

// The overlay itself, so both pages carry the same markup rather than a copy
// each. It belongs inside the swapped surface.
export const RENDER_OVERLAY_MARKUP = '<div id="render-overlay" class="d-none" aria-hidden="true"><div class="skeleton-fill"></div></div>';

export function beginSwap(isSwitch) {
  // `table-surface` and `render-overlay` are part of the markup contract both
  // pages carry: the element whose height is held while the views change, and
  // the skeleton inside it.
  const surface = document.getElementById('table-surface');
  const overlay = document.getElementById('render-overlay');
  const scrollY = window.scrollY;

  if (isSwitch && surface) {
    const height = surface.offsetHeight;
    if (height) surface.style.minHeight = `${height}px`;
    if (overlay) {
      overlay.classList.remove('d-none');
      void overlay.offsetWidth; // reflow, so the opacity transition runs
      overlay.classList.add('is-visible');
    }
  }

  const shownAt = performance.now();
  let done = false;

  return function finish() {
    if (done) return;
    const elapsed = performance.now() - shownAt;
    if (isSwitch && elapsed < SWAP_MIN_MS) {
      setTimeout(finish, SWAP_MIN_MS - elapsed);
      return;
    }
    done = true;
    if (surface) surface.style.minHeight = '';
    if (isSwitch) window.scrollTo(0, scrollY);
    if (overlay) {
      overlay.classList.remove('is-visible');
      setTimeout(() => overlay.classList.add('d-none'), FADE_OUT_MS);
    }
  };
}
