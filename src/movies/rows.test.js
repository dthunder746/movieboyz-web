import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SORT,
  buildMovieRows,
  missingLastSorter,
  parseSortId,
  sortIdFromSorters,
  tableSortSpec,
  sortMovieRows,
} from './rows.js';

const MILLION = 1e6;

// Two slices, as the page holds them: every published release year at once,
// each one everybody's Movies rather than a League's.
function slices() {
  return [
    {
      release_year: 2025,
      latest_date: '2026-08-20',
      movies: [
        {
          imdb_id: 'tt2025',
          title: 'Last Year',
          release_date: '2025-07-04',
          budget: 100 * MILLION,
          estimated_budget: false,
          season: 'SUMMER',
          gross_td: 250 * MILLION,
          days_running: 412,
          gross: { '2025-07-04': 40 * MILLION, '2025-07-05': 90 * MILLION },
          weekly_gross: { '2025-W27': 90 * MILLION },
          daily_change: { '2025-07-05': 50 * MILLION },
          ratings: { letterboxd: { score: 78, votes: 12000 } },
          released_digital: '2025-09-01',
          status: 'RELEASED',
        },
      ],
    },
    {
      release_year: 2026,
      latest_date: '2026-08-20',
      movies: [
        {
          imdb_id: 'tt2026',
          title: 'This Year',
          release_date: '2026-06-05',
          budget: 200 * MILLION,
          estimated_budget: true,
          season: 'SUMMER',
          gross_td: null,
          days_running: null,
          gross: {},
          weekly_gross: {},
          daily_change: {},
          ratings: null,
          released_digital: null,
          status: 'SCHEDULED',
        },
      ],
    },
  ];
}

describe('buildMovieRows', () => {
  it('builds one row per Movie across every slice', () => {
    const rows = buildMovieRows(slices());

    expect(rows.map((row) => row.imdbId).sort()).toEqual(['tt2025', 'tt2026']);

    const released = rows.find((row) => row.imdbId === 'tt2025');
    expect(released).toMatchObject({
      title: 'Last Year',
      releaseDate: '2025-07-04',
      releaseYear: 2025,
      budget: 100 * MILLION,
      estimatedBudget: false,
      season: 'SUMMER',
      grossTd: 250 * MILLION,
      daysRunning: 412,
      status: 'RELEASED',
      ratingLetterboxd: 78,
    });
    expect(released.gross).toEqual({ '2025-07-04': 40 * MILLION, '2025-07-05': 90 * MILLION });
  });

  // The deploy window: a slice published before the identity fields existed
  // (#60) carries measurements and nothing else. The page stays legible rather
  // than dropping the Movie, and the year chips still work, because the slice
  // itself is keyed by release year.
  it('keeps a Movie from a slice written before the identity fields', () => {
    const [row] = buildMovieRows([
      {
        release_year: 2024,
        latest_date: '2026-08-20',
        movies: [{ imdb_id: 'tt-old', gross_td: 5 * MILLION, days_running: 30 }],
      },
    ]);

    expect(row).toMatchObject({
      imdbId: 'tt-old',
      title: null,
      releaseDate: null,
      releaseYear: 2024,
      budget: null,
      estimatedBudget: false,
      grossTd: 5 * MILLION,
    });
    expect(row.gross).toEqual({});
  });
});

// Sorting runs over built rows, so the fixtures below are rows rather than
// slices: only the field each sort names matters.
function row(imdbId, fields) {
  return { imdbId, title: imdbId, releaseDate: null, grossTd: null, budget: null, ratingLetterboxd: null, ...fields };
}

describe('sortMovieRows', () => {
  it('sorts by gross, highest first, with an unmeasured Movie last', () => {
    const rows = [
      row('small', { grossTd: 10 * MILLION }),
      row('none', {}),
      row('big', { grossTd: 900 * MILLION }),
    ];

    expect(sortMovieRows(rows, 'gross_desc').map((r) => r.imdbId))
      .toEqual(['big', 'small', 'none']);
  });

  it('keeps a missing figure last when the sort runs the other way', () => {
    const rows = [
      row('none', {}),
      row('big', { grossTd: 900 * MILLION }),
      row('small', { grossTd: 10 * MILLION }),
    ];

    expect(sortMovieRows(rows, 'gross_asc').map((r) => r.imdbId))
      .toEqual(['small', 'big', 'none']);
  });

  it('sorts by release date, by rating and by budget', () => {
    const rows = [
      row('mid', { releaseDate: '2026-06-05', ratingLetterboxd: 60, budget: 50 * MILLION }),
      row('old', { releaseDate: '2019-04-24', ratingLetterboxd: 90, budget: 356 * MILLION }),
      row('new', { releaseDate: '2027-01-01', ratingLetterboxd: 30, budget: 10 * MILLION }),
    ];

    expect(sortMovieRows(rows, 'release_desc').map((r) => r.imdbId)).toEqual(['new', 'mid', 'old']);
    expect(sortMovieRows(rows, 'release_asc').map((r) => r.imdbId)).toEqual(['old', 'mid', 'new']);
    expect(sortMovieRows(rows, 'rating_desc').map((r) => r.imdbId)).toEqual(['old', 'mid', 'new']);
    expect(sortMovieRows(rows, 'budget_desc').map((r) => r.imdbId)).toEqual(['old', 'mid', 'new']);
  });

  // A sort id off localStorage can outlive the menu that wrote it.
  it('falls back to gross, highest first, for an id it does not know', () => {
    // Alphabetically the other way round, so a fallback that sorted on
    // anything else would show.
    const rows = [row('a-small', { grossTd: 10 * MILLION }), row('z-big', { grossTd: 900 * MILLION })];

    expect(DEFAULT_SORT).toBe('gross_desc');
    expect(sortMovieRows(rows, 'profit_desc').map((r) => r.imdbId)).toEqual(['z-big', 'a-small']);
  });

  it('leaves the list it was given alone', () => {
    const rows = [row('small', { grossTd: 10 * MILLION }), row('big', { grossTd: 900 * MILLION })];

    sortMovieRows(rows, 'gross_desc');

    expect(rows.map((r) => r.imdbId)).toEqual(['small', 'big']);
  });
});

// The table sorts itself when a column header is clicked, so it needs the same
// rule the sort menu applies. Tabulator hands a sorter the two cell values with
// the rows already swapped for a descending sort, which is what these assert
// against: `dir` is the only thing that tells the sorter which way round it is.
describe('missingLastSorter', () => {
  const sort = (values, dir) => [...values]
    .sort((a, b) => (dir === 'asc'
      ? missingLastSorter(a, b, null, null, null, 'asc')
      : missingLastSorter(b, a, null, null, null, 'desc')));

  it('orders figures both ways', () => {
    expect(sort([3, 1, 2], 'asc')).toEqual([1, 2, 3]);
    expect(sort([3, 1, 2], 'desc')).toEqual([3, 2, 1]);
  });

  it('keeps a missing figure last in both directions', () => {
    expect(sort([3, null, 1], 'asc')).toEqual([1, 3, null]);
    expect(sort([3, null, 1], 'desc')).toEqual([3, 1, null]);
  });

  // Tabulator coerces an absent field to an empty string before it reaches the
  // sorter, so an empty string is a missing figure here rather than a value
  // that sorts ahead of every date.
  it('treats the empty string Tabulator substitutes as missing', () => {
    expect(sort(['2026-06-05', '', '2019-04-24'], 'asc'))
      .toEqual(['2019-04-24', '2026-06-05', '']);
  });

  it('orders dates as strings', () => {
    // Given in the order the answer is not, so a sorter that subtracts two
    // dates and returns NaN shows up rather than passing on the input order.
    expect(sort(['2019-04-24', '2026-06-05'], 'desc')).toEqual(['2026-06-05', '2019-04-24']);
    expect(sort(['2026-06-05', '2019-04-24'], 'asc')).toEqual(['2019-04-24', '2026-06-05']);
  });
});

// The other direction: a click on a column header, read back as the sort menu
// entry it amounts to, so the menu keeps showing what the table is sorted by
// and the chart's default is picked off the same order.
describe('sortIdFromSorters', () => {
  it('reads a Tabulator sorter as a menu id', () => {
    expect(sortIdFromSorters([{ field: 'grossTd', dir: 'desc' }])).toBe('gross_desc');
    expect(sortIdFromSorters([{ field: 'releaseDate', dir: 'asc' }])).toBe('release_asc');
  });

  // Tabulator hands the column object rather than a bare field on some events.
  it('reads the field off the column when the sorter has none', () => {
    const sorter = { column: { getField: () => 'budget' }, dir: 'asc' };

    expect(sortIdFromSorters([sorter])).toBe('budget_asc');
  });

  // A header the menu has no entry for, and the state before the table has
  // sorted anything. Neither is a menu id, and answering with one would put the
  // menu label out of step with the table.
  it('answers nothing for a column the menu does not offer', () => {
    expect(sortIdFromSorters([{ field: 'season', dir: 'desc' }])).toBe(null);
    expect(sortIdFromSorters([])).toBe(null);
    expect(sortIdFromSorters(undefined)).toBe(null);
  });

  // The two halves of one map. A column the table can sort by that the menu
  // cannot name would leave the label lying after a header click.
  it('round trips every sort the menu offers', () => {
    for (const sortId of ['gross_desc', 'rating_asc', 'release_desc', 'budget_asc']) {
      const { field, direction } = parseSortId(sortId);

      expect(sortIdFromSorters([{ field, dir: direction }])).toBe(sortId);
    }
  });
});

// The menu's half of the same agreement: the page has to hand Tabulator the
// order it picked, or a header click leaves the table sorting itself.
describe('tableSortSpec', () => {
  it('reads a menu id as a Tabulator sorter', () => {
    expect(tableSortSpec('rating_desc')).toEqual([{ column: 'ratingLetterboxd', dir: 'desc' }]);
  });

  it('falls back to the default sort rather than leaving the table unsorted', () => {
    expect(tableSortSpec('nonsense')).toEqual(tableSortSpec(DEFAULT_SORT));
  });
});
