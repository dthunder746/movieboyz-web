import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildCards } from './cards.js';

// The grid is faked the way the shared card view's own test fakes it: the
// builder only ever rewrites `innerHTML` and hangs listeners off the element,
// so holding the markup as a string is enough to assert on what was drawn.
function fakeGrid() {
  return {
    innerHTML: '',
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
  };
}

let grid;

beforeEach(() => {
  grid = fakeGrid();
  vi.stubGlobal('window', { location: { pathname: '/league/movieboyz/2026/' } });
  vi.stubGlobal('document', {
    querySelector: () => null,
    getElementById: (id) => (id === 'movie-cards' ? grid : null),
  });
});

const BOARD = {
  rows: [{
    imdbId: 'tt0111161',
    title: 'Heat',
    userId: 'u1',
    username: 'Marcus',
    pickType: 'hit',
    season: 'WINTER',
    releaseDate: '2026-01-10',
    breakeven: 100,
    grossTd: 300,
    profitTd: 200,
    weeklyGross: {},
    ratings: {},
  }],
};

function draw() {
  buildCards(BOARD, { u1: '#123456' }, { has: () => false, toArray: () => [] }, null, null, null);
  return grid.innerHTML;
}

describe('the Campaign card', () => {
  // The name is the way into the Movie's page now, so a reader who is looking
  // at a card is never sent back to the table to find the film again (#188).
  it('makes the card title a link to the Movie page', () => {
    const html = draw();
    expect(html).toContain('<a class="movie-title-link" href="/movies/?id=tt0111161">');
    expect(html).toMatch(/<a class="movie-title-link"[^>]*><span class="movie-title-text">Heat<\/span><\/a>/);
  });

  // The title carries the link, so the line in the expanded area that used to
  // carry it is gone rather than duplicated.
  it('no longer carries a separate way into the Movie page', () => {
    expect(draw()).not.toContain('Open Movie page');
  });
});
