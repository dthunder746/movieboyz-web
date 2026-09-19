import { afterEach, describe, expect, it, vi } from 'vitest';

import { RENDER_OVERLAY_MARKUP, SWAP_MIN_MS, beginSwap } from './swap.js';

// The suite runs without a DOM, so the surface and the overlay are stood up as
// the handful of members the swap touches.

function element() {
  const classes = new Set(['d-none']);
  return {
    offsetWidth: 0,
    offsetHeight: 400,
    style: {},
    classes,
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
    },
  };
}

function stage() {
  const surface = element();
  const overlay = element();
  const parts = { 'table-surface': surface, 'render-overlay': overlay };
  vi.stubGlobal('document', { getElementById: (id) => parts[id] ?? null });
  vi.stubGlobal('window', { scrollY: 640, scrollTo: vi.fn() });
  return { surface, overlay };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('beginSwap', () => {
  it('holds the surface open and shows the skeleton on a switch', () => {
    vi.useFakeTimers();
    const { surface, overlay } = stage();

    beginSwap(true);

    expect(surface.style.minHeight).toBe('400px');
    expect(overlay.classes.has('d-none')).toBe(false);
    expect(overlay.classes.has('is-visible')).toBe(true);
  });

  it('leaves the surface and the skeleton alone on a first render', () => {
    vi.useFakeTimers();
    const { surface, overlay } = stage();

    beginSwap(false)();

    expect(surface.style.minHeight).toBe('');
    expect(overlay.classes.has('is-visible')).toBe(false);
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it('keeps the skeleton up for the minimum, however fast the new view is', () => {
    vi.useFakeTimers();
    const { surface, overlay } = stage();

    const finish = beginSwap(true);
    vi.advanceTimersByTime(20);
    finish();

    // Too soon: the swap would read as a flicker, so nothing has moved yet.
    expect(overlay.classes.has('is-visible')).toBe(true);
    expect(surface.style.minHeight).toBe('400px');

    vi.advanceTimersByTime(SWAP_MIN_MS - 20);

    expect(overlay.classes.has('is-visible')).toBe(false);
    expect(surface.style.minHeight).toBe('');
    expect(window.scrollTo).toHaveBeenCalledWith(0, 640);

    // And then the fade out finishes and the overlay is out of the way.
    vi.advanceTimersByTime(200);
    expect(overlay.classes.has('d-none')).toBe(true);
  });

  it('finishes straight away once the minimum has already passed', () => {
    vi.useFakeTimers();
    const { surface } = stage();

    const finish = beginSwap(true);
    vi.advanceTimersByTime(SWAP_MIN_MS + 5);
    finish();

    expect(surface.style.minHeight).toBe('');
  });

  it('finishes once however many times it is called', () => {
    vi.useFakeTimers();
    const { surface } = stage();

    const finish = beginSwap(true);
    vi.advanceTimersByTime(SWAP_MIN_MS);
    finish();
    surface.style.minHeight = 'touched again';
    finish();

    expect(surface.style.minHeight).toBe('touched again');
  });

  it('carries the overlay markup the pages render', () => {
    expect(RENDER_OVERLAY_MARKUP).toContain('id="render-overlay"');
    expect(RENDER_OVERLAY_MARKUP).toContain('class="d-none"');
    expect(RENDER_OVERLAY_MARKUP).toContain('skeleton-fill');
  });
});
