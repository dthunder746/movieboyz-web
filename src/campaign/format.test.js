import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  colorClass,
  dateToIsoWeekKey,
  escapeHtml,
  fmt,
  fmtPct,
  fmtRelativeAgo,
  fmtTimestamp,
  formatDayMonth,
  formatShortDate,
  getWeekdayAbbr,
  isoWeekBounds,
  ratingColorClass,
  weekTitle,
} from './format.js';

// These pin the old site's presentation exactly. The page is a parity target, so
// a rounding or suffix change here is a visible regression, not a refactor.
describe('fmt', () => {
  it('renders billions to three decimals', () => {
    expect(fmt(1524442988)).toBe('$1.524b');
  });

  it('renders millions to one decimal', () => {
    expect(fmt(454107643)).toBe('$454.1m');
  });

  it('renders thousands rounded to whole units', () => {
    expect(fmt(12500)).toBe('$13k');
  });

  it('renders sub-thousand values rounded to whole dollars', () => {
    expect(fmt(999.4)).toBe('$999');
  });

  it('puts the sign outside the dollar symbol', () => {
    expect(fmt(-110568422)).toBe('-$110.6m');
  });

  it('renders a missing value as an em dash', () => {
    expect(fmt(null)).toBe('—');
    expect(fmt(undefined)).toBe('—');
  });

  it('renders zero as a dollar amount, not a dash', () => {
    expect(fmt(0)).toBe('$0');
  });
});

describe('fmtPct', () => {
  it('signs positive values explicitly', () => {
    expect(fmtPct(12.34)).toBe('+12.3%');
  });

  it('leaves the minus sign to do the work on negatives', () => {
    expect(fmtPct(-4.56)).toBe('-4.6%');
  });

  it('signs zero as positive', () => {
    expect(fmtPct(0)).toBe('+0.0%');
  });
});

describe('colorClass', () => {
  it('classifies by sign, with zero neutral', () => {
    expect(colorClass(1)).toBe('text-pos');
    expect(colorClass(-1)).toBe('text-neg');
    expect(colorClass(0)).toBe('text-neu');
  });

  it('treats a missing value as neutral', () => {
    expect(colorClass(null)).toBe('text-neu');
    expect(colorClass(undefined)).toBe('text-neu');
  });
});

describe('formatShortDate', () => {
  it('renders an ISO date as an abbreviated month and unpadded day', () => {
    expect(formatShortDate('2026-08-12')).toBe('Aug 12');
    expect(formatShortDate('2026-01-04')).toBe('Jan 4');
  });
});

// Ratings are scored out of 100 and read the opposite way round to money: a
// low score is bad news, so the thresholds are absolute rather than signed.
describe('ratingColorClass', () => {
  it('paints 70 and above positive', () => {
    expect(ratingColorClass(70)).toBe('text-pos');
    expect(ratingColorClass(100)).toBe('text-pos');
  });

  it('paints below 50 negative', () => {
    expect(ratingColorClass(49)).toBe('text-neg');
  });

  it('leaves the middle band neutral', () => {
    expect(ratingColorClass(50)).toBe('text-neu');
    expect(ratingColorClass(69)).toBe('text-neu');
  });

  it('treats a missing score as neutral', () => {
    expect(ratingColorClass(null)).toBe('text-neu');
    expect(ratingColorClass(undefined)).toBe('text-neu');
  });
});

describe('formatDayMonth', () => {
  it('renders day over month, both zero-padded', () => {
    expect(formatDayMonth('2026-08-11')).toBe('11/08');
  });
});

describe('getWeekdayAbbr', () => {
  it('names the weekday in UTC, so a date never slips a day', () => {
    expect(getWeekdayAbbr('2026-08-11')).toBe('TUE');
    expect(getWeekdayAbbr('2026-08-16')).toBe('SUN');
  });
});

// The processor keys weekly gross by ISO week, so the table's week columns are
// only correct if these agree with it exactly. ISO weeks run Monday to Sunday
// and belong to the year holding their Thursday, which is why the boundary
// cases below matter more than the ordinary ones.
describe('isoWeekBounds', () => {
  it('spans Monday to Sunday', () => {
    expect(isoWeekBounds('2026-W09')).toEqual({ start: '2026-02-23', end: '2026-03-01' });
  });

  it('starts week 1 in the previous calendar year when it has to', () => {
    expect(isoWeekBounds('2026-W01')).toEqual({ start: '2025-12-29', end: '2026-01-04' });
  });
});

describe('weekTitle', () => {
  it('names the month once when the week does not cross one', () => {
    expect(weekTitle('2026-W33')).toBe('Aug 10–16');
  });

  it('names both months when the week crosses one', () => {
    expect(weekTitle('2026-W09')).toBe('Feb 23–Mar 1');
  });

  it('names both months when the week crosses a year', () => {
    expect(weekTitle('2026-W01')).toBe('Dec 29–Jan 4');
  });
});

describe('dateToIsoWeekKey', () => {
  it('keys an ordinary date to its week', () => {
    expect(dateToIsoWeekKey('2026-08-11')).toBe('2026-W33');
  });

  it('keys New Year’s Day to the week holding its Thursday', () => {
    expect(dateToIsoWeekKey('2026-01-01')).toBe('2026-W01');
  });

  it('keys early January to the previous ISO year when the week belongs there', () => {
    expect(dateToIsoWeekKey('2026-12-31')).toBe('2026-W53');
    expect(dateToIsoWeekKey('2027-01-03')).toBe('2026-W53');
  });

  it('round-trips against isoWeekBounds', () => {
    const { start, end } = isoWeekBounds('2026-W33');
    expect(dateToIsoWeekKey(start)).toBe('2026-W33');
    expect(dateToIsoWeekKey(end)).toBe('2026-W33');
  });
});

describe('fmtTimestamp', () => {
  it('trims the century off an already-local timestamp string', () => {
    expect(fmtTimestamp('2026-08-11 18:30:00')).toBe('26-08-11 18:30:00');
  });

  it('renders a Date in the browser’s own time zone', () => {
    const local = new Date(2026, 7, 11, 18, 30, 5);
    expect(fmtTimestamp(local)).toBe('26-08-11 18:30:05');
  });
});

describe('fmtRelativeAgo', () => {
  const now = new Date(2026, 7, 11, 18, 30, 0);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calls anything under a minute just now', () => {
    expect(fmtRelativeAgo(new Date(2026, 7, 11, 18, 29, 30))).toBe('just now');
  });

  it('counts whole minutes under an hour', () => {
    expect(fmtRelativeAgo(new Date(2026, 7, 11, 18, 0, 0))).toBe('30mins ago');
  });

  it('counts hours and minutes under a day', () => {
    expect(fmtRelativeAgo(new Date(2026, 7, 11, 15, 15, 0))).toBe('3hrs 15mins ago');
  });

  it('drops the minutes when they come out even', () => {
    expect(fmtRelativeAgo(new Date(2026, 7, 11, 15, 30, 0))).toBe('3hrs ago');
  });

  it('counts days and hours beyond a day', () => {
    expect(fmtRelativeAgo(new Date(2026, 7, 9, 12, 30, 0))).toBe('2days 6hrs ago');
    expect(fmtRelativeAgo(new Date(2026, 7, 9, 18, 30, 0))).toBe('2days ago');
  });

  it('reads a timestamp string as local time, matching the artifact', () => {
    expect(fmtRelativeAgo('2026-08-11 15:15:00')).toBe('3hrs 15mins ago');
  });

  it('never counts backwards for a timestamp in the future', () => {
    expect(fmtRelativeAgo(new Date(2026, 7, 12, 0, 0, 0))).toBe('just now');
  });

  it('says nothing for an unparseable value', () => {
    expect(fmtRelativeAgo('not a date')).toBe('');
    expect(fmtRelativeAgo(null)).toBe('');
  });
});

// Movie titles come off an artifact the page does not control, and every module
// that renders one builds markup as a string. Escaping is therefore the only
// thing standing between a title and the DOM.
describe('escapeHtml', () => {
  it('neutralises the characters that would open a tag', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
  });

  it('escapes the ampersand first, so an escape is not double-escaped', () => {
    expect(escapeHtml('Fish & Chips')).toBe('Fish &amp; Chips');
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('escapes the double quote, since values are interpolated into attributes', () => {
    expect(escapeHtml('The "Burbs')).toBe('The &quot;Burbs');
  });

  it('renders a missing value as the empty string rather than "null"', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('stringifies a non-string', () => {
    expect(escapeHtml(2026)).toBe('2026');
  });
});
