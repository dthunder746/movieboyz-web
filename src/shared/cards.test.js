import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildCards, movieTitleLink, weekAxisIndexes, weekDeltas, weekTable, weeklyModule,
} from './cards.js';

afterEach(() => {
  vi.unstubAllGlobals();
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

describe('weeklyModule', () => {
  const weeks = [{ num: 10, gross: 200 }, { num: 11, gross: 400 }, { num: 12, gross: 100 }];

  it('draws one bar per week, the latest at full opacity', () => {
    const html = weeklyModule(weeks, '#ff0000', 100);
    const bars = html.match(/<rect [^>]*>/g);
    expect(bars).toHaveLength(3);
    expect(bars.at(-1)).toContain('opacity="1"');
    expect(bars.slice(0, -1).every((bar) => bar.includes('opacity="0.5"'))).toBe(true);
    expect(html).toContain('fill="#ff0000"');
  });

  it('labels the axis with the weeks own numbers', () => {
    const html = weeklyModule(weeks, '#ff0000', 100);
    expect(html).toContain('W10');
    expect(html).toContain('W12');
  });

  it('draws nothing at all for a Movie with no weeks', () => {
    expect(weeklyModule([], '#ff0000', 100)).toBe('');
    expect(weeklyModule(null, '#ff0000', 100)).toBe('');
  });

  it('falls back to the caption alone when there is no shape to draw', () => {
    const solo = weeklyModule([{ num: 10, gross: 0 }], '#ff0000', 500);
    expect(solo).toContain('Gross this week');
    expect(solo).not.toContain('<svg');

    expect(weeklyModule([{ num: 10, gross: 0 }], '#ff0000', null)).toBe('');
  });
});

describe('weekTable', () => {
  it('lists the weeks newest first with each change against the week before', () => {
    const html = weekTable([
      { num: 10, gross: 200 },
      { num: 11, gross: 300 },
    ]);
    expect(html.indexOf('#11')).toBeLessThan(html.indexOf('#10'));
    expect(html).toContain('+50%');
  });

  it('says so when a Movie has no weekly data yet', () => {
    expect(weekTable([])).toContain('No weekly data yet');
  });
});

describe('movieTitleLink', () => {
  // The class is the contract: the gestures stand off anything carrying it, so
  // a tap on the title navigates rather than expanding the card.
  it('wraps the title markup in a link the card gestures stand off', () => {
    vi.stubGlobal('window', { location: { pathname: '/movies/' } });
    vi.stubGlobal('document', { querySelector: () => null });

    const html = movieTitleLink('tt0111161', '<span class="movie-title-text">Heat</span>');

    expect(html).toContain('class="movie-title-link"');
    expect(html).toContain('<span class="movie-title-text">Heat</span>');
    expect(html).toMatch(/href="[^"]*tt0111161[^"]*"/);
  });
});

describe('buildCards', () => {
  function container() {
    const listeners = new Map();
    return {
      innerHTML: '',
      addEventListener: (type, handler) => listeners.set(type, handler),
      querySelectorAll: () => [],
      listeners,
    };
  }

  function harness(rows, visibleIds) {
    const grid = container();
    vi.stubGlobal('document', { getElementById: (id) => (id === 'movie-cards' ? grid : null) });

    const cardMarkup = vi.fn((row) => `<div data-imdb-id="${row.imdbId}"></div>`);
    const cards = buildCards({
      rows,
      compare: () => (a, b) => a.imdbId.localeCompare(b.imdbId),
      cardMarkup,
      selection: { has: () => false, toArray: () => [] },
      visibleIds,
    });

    return { cards, grid, cardMarkup };
  }

  const ROWS = [{ imdbId: 'tt1' }, { imdbId: 'tt2' }, { imdbId: 'tt3' }];

  it('draws one card per row, through the markup it was given', () => {
    const { grid, cardMarkup } = harness(ROWS);
    expect(cardMarkup).toHaveBeenCalledTimes(3);
    expect(grid.innerHTML.match(/data-imdb-id/g)).toHaveLength(3);
  });

  it('draws only the rows the filters left visible', () => {
    const { grid, cardMarkup } = harness(ROWS, ['tt1', 'tt3']);
    expect(cardMarkup).toHaveBeenCalledTimes(2);
    expect(grid.innerHTML).not.toContain('tt2');
  });

  it('redraws on a change of what is visible', () => {
    const { cards, cardMarkup, grid } = harness(ROWS, ['tt1']);
    cardMarkup.mockClear();

    cards.setVisibleIds(['tt2', 'tt3']);

    expect(cardMarkup).toHaveBeenCalledTimes(2);
    expect(grid.innerHTML).toContain('tt3');
  });

  it('says so rather than drawing an empty grid', () => {
    const { grid } = harness(ROWS, []);
    expect(grid.innerHTML).toContain('No movies match the current filters.');
  });

  it('is inert when the page carries no card grid', () => {
    vi.stubGlobal('document', { getElementById: () => null });
    expect(buildCards({ rows: ROWS, compare: () => () => 0, cardMarkup: () => '' })).toBeNull();
  });
});
