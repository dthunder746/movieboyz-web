import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { heldNetwork } from './testing/held-network.js';

// The module holds the page load's one manifest promise, so each test needs a
// fresh copy of it rather than the one the test before left behind. That is the
// behaviour under test here, not an accident of the harness.
let artifacts;

beforeEach(async () => {
  vi.resetModules();
  artifacts = await import('./artifacts.js');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadManifest', () => {
  // What the manifest carries is the caller's business, not this seam's: the
  // fetch is done when a response body comes back as an object.
  it('reads index.json', async () => {
    const net = heldNetwork();

    const pending = artifacts.loadManifest();
    await net.settle();
    net.respond('index.json', { movie_years: [2026] });

    expect(await pending).toEqual({ movie_years: [2026] });
  });

  // One load, one request. Several parts of a page ask for the manifest at
  // different moments and the navigation asks earliest of all (#165), so the
  // early mount has to cost nothing.
  it('asks the network once however many callers ask', async () => {
    const net = heldNetwork();

    const first = artifacts.loadManifest();
    const second = artifacts.loadManifest();
    await net.settle();
    net.respond('index.json', { movie_years: [2026] });

    expect(net.requested).toEqual(['index.json']);
    expect(await first).toEqual({ movie_years: [2026] });
    expect(await second).toEqual({ movie_years: [2026] });
  });

  // A caller arriving after the answer has landed is handed the answer, still
  // without a second request.
  it('hands a late caller the answer already in hand', async () => {
    const net = heldNetwork();

    const first = artifacts.loadManifest();
    await net.settle();
    net.respond('index.json', { movie_years: [2026] });
    await first;

    expect(await artifacts.loadManifest()).toEqual({ movie_years: [2026] });
    expect(net.requested).toEqual(['index.json']);
  });

  // A failure is not the page's answer forever. The failed promise is dropped,
  // so the next ask is a real request rather than the old rejection replayed.
  it('does not keep a failure', async () => {
    const net = heldNetwork();

    const first = artifacts.loadManifest();
    await net.settle();
    net.missing('index.json');
    await expect(first).rejects.toThrow('index.json: 404');

    const second = artifacts.loadManifest();
    await net.settle();
    net.respond('index.json', { movie_years: [2026] });

    expect(await second).toEqual({ movie_years: [2026] });
    expect(net.requested).toEqual(['index.json', 'index.json']);
  });
});
