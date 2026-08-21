import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadManifest } from './artifacts.js';
import { heldNetwork } from './held-network.js';

const MANIFEST = {
  default_view: { league_slug: 'movieboyz', year: 2026 },
  movie_years: [2025, 2026],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadManifest', () => {
  it('reads index.json', async () => {
    const net = heldNetwork();

    const pending = loadManifest();
    await net.settle();
    net.respond('index.json', MANIFEST);

    expect(await pending).toEqual(MANIFEST);
  });
});
