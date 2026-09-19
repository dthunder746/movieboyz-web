import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadManifest } from './artifacts.js';
import { heldNetwork } from './testing/held-network.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadManifest', () => {
  // What the manifest carries is the caller's business, not this seam's: the
  // fetch is done when a response body comes back as an object.
  it('reads index.json', async () => {
    const net = heldNetwork();

    const pending = loadManifest();
    await net.settle();
    net.respond('index.json', { movie_years: [2026] });

    expect(await pending).toEqual({ movie_years: [2026] });
  });

  // One load, one request. Several parts of a page ask for the manifest at
  // different moments and the navigation asks earliest of all (#165), so the
  // early mount has to cost nothing.
  it('asks the network once however many callers ask', async () => {
    const net = heldNetwork();

    const first = loadManifest();
    const second = loadManifest();
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

    const first = loadManifest();
    await net.settle();
    net.respond('index.json', { movie_years: [2026] });
    await first;

    expect(await loadManifest()).toEqual({ movie_years: [2026] });
    expect(net.requested).toEqual(['index.json']);
  });

  // A failure is not the page's answer forever. The failed promise is dropped,
  // so the next ask is a real request rather than the old rejection replayed.
  it('does not keep a failure', async () => {
    const net = heldNetwork();

    const first = loadManifest();
    await net.settle();
    net.missing('index.json');
    await expect(first).rejects.toThrow('index.json: 404');

    const second = loadManifest();
    await net.settle();
    net.respond('index.json', { movie_years: [2026] });

    expect(await second).toEqual({ movie_years: [2026] });
    expect(net.requested).toEqual(['index.json', 'index.json']);
  });
});
