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
    net.respond('index.json', { default_view: { league_slug: 'movieboyz', year: 2026 } });

    expect(await pending).toEqual({
      default_view: { league_slug: 'movieboyz', year: 2026 },
    });
  });
});
