import { describe, expect, it } from 'vitest';

import { buildBoard } from './board.js';
import {
  cardRows,
  collectDailyDates,
  collectWeekKeys,
  compactRows,
  compareCards,
  detailedRows,
  groupDatesByWeek,
  hasNegativeDaily,
  roiMeter,
  weekAxisIndexes,
  weekDeltas,
} from './table-rows.js';

// Three Movies across two ISO weeks: one in profit with a full run of
// measurements, one in the red, and one that has not opened.
function campaign(overrides = {}) {
  return {
    year: 2026,
    latest_date: '2026-03-10',
    latest_profit_date: '2026-03-10',
    roster: [{ user_id: 'marcus', username: 'Marcus' }],
    movies: [
      {
        imdb_id: 'tt1',
        title: 'In Profit',
        release_date: '2026-03-02',
        season: 'WINTER',
        budget: 500,
        breakeven: 1000,
        user_id: 'marcus',
        pick_type: 'hit',
        draft_pick: 1,
        profit: {},
        profit_td: 400,
      },
      {
        imdb_id: 'tt2',
        title: 'In The Red',
        release_date: '2026-03-03',
        season: 'WINTER',
        budget: 1000,
        breakeven: 2000,
        user_id: null,
        pick_type: null,
        draft_pick: null,
        profit: {},
        profit_td: -600,
      },
      {
        imdb_id: 'tt3',
        title: 'Still To Come',
        release_date: '2026-06-01',
        season: 'SUMMER',
        budget: null,
        breakeven: null,
        user_id: 'marcus',
        pick_type: 'seasonal',
        draft_pick: 2,
        profit: {},
        profit_td: null,
      },
    ],
    ...overrides,
  };
}

function slice(overrides = {}) {
  return {
    release_year: 2026,
    latest_date: '2026-03-10',
    movies: [
      {
        imdb_id: 'tt1',
        gross_td: 1400,
        days_running: 9,
        daily_change: { '2026-03-02': 100, '2026-03-03': 200, '2026-03-09': 50 },
        weekly_gross: { '2026-W10': 300, '2026-W11': 50 },
        ratings: {
          letterboxd: { score: 80, votes: 12 },
          imdb: { score: 70, votes: 40 },
        },
        released_digital: null,
        status: null,
      },
      {
        imdb_id: 'tt2',
        gross_td: 800,
        days_running: 8,
        daily_change: { '2026-03-03': 400, '2026-03-10': 200 },
        weekly_gross: { '2026-W10': 400, '2026-W11': 200 },
        ratings: null,
        released_digital: null,
        status: null,
      },
      {
        imdb_id: 'tt3',
        gross_td: null,
        days_running: null,
        daily_change: {},
        weekly_gross: {},
        ratings: null,
        released_digital: null,
        status: null,
      },
    ],
    ...overrides,
  };
}

function board(artifact = campaign(), slices = [slice()]) {
  return buildBoard(artifact, slices);
}

function rowFor(rows, title) {
  return rows.find((row) => row.title === title);
}

describe('collectWeekKeys and collectDailyDates', () => {
  it('gathers every week any Movie reports, oldest first', () => {
    expect(collectWeekKeys(board().rows)).toEqual(['2026-W10', '2026-W11']);
  });

  it('gathers every day any Movie reports, oldest first', () => {
    expect(collectDailyDates(board().rows)).toEqual([
      '2026-03-02', '2026-03-03', '2026-03-09', '2026-03-10',
    ]);
  });

  it('is empty before anything has been captured', () => {
    expect(collectWeekKeys([])).toEqual([]);
    expect(collectDailyDates([])).toEqual([]);
  });
});

describe('groupDatesByWeek', () => {
  it('files each day under its ISO week', () => {
    expect(groupDatesByWeek(['2026-03-02', '2026-03-03', '2026-03-09'])).toEqual({
      '2026-W10': ['2026-03-02', '2026-03-03'],
      '2026-W11': ['2026-03-09'],
    });
  });
});

describe('hasNegativeDaily', () => {
  it('spots a revised-down day, which the page footnotes', () => {
    // A negative day is the source revising an earlier over-report, not money
    // handed back. The table flags it so the column does not read as a loss.
    expect(hasNegativeDaily(board().rows)).toBe(false);

    const revised = slice({
      movies: slice().movies.map((movie) => (
        movie.imdb_id === 'tt1'
          ? { ...movie, daily_change: { ...movie.daily_change, '2026-03-09': -20 } }
          : movie
      )),
    });
    expect(hasNegativeDaily(board(campaign(), [revised]).rows)).toBe(true);
  });
});

describe('detailedRows', () => {
  it('flattens each day and week into its own field', () => {
    const row = rowFor(detailedRows(board()), 'In Profit');
    expect(row['daily_2026-03-02']).toBe(100);
    expect(row['daily_2026-03-09']).toBe(50);
    expect(row['week_2026-W10']).toBe(300);
    expect(row['week_2026-W11']).toBe(50);
  });

  it('leaves a day the Movie never reported null rather than zero', () => {
    // Zero is a day that took nothing; null is a day with no figure at all.
    // Collapsing the two would make an unreported day sort as a real zero.
    const row = rowFor(detailedRows(board()), 'In Profit');
    expect(row['daily_2026-03-10']).toBeNull();
  });

  it('gives every Movie the same fields, so the columns line up', () => {
    const rows = detailedRows(board());
    const fields = rows.map((row) => Object.keys(row).sort().join(','));
    expect(new Set(fields).size).toBe(1);
  });

  it('flattens the rating sources it has columns for', () => {
    const row = rowFor(detailedRows(board()), 'In Profit');
    expect(row.rating_letterboxd).toBe(80);
    expect(row.rating_imdb).toBe(70);
    expect(row.rating_tmdb).toBeNull();
  });

  it('keeps the raw ratings for the vote-count tooltips', () => {
    expect(rowFor(detailedRows(board()), 'In Profit').ratings.letterboxd.votes).toBe(12);
  });

  it('leaves every rating null for a Movie nobody has rated', () => {
    const row = rowFor(detailedRows(board()), 'In The Red');
    expect(row.rating_letterboxd).toBeNull();
    expect(row.ratings).toBeNull();
  });

  it('carries the figures the financial columns read', () => {
    expect(rowFor(detailedRows(board()), 'In Profit')).toMatchObject({
      imdbId: 'tt1',
      title: 'In Profit',
      userId: 'marcus',
      pickType: 'hit',
      season: 'WINTER',
      releaseDate: '2026-03-02',
      daysRunning: 9,
      breakeven: 1000,
      grossTd: 1400,
      profitTd: 400,
      roi: 40,
    });
  });

  it('shows an undated Movie as TBA, which is what the column sorts on', () => {
    const artifact = campaign();
    artifact.movies[2].release_date = null;
    expect(rowFor(detailedRows(board(artifact)), 'Still To Come').releaseDate).toBe('TBA');
  });
});

describe('compactRows', () => {
  it('carries the weeks but not the days', () => {
    const row = rowFor(compactRows(board()), 'In Profit');
    expect(row['week_2026-W11']).toBe(50);
    expect(row['daily_2026-03-02']).toBeUndefined();
  });

  it('carries the same financial figures the detailed view reads', () => {
    expect(rowFor(compactRows(board()), 'In The Red')).toMatchObject({
      breakeven: 2000,
      profitTd: -600,
      roi: -30,
    });
  });
});

describe('cardRows', () => {
  it('names the current week, the one before it and the one before that', () => {
    // These read off the Board's own weeks, not the Movie's, so two Movies at
    // different points in their runs still compare like for like.
    const row = rowFor(cardRows(board()), 'In Profit');
    expect(row.thisWeek).toBe(50);
    expect(row.lastWeek).toBe(300);
    expect(row.weekBefore).toBeNull();
  });

  it('builds the Movie’s own weekly series, oldest first', () => {
    expect(rowFor(cardRows(board()), 'In Profit').weeks).toEqual([
      { num: 10, gross: 300 },
      { num: 11, gross: 50 },
    ]);
  });

  it('gives a Movie with nothing captured an empty series', () => {
    const row = rowFor(cardRows(board()), 'Still To Come');
    expect(row.weeks).toEqual([]);
    expect(row.thisWeek).toBeNull();
  });

  it('ranks by profit across the whole Board, not the filtered view', () => {
    const rows = cardRows(board());
    expect(rowFor(rows, 'In Profit').rank).toBe(1);
    expect(rowFor(rows, 'In The Red').rank).toBe(2);
    expect(rowFor(rows, 'In Profit').rankTotal).toBe(2);
  });

  it('gives a Movie with no published profit no rank at all', () => {
    // A rank of last would read as a result. It has not been measured.
    expect(rowFor(cardRows(board()), 'Still To Come').rank).toBeNull();
  });

  it('carries the Letterboxd score the card chip shows', () => {
    expect(rowFor(cardRows(board()), 'In Profit').ratingLetterboxd).toBe(80);
    expect(rowFor(cardRows(board()), 'In The Red').ratingLetterboxd).toBeNull();
  });
});

describe('compareCards', () => {
  const weeks = ['2026-W10', '2026-W11'];

  function sorted(field, dir) {
    return cardRows(board()).sort(compareCards(field, dir, weeks)).map((row) => row.title);
  }

  it('defaults to the newest week’s gross, biggest first', () => {
    // The old table passed Tabulator a multi-column sort whose LAST entry is
    // the primary key, so the newest week leads and release date is the
    // weakest tiebreak. The cards mirror it so switching view keeps the order.
    expect(sorted('default')).toEqual(['In The Red', 'In Profit', 'Still To Come']);
  });

  it('lets the newest week outrank a bigger showing in an older one', () => {
    // The direction the weeks are walked in is the whole rule. In Profit took
    // more in W10, In The Red took more in W11, and the newest week is what
    // decides: this is a table about how the Movies are doing now.
    const crossed = slice({
      movies: slice().movies.map((movie) => (
        movie.imdb_id === 'tt1'
          ? { ...movie, weekly_gross: { '2026-W10': 500, '2026-W11': 50 } }
          : movie
      )),
    });
    const rows = cardRows(board(campaign(), [crossed])).sort(compareCards('default', 'asc', weeks));
    expect(rows.map((row) => row.title)).toEqual(['In The Red', 'In Profit', 'Still To Come']);
  });

  it('falls through to earlier weeks when the newest ties', () => {
    const tied = slice({
      movies: slice().movies.map((movie) => (
        movie.imdb_id === 'tt2'
          ? { ...movie, weekly_gross: { '2026-W10': 400, '2026-W11': 50 } }
          : movie
      )),
    });
    const rows = cardRows(board(campaign(), [tied])).sort(compareCards('default', 'asc', weeks));
    expect(rows.map((row) => row.title)).toEqual(['In The Red', 'In Profit', 'Still To Come']);
  });

  it('falls through to release date when every week ties', () => {
    const artifact = campaign();
    const noWeeks = slice({
      movies: slice().movies.map((movie) => ({ ...movie, weekly_gross: {} })),
    });
    const rows = cardRows(board(artifact, [noWeeks])).sort(compareCards('default', 'asc', []));
    expect(rows.map((row) => row.title)).toEqual(['In Profit', 'In The Red', 'Still To Come']);
  });

  it('sorts a numeric field in the direction asked for', () => {
    expect(sorted('profitTd', 'desc')).toEqual(['In Profit', 'In The Red', 'Still To Come']);
    expect(sorted('profitTd', 'asc')).toEqual(['In The Red', 'In Profit', 'Still To Come']);
  });

  it('sorts release date as a date, both ways', () => {
    expect(sorted('releaseDate', 'asc')).toEqual(['In Profit', 'In The Red', 'Still To Come']);
    expect(sorted('releaseDate', 'desc')).toEqual(['Still To Come', 'In The Red', 'In Profit']);
  });

  it('sorts a Movie with no figure last whichever way the sort runs', () => {
    // Ascending, a null would otherwise lead the table with Movies that have
    // simply not been measured yet.
    expect(sorted('roi', 'asc').at(-1)).toBe('Still To Come');
    expect(sorted('roi', 'desc').at(-1)).toBe('Still To Come');
  });
});

describe('roiMeter', () => {
  it('has no geometry without an ROI', () => {
    expect(roiMeter(null)).toBeNull();
  });

  it('fills right of break-even for a profit, left for a loss', () => {
    expect(roiMeter(50)).toMatchObject({ positive: true });
    expect(roiMeter(-50)).toMatchObject({ positive: false });
    expect(roiMeter(0)).toMatchObject({ positive: true, fillPct: 0 });
  });

  it('reaches the cap at exactly +100% and no further', () => {
    expect(roiMeter(100).fillPct).toBeCloseTo(35);
    expect(roiMeter(5000).fillPct).toBeCloseTo(35);
  });

  it('bounds a loss at −100%, which is everything staked', () => {
    expect(roiMeter(-100).fillPct).toBeCloseTo(50);
    expect(roiMeter(-400).fillPct).toBeCloseTo(50);
  });

  it('shows nothing past the cap until the ROI passes +100%', () => {
    expect(roiMeter(99).breakoutPct).toBeNull();
    expect(roiMeter(100).breakoutPct).toBeNull();
  });

  it('grows the breakout lane on a log scale so it clears the cap early', () => {
    // Linear scaling would leave every realistic ROI invisible against the
    // +12500% end of the lane, so the lane is logarithmic.
    const modest = roiMeter(300).breakoutPct;
    const huge = roiMeter(12500).breakoutPct;
    expect(huge).toBeCloseTo(15);
    expect(modest).toBeGreaterThan(15 * (300 - 100) / (12500 - 100));
    expect(modest).toBeLessThan(huge);
  });

  it('never runs the lane past the end of the bar', () => {
    expect(roiMeter(999999).breakoutPct).toBeCloseTo(15);
  });
});

describe('weekAxisIndexes', () => {
  it('labels every bar while there are few enough to fit', () => {
    expect(weekAxisIndexes(1)).toEqual([0]);
    expect(weekAxisIndexes(3)).toEqual([0, 1, 2]);
    expect(weekAxisIndexes(4)).toEqual([0, 1, 2, 3]);
  });

  it('thins the labels out as the run gets longer', () => {
    expect(weekAxisIndexes(10)).toEqual([0, 2, 5, 7, 9]);
    expect(weekAxisIndexes(20)).toHaveLength(6);
  });

  it('always labels the first and the latest bar', () => {
    for (const n of [2, 5, 9, 13, 30]) {
      const idx = weekAxisIndexes(n);
      expect(idx[0]).toBe(0);
      expect(idx.at(-1)).toBe(n - 1);
    }
  });

  it('never labels the same bar twice', () => {
    for (const n of [1, 2, 3, 5, 6, 7, 9, 13]) {
      const idx = weekAxisIndexes(n);
      expect(new Set(idx).size).toBe(idx.length);
    }
  });
});

describe('weekDeltas', () => {
  it('measures each week against the one before it', () => {
    expect(weekDeltas([
      { num: 10, gross: 200 },
      { num: 11, gross: 300 },
      { num: 12, gross: 150 },
    ])).toEqual([
      { num: 10, gross: 200, deltaPct: null },
      { num: 11, gross: 300, deltaPct: 50 },
      { num: 12, gross: 150, deltaPct: -50 },
    ]);
  });

  it('has no delta against a week that took nothing', () => {
    expect(weekDeltas([{ num: 10, gross: 0 }, { num: 11, gross: 500 }])[1].deltaPct).toBeNull();
  });

  it('measures against the size of the drop, not its sign', () => {
    // A revised-down week can read negative. Dividing by the signed figure
    // would flip the delta's sign and show a recovery as a collapse.
    expect(weekDeltas([{ num: 10, gross: -200 }, { num: 11, gross: -100 }])[1].deltaPct).toBe(50);
  });
});
