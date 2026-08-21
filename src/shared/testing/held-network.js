// Test support for the artifact fetch seam. Not shipped: nothing outside a test
// file imports it, so it never reaches a bundle.
//
// A network whose responses are held open until the test releases them, so the
// order of events is the thing under test rather than a race. `requested` is
// the artifact path with the cache buster stripped back off.
//
// It sits with the plumbing rather than with either test that stubs it. The
// seam has a test on each side of it now (`../artifacts.test.js` covers the
// fetching, `../../campaign/data.test.js` covers what a Campaign asks for), and
// a copy per side would drift.

import { vi } from 'vitest';

export function heldNetwork() {
  const requested = [];
  const held = new Map();

  const fetchStub = vi.fn((url) => {
    const path = new URL(url).pathname.split('/artifacts/')[1];
    requested.push(path);
    return new Promise((resolve, reject) => {
      held.set(path, { resolve, reject });
    });
  });
  vi.stubGlobal('fetch', fetchStub);

  return {
    requested,
    // Resolve one held request with a body, as a real `fetch` would.
    respond(path, body) {
      held.get(path).resolve({ ok: true, status: 200, json: async () => body });
    },
    missing(path) {
      held
        .get(path)
        .resolve({ ok: false, status: 404, statusText: 'Not Found' });
    },
    // Let every microtask queued so far run, without releasing anything.
    settle() {
      return new Promise((resolve) => setTimeout(resolve, 0));
    },
  };
}
