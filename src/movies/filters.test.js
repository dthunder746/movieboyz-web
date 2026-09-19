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

    expect(filters.snapshot()).toEqual({
      search: 'mar',
      years: [2026],
      seasons: null,
      releaseFrom: '',
      releaseTo: '',
      released: 'all',
      activeCount: 2,
      isDefault: false,
    });
    expect(onChange).toHaveBeenCalledTimes(2);

    filters.clearAll();

    expect(filters.snapshot()).toEqual({
      search: '',
      years: null,
      seasons: null,
      releaseFrom: '',
      releaseTo: '',
      released: 'all',
      activeCount: 0,
      isDefault: true,
    });
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

    expect(filters.snapshot()).toEqual({
      search: '',
      years: null,
      seasons: null,
      releaseFrom: '',
      releaseTo: '',
      released: 'all',
      activeCount: 0,
      isDefault: true,
    });
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

// The three dimensions #161 adds with the Filters panel. The semantics are the
// Campaign's own, verbatim: an empty bound is open, a Movie with no announced
// date cannot be inside a range, and it counts as upcoming.
function datedRows() {
  return [
    {
      imdbId: 'tt-jan', title: 'January Film', releaseYear: 2026, season: 'WINTER', releaseDate: '2026-01-15',
    },
    {
      imdbId: 'tt-jun', title: 'June Film', releaseYear: 2026, season: 'SUMMER', releaseDate: '2026-06-20',
    },
    {
      imdbId: 'tt-dec', title: 'December Film', releaseYear: 2026, season: 'FALL', releaseDate: '2026-12-05',
    },
    {
      imdbId: 'tt-old', title: 'Old Film', releaseYear: 2025, season: 'SUMMER', releaseDate: '2025-07-01',
    },
    {
      imdbId: 'tt-tba', title: 'Untitled Sequel', releaseYear: 2026, season: null, releaseDate: 'TBA',
    },
    {
      imdbId: 'tt-nil', title: 'No Date', releaseYear: 2026, season: null, releaseDate: null,
    },
  ];
}

function ids(filters, latestDate) {
  return filters.filter(datedRows(), latestDate).map((row) => row.imdbId);
}

describe('createMovieFilters, by release date range', () => {
  it('keeps only the Movies inside both bounds', () => {
    const filters = createMovieFilters();

    filters.setReleaseRange('2026-01-01', '2026-06-30');

    expect(ids(filters)).toEqual(['tt-jan', 'tt-jun']);
  });

  it('reads a missing upper bound as open-ended', () => {
    const filters = createMovieFilters();

    filters.setReleaseRange('2026-01-01', '');

    expect(ids(filters)).toEqual(['tt-jan', 'tt-jun', 'tt-dec']);
  });

  it('reads a missing lower bound as open-ended', () => {
    const filters = createMovieFilters();

    filters.setReleaseRange('', '2026-01-31');

    expect(ids(filters)).toEqual(['tt-jan', 'tt-old']);
  });

  // A Movie with no announced date is not inside any range, whichever way the
  // bounds are set: the reader asked for a window of the calendar.
  it('drops a TBA and an absent date from any range', () => {
    const filters = createMovieFilters();

    filters.setReleaseRange('2020-01-01', '2030-01-01');

    expect(ids(filters)).not.toContain('tt-tba');
    expect(ids(filters)).not.toContain('tt-nil');
  });

  it('narrows on the range and the year chips together', () => {
    const filters = createMovieFilters();

    filters.setReleaseRange('2025-01-01', '2026-12-31');
    filters.setYears([2025]);

    expect(ids(filters)).toEqual(['tt-old']);
  });

  it('clears the range on its own', () => {
    const filters = createMovieFilters();

    filters.setReleaseRange('2026-01-01', '2026-06-30');
    filters.clearReleaseRange();

    expect(filters.snapshot().releaseFrom).toBe('');
    expect(filters.snapshot().releaseTo).toBe('');
    expect(ids(filters)).toHaveLength(6);
  });
});

describe('createMovieFilters, by released status', () => {
  it('keeps the Movies already out as of the latest box office day', () => {
    const filters = createMovieFilters();

    filters.setReleasedStatus('released');

    expect(ids(filters, '2026-06-30')).toEqual(['tt-jan', 'tt-jun', 'tt-old']);
  });

  // A Movie with no announced date has not come out, so it is upcoming rather
  // than neither.
  it('counts a TBA and an absent date as upcoming', () => {
    const filters = createMovieFilters();

    filters.setReleasedStatus('upcoming');

    expect(ids(filters, '2026-06-30')).toEqual(['tt-dec', 'tt-tba', 'tt-nil']);
  });

  // Nothing published yet means no day to measure against, so a dated Movie
  // cannot be called released or upcoming and only the undated ones answer.
  it('answers only for the undated Movies when there is no latest date', () => {
    const filters = createMovieFilters();

    filters.setReleasedStatus('released');
    expect(ids(filters, null)).toEqual([]);

    filters.setReleasedStatus('upcoming');
    expect(ids(filters, null)).toEqual(['tt-tba', 'tt-nil']);
  });

  it('ignores a status it does not offer', () => {
    const filters = createMovieFilters();

    filters.setReleasedStatus('sideways');

    expect(filters.snapshot().released).toBe('all');
  });
});

describe('createMovieFilters, counting what is on', () => {
  it('counts one per dimension, however many values it holds', () => {
    const filters = createMovieFilters();

    expect(filters.snapshot().activeCount).toBe(0);

    filters.setYears([2026, 2025]);

    expect(filters.snapshot().activeCount).toBe(1);

    filters.setSearch('film');
    filters.toggleSeason('WINTER');
    filters.toggleSeason('SUMMER');
    filters.setReleasedStatus('released');

    expect(filters.snapshot().activeCount).toBe(4);
  });

  // A range is one narrowing whether the reader set one end or both.
  it('counts a range with a single bound once', () => {
    const filters = createMovieFilters();

    filters.setReleaseRange('2026-01-01', '');

    expect(filters.snapshot().activeCount).toBe(1);

    filters.setReleaseRange('2026-01-01', '2026-06-30');

    expect(filters.snapshot().activeCount).toBe(1);
  });
});

describe('createMovieFilters, clearing one dimension', () => {
  function everythingOn() {
    const filters = createMovieFilters();
    filters.setSearch('film');
    filters.setYears([2026]);
    filters.toggleSeason('WINTER');
    filters.setReleaseRange('2026-01-01', '2026-06-30');
    filters.setReleasedStatus('released');
    return filters;
  }

  it('clears the dimension a chip names and leaves the rest', () => {
    const cleared = {
      search: 'search',
      years: 'years',
      seasons: 'seasons',
      releaseRange: 'releaseRange',
      released: 'released',
    };

    const filters = everythingOn();
    expect(filters.snapshot().activeCount).toBe(5);

    filters.clearDimension(cleared.search);
    expect(filters.snapshot().search).toBe('');
    expect(filters.snapshot().activeCount).toBe(4);

    filters.clearDimension(cleared.years);
    expect(filters.snapshot().years).toBe(null);

    filters.clearDimension(cleared.seasons);
    expect(filters.snapshot().seasons).toBe(null);

    filters.clearDimension(cleared.releaseRange);
    expect(filters.snapshot().releaseFrom).toBe('');
    expect(filters.snapshot().releaseTo).toBe('');

    filters.clearDimension(cleared.released);
    expect(filters.snapshot().released).toBe('all');
    expect(filters.snapshot().isDefault).toBe(true);
  });

  it('does nothing for a name it does not hold', () => {
    const filters = everythingOn();
    const before = filters.snapshot();

    filters.clearDimension('profitability');

    expect(filters.snapshot()).toEqual(before);
  });

  it('clears the new dimensions along with everything else', () => {
    const filters = everythingOn();

    filters.clearAll();

    expect(filters.snapshot()).toEqual({
      search: '',
      years: null,
      seasons: null,
      releaseFrom: '',
      releaseTo: '',
      released: 'all',
      activeCount: 0,
      isDefault: true,
    });
  });
});
