import { afterEach, describe, expect, it, vi } from 'vitest';

import { heldNetwork } from '../../shared/testing/held-network.js';

import { loadMovie } from './data.js';

const MANIFEST = {
  movie_years: [2025, 2026],
  leagues: [
    { slug: 'movieboyz', name: 'MovieBoyz', campaigns: [{ year: 2025 }, { year: 2026 }] },
  ],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadMovie', () => {
  // An imdb id says nothing about which release year's slice carries the
  // Movie, and a Pick can be from any year, so every slice and every Campaign
  // has to be looked in. What the page can avoid is asking for them one at a
  // time: after the Manifest, they all go out together (#53).
  it('asks for the Manifest, then every slice and every Campaign at once', async () => {
    const net = heldNetwork();

    loadMovie();
    await net.settle();

    expect(net.requested).toEqual(['index.json']);

    net.respond('index.json', MANIFEST);
    await net.settle();

    expect(net.requested).toEqual([
      'index.json',
      'movies/2025.json',
      'movies/2026.json',
      'leagues/movieboyz/2025.json',
      'leagues/movieboyz/2026.json',
    ]);
  });

  it('resolves with the Manifest, the slices and the Campaigns', async () => {
    const net = heldNetwork();

    const pending = loadMovie();
    await net.settle();
    net.respond('index.json', MANIFEST);
    await net.settle();
    net.respond('movies/2025.json', { release_year: 2025, movies: [] });
    net.respond('movies/2026.json', { release_year: 2026, movies: [] });
    net.respond('leagues/movieboyz/2025.json', { year: 2025 });
    net.respond('leagues/movieboyz/2026.json', { year: 2026 });

    const { manifest, slices, campaigns, missingYears } = await pending;
    expect(manifest).toEqual(MANIFEST);
    expect(slices.map((slice) => slice.release_year)).toEqual([2025, 2026]);
    expect(campaigns.map((campaign) => campaign.year)).toEqual([2025, 2026]);
    expect(missingYears).toEqual([]);
  });

  // A slice that did not land could be the one carrying the Movie, so the page
  // is told which years it never saw rather than reporting the Movie missing.
  it('names the years whose slice did not load', async () => {
    const net = heldNetwork();

    const pending = loadMovie();
    await net.settle();
    net.respond('index.json', MANIFEST);
    await net.settle();
    net.missing('movies/2025.json');
    net.respond('movies/2026.json', { release_year: 2026, movies: [] });
    net.respond('leagues/movieboyz/2025.json', { year: 2025 });
    net.respond('leagues/movieboyz/2026.json', { year: 2026 });

    const { slices, missingYears } = await pending;
    expect(slices.map((slice) => slice.release_year)).toEqual([2026]);
    expect(missingYears).toEqual([2025]);
  });

  // A Campaign that did not load costs a link back to a contest, and the Movie
  // itself is still readable, so the page renders without it.
  it('renders on without a Campaign that did not load', async () => {
    const net = heldNetwork();

    const pending = loadMovie();
    await net.settle();
    net.respond('index.json', MANIFEST);
    await net.settle();
    net.respond('movies/2025.json', { release_year: 2025, movies: [] });
    net.respond('movies/2026.json', { release_year: 2026, movies: [] });
    net.missing('leagues/movieboyz/2025.json');
    net.respond('leagues/movieboyz/2026.json', { year: 2026 });

    const { campaigns } = await pending;
    expect(campaigns.map((campaign) => campaign.year)).toEqual([2026]);
  });

  // The Movie page is League independent: a Manifest naming no League at all
  // still gets the reader the film.
  it('asks for no Campaign when the Manifest names no League', async () => {
    const net = heldNetwork();

    const pending = loadMovie();
    await net.settle();
    net.respond('index.json', { movie_years: [2026] });
    await net.settle();

    expect(net.requested).toEqual(['index.json', 'movies/2026.json']);

    net.respond('movies/2026.json', { release_year: 2026, movies: [] });
    expect((await pending).campaigns).toEqual([]);
  });
});
