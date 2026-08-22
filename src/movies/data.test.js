import { afterEach, describe, expect, it, vi } from 'vitest';

import { heldNetwork } from '../shared/testing/held-network.js';

import { loadMovies } from './data.js';

const MANIFEST = { movie_years: [2025, 2026] };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadMovies', () => {
  // The page cannot name a slice until the Manifest has told it which years are
  // published, so the Manifest is the one request it has to wait on. Everything
  // after it goes out together: eight release years read one after another is
  // eight round trips before the table can paint.
  it('asks for the Manifest, then every published slice at once', async () => {
    const net = heldNetwork();

    loadMovies();
    await net.settle();

    expect(net.requested).toEqual(['index.json']);

    net.respond('index.json', MANIFEST);
    await net.settle();

    expect(net.requested).toEqual([
      'index.json',
      'movies/2025.json',
      'movies/2026.json',
    ]);
  });

  it('resolves with the Manifest and every slice that loaded', async () => {
    const net = heldNetwork();

    const pending = loadMovies();
    await net.settle();
    net.respond('index.json', MANIFEST);
    await net.settle();
    net.respond('movies/2025.json', { release_year: 2025, movies: [] });
    net.respond('movies/2026.json', { release_year: 2026, movies: [] });

    const { manifest, slices, missingYears } = await pending;
    expect(manifest).toEqual(MANIFEST);
    expect(slices.map((slice) => slice.release_year)).toEqual([2025, 2026]);
    expect(missingYears).toEqual([]);
  });

  // A year the Manifest publishes whose slice has not landed yet. The page says
  // that year is missing rather than breaking on it (#62).
  it('names the years whose slice did not load', async () => {
    const net = heldNetwork();

    const pending = loadMovies();
    await net.settle();
    net.respond('index.json', MANIFEST);
    await net.settle();
    net.missing('movies/2025.json');
    net.respond('movies/2026.json', { release_year: 2026, movies: [] });

    const { slices, missingYears } = await pending;
    expect(slices.map((slice) => slice.release_year)).toEqual([2026]);
    expect(missingYears).toEqual([2025]);
  });
});
