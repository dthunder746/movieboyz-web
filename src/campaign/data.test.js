import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadCampaign, loadManifest } from './data.js';

// A network whose responses are held open until the test releases them, so the
// order of events is the thing under test rather than a race. `requested` is
// the artifact path with the cache buster stripped back off.
function heldNetwork() {
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

const MANIFEST = {
  default_view: { league_slug: 'movieboyz', year: 2026 },
  movie_years: [2025, 2026],
};

const CAMPAIGN = {
  league_slug: 'movieboyz',
  year: 2026,
  movies: [
    { imdb_id: 'tt1', release_date: '2026-03-01' },
    { imdb_id: 'tt2', release_date: '2025-11-01' },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadCampaign', () => {
  // The point of the change (#53). A Campaign page's URL already names the
  // league and the year, so neither the Campaign file nor its own Movie slice
  // has anything to learn from the manifest before it can be asked for. Three
  // round trips in a row is the whole of the load cost; overlapping them is
  // the entire win.
  it('asks for the manifest, the Campaign and the year slice at once', async () => {
    const net = heldNetwork();

    loadCampaign({ leagueSlug: 'movieboyz', year: 2026 });
    await net.settle();

    expect(net.requested).toEqual([
      'index.json',
      'leagues/movieboyz/2026.json',
      'movies/2026.json',
    ]);
  });

  it('resolves with the manifest, the Campaign and the slices', async () => {
    const net = heldNetwork();

    const pending = loadCampaign({ leagueSlug: 'movieboyz', year: 2026 });
    await net.settle();
    net.respond('index.json', MANIFEST);
    net.respond('leagues/movieboyz/2026.json', CAMPAIGN);
    net.respond('movies/2026.json', { year: 2026, movies: [] });
    await net.settle();
    net.respond('movies/2025.json', { year: 2025, movies: [] });

    const { manifest, campaign, slices } = await pending;
    expect(manifest).toEqual(MANIFEST);
    expect(campaign).toEqual(CAMPAIGN);
    expect(slices.map((slice) => slice.year)).toEqual([2025, 2026]);
  });

  // The speculative request covers the Campaign's own year only. A Pick held
  // from an earlier year is the rare case, and it cannot be known before the
  // Campaign file lands, so it stays a follow-on request.
  it('fetches a cross-year slice once the Campaign names it', async () => {
    const net = heldNetwork();

    const pending = loadCampaign({ leagueSlug: 'movieboyz', year: 2026 });
    await net.settle();
    net.respond('index.json', MANIFEST);
    net.respond('leagues/movieboyz/2026.json', CAMPAIGN);
    net.respond('movies/2026.json', { year: 2026, movies: [] });
    await net.settle();

    expect(net.requested).toContain('movies/2025.json');
    net.respond('movies/2025.json', { year: 2025, movies: [] });
    await pending;
  });

  // A slice asked for before the manifest could confirm it exists is a
  // speculative request by definition. It costs one round trip and nothing
  // else: the Board already renders with the measurement columns empty.
  it('survives a speculative slice that does not exist', async () => {
    const net = heldNetwork();

    const pending = loadCampaign({ leagueSlug: 'movieboyz', year: 2026 });
    await net.settle();
    net.respond('index.json', { ...MANIFEST, movie_years: [2025] });
    net.respond('leagues/movieboyz/2026.json', CAMPAIGN);
    net.missing('movies/2026.json');
    await net.settle();
    net.respond('movies/2025.json', { year: 2025, movies: [] });

    const { slices } = await pending;
    expect(slices.map((slice) => slice.year)).toEqual([2025]);
  });

  // The root redirect is the one caller that genuinely does not know which
  // Campaign it wants, so it still pays for the manifest first. Guessing a
  // Campaign path there would be a wrong request, not a speculative one.
  it('waits for the manifest when the caller names no Campaign', async () => {
    const net = heldNetwork();

    loadCampaign();
    await net.settle();

    expect(net.requested).toEqual(['index.json']);

    net.respond('index.json', MANIFEST);
    await net.settle();

    expect(net.requested).toContain('leagues/movieboyz/2026.json');
  });

  it('fails when the Campaign artifact is missing', async () => {
    const net = heldNetwork();

    const pending = loadCampaign({ leagueSlug: 'movieboyz', year: 2026 });
    await net.settle();
    net.respond('index.json', MANIFEST);
    net.missing('leagues/movieboyz/2026.json');

    await expect(pending).rejects.toThrow('leagues/movieboyz/2026.json: 404');
  });
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
