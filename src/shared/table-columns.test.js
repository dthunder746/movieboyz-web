import { describe, expect, it } from 'vitest';

// The module measures its header widths against a canvas at import time, and
// the suite runs without a DOM, so the document it wants is stood up before it
// loads. The width itself is not what is under test here; the columns are.
globalThis.document = {
  createElement: () => ({
    style: {},
    getContext: () => ({ font: '', measureText: (text) => ({ width: text.length * 7 }) }),
    appendChild: () => {},
    addEventListener: () => {},
  }),
};

const {
  buildSortMap,
  compactWeekColumn,
  dayColumn,
  daysForWeek,
  defaultSort,
  moneyCell,
  dailyCell,
  releaseDateCell,
  roundedRoiCell,
  weekTotalCell,
} = await import('./table-columns.js');

const cell = (value) => ({ getValue: () => value });

describe('formatters', () => {
  it('dash a cell with nothing in it', () => {
    for (const formatter of [moneyCell, dailyCell, weekTotalCell, roundedRoiCell]) {
      expect(formatter(cell(null))).toContain('—');
      expect(formatter(cell(undefined))).toContain('—');
    }
  });

  it('money is money, without a colour of its own', () => {
    expect(moneyCell(cell(1500000))).not.toContain('<span');
    expect(moneyCell(cell(0))).not.toContain('—');
  });

  it('paints a losing figure and a winning one differently', () => {
    expect(weekTotalCell(cell(500))).toContain('text-pos');
    // There is no losing week: a zero week reads neutral rather than negative.
    expect(weekTotalCell(cell(0))).toContain('text-neu');
  });

  it('marks a negative day as a revision rather than a loss', () => {
    expect(dailyCell(cell(-200))).toContain('daily-neg-revised');
    expect(dailyCell(cell(200))).not.toContain('daily-neg-revised');
  });

  it('rounds ROI to whole percent and signs a gain', () => {
    expect(roundedRoiCell(cell(12.4))).toContain('+12%');
    expect(roundedRoiCell(cell(-12.4))).toContain('-12%');
  });

  it('shows an undated Movie as TBA', () => {
    expect(releaseDateCell(cell('TBA'))).toContain('TBA');
    expect(releaseDateCell(cell(null))).toContain('TBA');
    expect(releaseDateCell(cell('2026-03-04'))).not.toContain('TBA');
  });
});

describe('daysForWeek', () => {
  it('gives a closed week all seven days, most recent first', () => {
    // 2026-W10 runs Mon 2 March to Sun 8 March.
    expect(daysForWeek('2026-W10', false, {})).toEqual([
      '2026-03-08', '2026-03-07', '2026-03-06', '2026-03-05',
      '2026-03-04', '2026-03-03', '2026-03-02',
    ]);
  });

  it('gives the current week only the days that have reported', () => {
    const datesByWeek = { '2026-W10': ['2026-03-02', '2026-03-04', '2026-03-03'] };
    expect(daysForWeek('2026-W10', true, datesByWeek))
      .toEqual(['2026-03-04', '2026-03-03', '2026-03-02']);
  });

  it('gives the current week nothing when it has reported nothing', () => {
    expect(daysForWeek('2026-W10', true, {})).toEqual([]);
  });
});

describe('week and day columns', () => {
  it('names a day column after the date it carries', () => {
    const column = dayColumn('2026-03-04', true);
    expect(column.field).toBe('daily_2026-03-04');
    expect(column.visible).toBe(true);
  });

  it('hides the days of a week that is already closed', () => {
    expect(dayColumn('2026-03-04', false).visible).toBe(false);
  });

  it('names a compact week column after the week it carries', () => {
    const column = compactWeekColumn('2026-W10');
    expect(column.field).toBe('week_2026-W10');
    expect(column.title).toBe('Gross Week #10');
  });
});

describe('defaultSort', () => {
  it('leads on release date and falls through every week, newest last', () => {
    expect(defaultSort(['2026-W10', '2026-W11'])).toEqual([
      { column: 'releaseDate', dir: 'asc' },
      { column: 'week_2026-W10', dir: 'desc' },
      { column: 'week_2026-W11', dir: 'desc' },
    ]);
  });

  it('is release date alone for a Campaign with no gross yet', () => {
    expect(defaultSort([])).toEqual([{ column: 'releaseDate', dir: 'asc' }]);
  });
});

describe('buildSortMap', () => {
  it('points thisWeek at the latest week column', () => {
    const initial = defaultSort(['2026-W10', '2026-W11']);
    const map = buildSortMap(['2026-W10', '2026-W11'], initial);

    expect(map.thisWeek).toEqual([{ column: 'week_2026-W11', dir: 'desc' }]);
    expect(map.default).toBe(initial);
    expect(map.profitTd).toEqual([{ column: 'profitTd', dir: 'desc' }]);
  });

  it('falls back to the default order when there is no week to sort on', () => {
    const initial = defaultSort([]);
    expect(buildSortMap([], initial).thisWeek).toBe(initial);
  });
});
