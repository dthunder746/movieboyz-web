import { describe, expect, it } from 'vitest';

import { colorClass, fmt, fmtPct, formatShortDate } from './format.js';

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
