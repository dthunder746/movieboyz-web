import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SORT,
  buildMovieRows,
  cardCompare,
  latestWeekColumn,
  missingLastSorter,
  parseSortId,
  sortIdFromSorters,
  sortRowsByField,
  sorterField,
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
      rating_letterboxd: 78,
    });
    expect(released.gross).toEqual({ '2025-07-04': 40 * MILLION, '2025-07-05': 90 * MILLION });
  });

  // The detailed view carries a column per rating source behind one expander,
  // and Tabulator sorts on fields, so every source the table shows has to be
  // on the row. A source that has not scored the Movie is null rather than
  // absent: the column exists for every row or for none.
  it('flattens every rating source the table shows onto the row', () => {
    const [built] = buildMovieRows([{
      release_year: 2026,
      latest_date: '2026-08-20',
      movies: [{
        imdb_id: 'tt-rated',
        ratings: { letterboxd: { score: 78, votes: 90 }, imdb: { score: 66, votes: 12 } },
      }],
    }]);

    expect(built.rating_letterboxd).toBe(78);
    expect(built.rating_imdb).toBe(66);
    expect(built.rating_metacritic).toBeNull();
    expect(built.ratings.letterboxd.votes).toBe(90);
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
  return { imdbId, title: imdbId, releaseDate: null, grossTd: null, budget: null, rating_letterboxd: null, ...fields };
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
      row('mid', { releaseDate: '2026-06-05', rating_letterboxd: 60, budget: 50 * MILLION }),
      row('old', { releaseDate: '2019-04-24', rating_letterboxd: 90, budget: 356 * MILLION }),
      row('new', { releaseDate: '2027-01-01', rating_letterboxd: 30, budget: 10 * MILLION }),
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

  // The state before the table has sorted anything. A header the menu has no
  // entry for reads as `custom` instead, which the block further down covers.
  it('answers nothing before the table has sorted anything', () => {
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
    expect(tableSortSpec('rating_desc')).toEqual([{ column: 'rating_letterboxd', dir: 'desc' }]);
  });

  it('falls back to the default sort rather than leaving the table unsorted', () => {
    expect(tableSortSpec('nonsense')).toEqual(tableSortSpec(DEFAULT_SORT));
  });
});

// ── The fields the shared table columns and cards read ────────────────────
//
// `week_<key>`, `daily_<date>`, `weeks` and `thisWeek` are the names
// `shared/table-columns.js` and `shared/cards.js` document at the top of
// themselves (#162). A row that spells any of them differently loses the
// column or the sparkline that reads it, silently.

function weekSlices() {
  return [
    {
      release_year: 2026,
      latest_date: '2026-03-10',
      movies: [
        {
          imdb_id: 'tt-early',
          title: 'Early',
          release_date: '2026-02-20',
          weekly_gross: { '2026-W08': 30 * MILLION, '2026-W09': 12 * MILLION },
          daily_change: { '2026-02-20': 20 * MILLION, '2026-02-21': 10 * MILLION },
        },
        {
          imdb_id: 'tt-late',
          title: 'Late',
          release_date: '2026-03-06',
          weekly_gross: { '2026-W10': 44 * MILLION },
          daily_change: { '2026-03-06': 44 * MILLION },
        },
      ],
    },
  ];
}

describe('buildMovieRows week and day fields', () => {
  it('carries a week_<key> column for every week any Movie reported', () => {
    const rows = buildMovieRows(weekSlices());
    const early = rows.find((r) => r.imdbId === 'tt-early');
    const late = rows.find((r) => r.imdbId === 'tt-late');

    expect(early).toMatchObject({
      'week_2026-W08': 30 * MILLION,
      'week_2026-W09': 12 * MILLION,
    });
    // A week the Movie never reported is null and not zero: zero is a real
    // figure and the two would sort together.
    expect(early['week_2026-W10']).toBe(null);
    expect(late['week_2026-W08']).toBe(null);
    expect(late['week_2026-W10']).toBe(44 * MILLION);
  });

  it('carries a daily_<date> column for every day any Movie reported', () => {
    const rows = buildMovieRows(weekSlices());
    const early = rows.find((r) => r.imdbId === 'tt-early');
    const late = rows.find((r) => r.imdbId === 'tt-late');

    expect(early['daily_2026-02-20']).toBe(20 * MILLION);
    expect(early['daily_2026-03-06']).toBe(null);
    expect(late['daily_2026-03-06']).toBe(44 * MILLION);
  });

  it('carries the sparkline weeks, oldest first, for the weeks it reported', () => {
    const rows = buildMovieRows(weekSlices());
    const early = rows.find((r) => r.imdbId === 'tt-early');

    expect(early.weeks).toEqual([
      { num: 8, gross: 30 * MILLION },
      { num: 9, gross: 12 * MILLION },
    ]);
  });

  // The current week is the newest any Movie reported, not the newest this one
  // did: a Movie whose run finished has bars but nothing this week.
  it('carries this week from the newest week on the page, or null', () => {
    const rows = buildMovieRows(weekSlices());

    expect(rows.find((r) => r.imdbId === 'tt-late').thisWeek).toBe(44 * MILLION);
    expect(rows.find((r) => r.imdbId === 'tt-early').thisWeek).toBe(null);
  });

  it('leaves a page with no gross at all with no week fields and no this week', () => {
    const [row] = buildMovieRows([
      { release_year: 2027, latest_date: null, movies: [{ imdb_id: 'tt-none' }] },
    ]);

    expect(row.weeks).toEqual([]);
    expect(row.thisWeek).toBe(null);
    expect(Object.keys(row).some((key) => key.startsWith('week_'))).toBe(false);
  });
});

// ── This week's gross, and the sorts the menu cannot name ─────────────────

describe("this week's gross as a sort", () => {
  const rows = [
    { imdbId: 'quiet', thisWeek: 1 * MILLION },
    { imdbId: 'none', thisWeek: null },
    { imdbId: 'loud', thisWeek: 40 * MILLION },
  ];

  it('sorts by what each Movie took this week, highest first', () => {
    expect(sortMovieRows(rows, 'week_desc').map((r) => r.imdbId))
      .toEqual(['loud', 'quiet', 'none']);
  });

  // The column the figure is in is named for the week, so the table is sorted
  // on that rather than on `thisWeek`, which no column carries.
  it('reads as the latest week column when the table is asked', () => {
    expect(tableSortSpec('week_desc', 'week_2026-W10'))
      .toEqual([{ column: 'week_2026-W10', dir: 'desc' }]);
  });

  it('falls back to the default when the page has no week columns yet', () => {
    expect(tableSortSpec('week_desc', null)).toEqual(tableSortSpec(DEFAULT_SORT));
  });

  it('reads a click on the latest week column back as the menu entry', () => {
    expect(sortIdFromSorters([{ field: 'week_2026-W10', dir: 'desc' }], 'week_2026-W10'))
      .toBe('week_desc');
  });
});

// A click on any other week or on a day column is a real sort the table is
// honouring; the menu has no entry for it and says so rather than going on
// claiming the last entry the reader picked.
describe('a sort the menu has no entry for', () => {
  it('reads as custom', () => {
    expect(sortIdFromSorters([{ field: 'week_2026-W03', dir: 'desc' }], 'week_2026-W10'))
      .toBe('custom');
    expect(sortIdFromSorters([{ field: 'daily_2026-03-06', dir: 'asc' }], 'week_2026-W10'))
      .toBe('custom');
    expect(sortIdFromSorters([{ field: 'season', dir: 'desc' }])).toBe('custom');
  });

  // Nothing sorted at all is not a custom sort, and answering with one would
  // wipe the label before the reader has touched a header.
  it('is not what an unsorted table reads as', () => {
    expect(sortIdFromSorters([])).toBe(null);
    expect(sortIdFromSorters(undefined)).toBe(null);
  });

  // The rows still have to be in some order for the cards and for the chart's
  // default plot, and the page's own default is the one to fall back on.
  it('leaves the rows in the default order', () => {
    const unsorted = [
      { imdbId: 'small', grossTd: 10 * MILLION },
      { imdbId: 'big', grossTd: 900 * MILLION },
    ];

    expect(sortMovieRows(unsorted, 'custom').map((r) => r.imdbId))
      .toEqual(sortMovieRows(unsorted, DEFAULT_SORT).map((r) => r.imdbId));
  });
});

describe('latestWeekColumn', () => {
  it('names the column the newest week landed in', () => {
    expect(latestWeekColumn(buildMovieRows(weekSlices()))).toBe('week_2026-W10');
  });

  it('answers nothing when nothing has reported a week', () => {
    expect(latestWeekColumn([{ weeklyGross: {} }])).toBe(null);
  });
});

// The cards sort themselves rather than being handed a sorted list, because a
// filter change re-narrows them without a re-sort. Same rule as the table's,
// against the row field the sort names.
describe('cardCompare', () => {
  const rows = () => [
    { imdbId: 'quiet', grossTd: 1 * MILLION, thisWeek: null },
    { imdbId: 'loud', grossTd: 900 * MILLION, thisWeek: 4 * MILLION },
  ];

  it('orders on the field it is given', () => {
    expect(rows().sort(cardCompare('grossTd', 'asc')).map((r) => r.imdbId))
      .toEqual(['quiet', 'loud']);
    expect(rows().sort(cardCompare('thisWeek', 'desc')).map((r) => r.imdbId))
      .toEqual(['loud', 'quiet']);
  });

  // A card view under a sort the page cannot name still has to be in some
  // order, and the page's own default is the one to fall back on.
  it('falls back to the default order for a field it does not know', () => {
    expect(rows().sort(cardCompare('nonsense', 'asc')).map((r) => r.imdbId))
      .toEqual(['loud', 'quiet']);
  });
});

// A header click on a week or a day column is an order the menu cannot name,
// but the rows still have to be put in it: the chart's default plot is the top
// of the table, so an order the rows do not share would plot five Movies that
// are not the five at the top.
describe('a custom order', () => {
  const rows = () => [
    { imdbId: 'mid', 'week_2026-W03': 5 * MILLION },
    { imdbId: 'none' },
    { imdbId: 'top', 'week_2026-W03': 50 * MILLION },
  ];

  it('reads the field and the direction off a Tabulator sorter', () => {
    expect(sorterField([{ field: 'week_2026-W03', dir: 'asc' }]))
      .toEqual({ field: 'week_2026-W03', direction: 'asc' });
    expect(sorterField([{ column: { getField: () => 'daily_2026-03-06' }, dir: 'desc' }]))
      .toEqual({ field: 'daily_2026-03-06', direction: 'desc' });
    expect(sorterField([])).toBe(null);
  });

  it('sorts the rows by that field, missing last', () => {
    expect(sortRowsByField(rows(), 'week_2026-W03', 'desc').map((r) => r.imdbId))
      .toEqual(['top', 'mid', 'none']);
    expect(sortRowsByField(rows(), 'week_2026-W03', 'asc').map((r) => r.imdbId))
      .toEqual(['mid', 'top', 'none']);
  });

  it('leaves the list it was given alone', () => {
    const given = rows();

    sortRowsByField(given, 'week_2026-W03', 'desc');

    expect(given.map((r) => r.imdbId)).toEqual(['mid', 'none', 'top']);
  });

  // The cards are in the same order as the table they were switched from, so
  // the comparator has to take a week or a day column too.
  it('orders the cards by a week or a day column as well', () => {
    expect(rows().sort(cardCompare('week_2026-W03', 'desc')).map((r) => r.imdbId))
      .toEqual(['top', 'mid', 'none']);
  });
});
