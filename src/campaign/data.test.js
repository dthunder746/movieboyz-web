import { afterEach, describe, expect, it, vi } from 'vitest';

import { heldNetwork } from '../shared/testing/held-network.js';

import { loadCampaign } from './data.js';
import { CampaignUnavailable } from '../shared/campaign-unavailable.js';

const MANIFEST = {
  default_view: { league_slug: 'movieboyz', year: 2026 },
  movie_years: [2025, 2026],
};

// The same Manifest with the Campaign it lists, for telling a year that was
// never published from an artifact that should have been there.
const LISTED = {
  ...MANIFEST,
  leagues: [
    {
      slug: 'movieboyz',
      name: 'MovieBoyz',
      campaigns: [{ year: 2026, state: 'active' }],
    },
  ],
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

  // The catch-all page renders any Campaign path, including one the platform
  // has not published, so the failure has to carry enough for that page to say
  // which year is missing and still draw its navigation (#64).
  it('fails with the Campaign it could not load and the Manifest it did', async () => {
    const net = heldNetwork();

    const pending = loadCampaign({ leagueSlug: 'movieboyz', year: 2026 });
    await net.settle();
    net.respond('index.json', MANIFEST);
    net.missing('leagues/movieboyz/2026.json');

    const error = await pending.catch((thrown) => thrown);
    expect(error).toBeInstanceOf(CampaignUnavailable);
    expect(error.leagueSlug).toBe('movieboyz');
    expect(error.year).toBe(2026);
    expect(error.manifest).toEqual(MANIFEST);
    expect(error.cause.message).toContain('leagues/movieboyz/2026.json: 404');
  });

  // The Manifest lists every Campaign, so it is the thing that separates a year
  // nobody has published from an artifact that should be there and is not.
  it('says a year the Manifest does not list was never published', async () => {
    const net = heldNetwork();

    const pending = loadCampaign({ leagueSlug: 'movieboyz', year: 2028 });
    await net.settle();
    net.respond('index.json', MANIFEST);
    net.missing('leagues/movieboyz/2028.json');
    net.missing('movies/2028.json');

    const error = await pending.catch((thrown) => thrown);
    expect(error.published).toBe(false);
  });

  it('says a year the Manifest does list should have been there', async () => {
    const net = heldNetwork();

    const pending = loadCampaign({ leagueSlug: 'movieboyz', year: 2026 });
    await net.settle();
    net.respond('index.json', LISTED);
    net.missing('leagues/movieboyz/2026.json');

    const error = await pending.catch((thrown) => thrown);
    expect(error.published).toBe(true);
  });

  // The Manifest is fetched first and every other request hangs off it, so its
  // own failure cannot be reported as a missing Campaign.
  it('fails with the fetch error when the Manifest itself is missing', async () => {
    const net = heldNetwork();

    const pending = loadCampaign({ leagueSlug: 'movieboyz', year: 2026 });
    await net.settle();
    net.missing('index.json');
    net.missing('leagues/movieboyz/2026.json');
    net.missing('movies/2026.json');

    await expect(pending).rejects.toThrow('index.json: 404');
  });
});
