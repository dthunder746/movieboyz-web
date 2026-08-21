// Test support for the artifact fetch seam, shared by the tests either side of
// it. A network whose responses are held open until the test releases them, so
// the order of events is the thing under test rather than a race. `requested`
// is the artifact path with the cache buster stripped back off.
//
// It lives beside the plumbing it stubs rather than beside either caller: both
// page groups fetch through the same seam, and a second copy of this would
// drift from the first.

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
