import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildUnpickedCards, buildYearUnpickedCards } from './unpicked-cards.js';

// The sidebar measures itself after it draws, so the element it is handed has
// to answer the few reads that cap the cards. Nothing here asserts on the cap.
let mount;

beforeEach(() => {
  mount = { innerHTML: '', querySelectorAll: () => [] };
  vi.stubGlobal('window', {
    location: { pathname: '/league/movieboyz/2026/draft/' },
    innerWidth: 800,
  });
  vi.stubGlobal('document', { querySelector: () => null });
});

function movie(overrides = {}) {
  return {
    imdbId: 'tt1',
    title: 'Heat',
    season: 'WINTER',
    pickType: null,
    userId: null,
    username: null,
    draftPick: null,
    profitTd: 100,
    breakeven: 50,
    releaseDate: '2026-02-01',
    ...overrides,
  };
}

const VIEW = {
  users: [],
  ghostSlots: [],
  rows: [
    movie(),
    movie({ imdbId: 'tt2', title: 'Tenet', releaseDate: '2026-11-01', profitTd: null }),
  ],
};

describe('the candidates sidebar', () => {
  it('links the films that have opened and the ones still to come', () => {
    buildUnpickedCards(VIEW, 'WINTER', '2026-06-01', mount);
    expect(mount.innerHTML).toContain('<a class="movie-title-link" href="/movies/?id=tt1">Heat</a>');
    expect(mount.innerHTML).toContain('<a class="movie-title-link" href="/movies/?id=tt2">Tenet</a>');
  });

  it('links them on the year tab too', () => {
    buildYearUnpickedCards(VIEW, '2026-06-01', {}, mount, null);
    expect(mount.innerHTML).toContain('href="/movies/?id=tt1"');
  });
});
