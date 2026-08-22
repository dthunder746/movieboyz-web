import { describe, expect, it, vi } from 'vitest';

import { createMovieFilters, publishedYears } from './filters.js';

function rows() {
  return [
    { imdbId: 'tt-end', title: 'Avengers: Endgame', releaseYear: 2019, season: 'SUMMER' },
    { imdbId: 'tt-mas', title: 'Masters of the Universe', releaseYear: 2026, season: 'SUMMER' },
    { imdbId: 'tt-mar', title: 'Marty Supreme', releaseYear: 2026, season: 'WINTER' },
    { imdbId: 'tt-none', title: null, releaseYear: 2024, season: null },
  ];
}

describe('createMovieFilters', () => {
  it('narrows the list to titles containing the search, whatever the case', () => {
    const filters = createMovieFilters();

    filters.setSearch('mar');

    expect(filters.filter(rows()).map((row) => row.imdbId)).toEqual(['tt-mar']);
  });

  // The deploy window (#60). A Movie from a slice written before the identity
  // fields has no title to match, so a search hides it rather than leaving it
  // among the hits with nothing to say for itself.
  it('hides a Movie with no title once a search is on', () => {
    const filters = createMovieFilters();

    expect(filters.filter(rows()).map((row) => row.imdbId)).toContain('tt-none');

    filters.setSearch('e');

    expect(filters.filter(rows()).map((row) => row.imdbId)).not.toContain('tt-none');
  });

  it('narrows the list to the chosen release years', () => {
    const filters = createMovieFilters();

    filters.setYears([2026]);

    expect(filters.filter(rows()).map((row) => row.imdbId)).toEqual(['tt-mas', 'tt-mar']);
  });

  it('offers several years at once', () => {
    const filters = createMovieFilters();

    filters.toggleYear(2019);
    filters.toggleYear(2024);

    expect(filters.filter(rows()).map((row) => row.imdbId)).toEqual(['tt-end', 'tt-none']);
  });

  // Toggling the last year back off is "no opinion", which is the same view as
  // every year being allowed rather than an empty list.
  it('goes back to every year when the last chip is toggled off', () => {
    const filters = createMovieFilters();

    filters.toggleYear(2026);
    filters.toggleYear(2026);

    expect(filters.filter(rows())).toHaveLength(4);
    expect(filters.snapshot().years).toBe(null);
  });

  it('narrows on the search and the years together', () => {
    const filters = createMovieFilters();

    filters.setSearch('ma');
    filters.setYears([2026]);

    expect(filters.filter(rows()).map((row) => row.imdbId)).toEqual(['tt-mas', 'tt-mar']);

    filters.setYears([2019]);

    expect(filters.filter(rows())).toEqual([]);
  });

  it('reports what is on, and clears back to nothing', () => {
    const onChange = vi.fn();
    const filters = createMovieFilters({ onChange });

    expect(filters.snapshot().isDefault).toBe(true);

    filters.setSearch('mar');
    filters.toggleYear(2026);

    expect(filters.snapshot())
      .toEqual({ search: 'mar', years: [2026], seasons: null, isDefault: false });
    expect(onChange).toHaveBeenCalledTimes(2);

    filters.clearAll();

    expect(filters.snapshot())
      .toEqual({ search: '', years: null, seasons: null, isDefault: true });
    expect(filters.filter(rows())).toHaveLength(4);
  });
});

describe('publishedYears', () => {
  it('reads the years off the manifest, newest first', () => {
    expect(publishedYears({ movie_years: [2019, 2025, 2026] })).toEqual([2026, 2025, 2019]);
  });
});

// Decision 2 of the parent spec: `season` is published on the Movie slice and
// the lookup page keeps a Season filter. Season is a closed set of three, so
// unlike the year chips it needs nothing from the Manifest.
describe('createMovieFilters, by Season', () => {
  it('narrows the list to the chosen Season', () => {
    const filters = createMovieFilters();

    filters.toggleSeason('WINTER');

    expect(filters.filter(rows()).map((row) => row.imdbId)).toEqual(['tt-mar']);
  });

  it('takes several Seasons at once', () => {
    const filters = createMovieFilters();

    filters.toggleSeason('WINTER');
    filters.toggleSeason('SUMMER');

    expect(filters.filter(rows()).map((row) => row.imdbId))
      .toEqual(['tt-end', 'tt-mas', 'tt-mar']);
  });

  // The deploy window again (#60): a slice written before `season` publishes
  // rows with none. They are not in any Season, so a Season filter hides them
  // rather than letting them ride along under a label they do not carry.
  it('hides a Movie with no Season once a Season is chosen', () => {
    const filters = createMovieFilters();

    expect(filters.filter(rows()).map((row) => row.imdbId)).toContain('tt-none');

    filters.toggleSeason('SUMMER');

    expect(filters.filter(rows()).map((row) => row.imdbId)).not.toContain('tt-none');
  });

  // The same rule the year chips follow: toggling the last one off is "no
  // opinion", not "no Season", so it collapses back to every Season.
  it('reads the last Season toggled off as every Season', () => {
    const filters = createMovieFilters();

    filters.toggleSeason('WINTER');
    filters.toggleSeason('WINTER');

    expect(filters.snapshot().seasons).toBe(null);
    expect(filters.filter(rows())).toHaveLength(4);
  });

  it('reports the chosen Seasons in calendar order, and clears them', () => {
    const filters = createMovieFilters();

    filters.toggleSeason('FALL');
    filters.toggleSeason('WINTER');

    expect(filters.snapshot().seasons).toEqual(['WINTER', 'FALL']);
    expect(filters.snapshot().isDefault).toBe(false);

    filters.clearSeasons();

    expect(filters.snapshot().seasons).toBe(null);
    expect(filters.snapshot().isDefault).toBe(true);
  });

  it('clears the Seasons along with everything else', () => {
    const filters = createMovieFilters();

    filters.setSearch('mar');
    filters.toggleSeason('WINTER');
    filters.clearAll();

    expect(filters.snapshot()).toEqual({ search: '', years: null, seasons: null, isDefault: true });
  });

  it('announces a Season change to the page', () => {
    const onChange = vi.fn();
    const filters = createMovieFilters({ onChange });

    filters.toggleSeason('SUMMER');

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ seasons: ['SUMMER'] }),
    );
  });
});
