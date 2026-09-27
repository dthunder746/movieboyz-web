import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildHighlights } from './highlights.js';

let mount;

beforeEach(() => {
  mount = { innerHTML: '' };
  vi.stubGlobal('window', { location: { pathname: '/league/movieboyz/2026/draft/' } });
  vi.stubGlobal('document', { querySelector: () => null });
});

function pick(overrides = {}) {
  return {
    imdbId: 'tt1',
    title: 'Heat',
    season: 'WINTER',
    pickType: 'seasonal',
    userId: 'a',
    username: 'Ann',
    draftPick: 1,
    profitTd: 100,
    breakeven: 50,
    releaseDate: '2026-02-01',
    ...overrides,
  };
}

const VIEW = {
  users: [{ userId: 'a', username: 'Ann' }, { userId: 'b', username: 'Bo' }],
  ghostSlots: [],
  rows: [
    pick(),
    pick({
      imdbId: 'tt2', title: 'Tenet', userId: 'b', username: 'Bo', draftPick: 2, profitTd: -20,
    }),
  ],
};

describe('the highlights strip', () => {
  // Every tile that names a film links it; the tile that names only a holder
  // has no film to link (#188).
  it('links the film each tile names', () => {
    buildHighlights(VIEW, 'WINTER', { a: '#123456', b: '#654321' }, mount);
    expect(mount.innerHTML).toContain('<a class="movie-title-link" href="/movies/?id=tt1">Heat</a>');
    expect(mount.innerHTML).toContain('<a class="movie-title-link" href="/movies/?id=tt2">Tenet</a>');
  });
});
