import { describe, expect, it } from 'vitest';

import {
  collectDailyDates,
  collectWeekKeys,
  groupDatesByWeek,
  hasNegativeDaily,
  valueOrNull,
  weeksFromWeekly,
} from './week-fields.js';

// The one place a row's week and day fields are derived, for the Campaign's
// Board and the Movies page alike (#162). A change here moves a column, a
// sparkline or a sort on both pages at once, which is why it is tested on its
// own rather than only through whichever page happens to call it.

const MILLION = 1_000_000;

const ROWS = [
  {
    weeklyGross: { '2026-W08': 30 * MILLION, '2026-W09': 12 * MILLION },
    dailyChange: { '2026-02-20': 20 * MILLION, '2026-02-21': -2 * MILLION },
  },
  {
    weeklyGross: { '2026-W10': 44 * MILLION },
    dailyChange: { '2026-03-06': 44 * MILLION },
  },
];

describe('collectWeekKeys', () => {
  // The union rather than one row's own keys: a column has to exist for every
  // Movie or for none, and oldest first is the order the pages reverse.
  it('answers every week any row reported, oldest first', () => {
    // The rows are handed over newest first, so an answer that only followed
    // the order it met them in would come back the wrong way round.
    expect(collectWeekKeys([ROWS[1], ROWS[0]]))
      .toEqual(['2026-W08', '2026-W09', '2026-W10']);
  });

  it('answers nothing for rows with no weekly gross at all', () => {
    expect(collectWeekKeys([{ weeklyGross: {} }, {}])).toEqual([]);
  });
});

describe('collectDailyDates', () => {
  it('answers every day any row reported, oldest first', () => {
    expect(collectDailyDates([ROWS[1], ROWS[0]]))
      .toEqual(['2026-02-20', '2026-02-21', '2026-03-06']);
  });
});

describe('groupDatesByWeek', () => {
  // The detailed view hangs its day columns under the week they belong to, so
  // the grouping is by ISO week and a date that crosses the boundary lands in
  // the later one.
  it('files each date under its ISO week', () => {
    expect(groupDatesByWeek(['2026-02-20', '2026-02-21', '2026-03-06'])).toEqual({
      '2026-W08': ['2026-02-20', '2026-02-21'],
      '2026-W10': ['2026-03-06'],
    });
  });
});

describe('hasNegativeDaily', () => {
  // A revised-down day is not money handed back, so the page footnotes the
  // column rather than colouring it as a loss, and only when there is one.
  it('is true when any row revised a day downward', () => {
    expect(hasNegativeDaily(ROWS)).toBe(true);
  });

  // Zero and a day that took money are both real figures. Only a day below
  // zero is a revision.
  it('is false when every day is a real figure', () => {
    expect(hasNegativeDaily([
      { dailyChange: { '2026-03-06': 0, '2026-03-07': 5 * MILLION } },
    ])).toBe(false);
  });

  it('is false for a row with no daily figures at all', () => {
    expect(hasNegativeDaily([{}])).toBe(false);
  });
});

describe('valueOrNull', () => {
  // Zero is a real figure (a day that took nothing) and an unreported day is
  // not. Collapsing the two would sort an unreported day alongside genuine
  // flops.
  it('keeps zero and answers null for a key that was never reported', () => {
    expect(valueOrNull({ a: 0 }, 'a')).toBe(0);
    expect(valueOrNull({ a: 0 }, 'b')).toBe(null);
    expect(valueOrNull(undefined, 'a')).toBe(null);
  });
});

describe('weeksFromWeekly', () => {
  // The sparkline's bars: this Movie's own weeks, oldest first, each labelled
  // by its ISO week number.
  it('answers the weeks this Movie reported, oldest first', () => {
    expect(weeksFromWeekly({ '2026-W09': 12 * MILLION, '2026-W08': 30 * MILLION }))
      .toEqual([
        { num: 8, gross: 30 * MILLION },
        { num: 9, gross: 12 * MILLION },
      ]);
  });

  it('answers nothing for a Movie that has reported no week', () => {
    expect(weeksFromWeekly(undefined)).toEqual([]);
  });
});
