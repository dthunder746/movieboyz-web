import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildLeaderboard } from './leaderboard.js';

let mount;

beforeEach(() => {
  mount = { innerHTML: '' };
  vi.stubGlobal('window', { location: { pathname: '/league/movieboyz/2026/draft/' } });
  vi.stubGlobal('document', { querySelector: () => null });
});

const VIEW = {
  users: [{ userId: 'a', username: 'Ann' }],
  ghostSlots: [],
  rows: [{
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
  }],
};

describe('the draft leaderboard', () => {
  it('links the film named on a Slate chip', () => {
    buildLeaderboard(VIEW, 'WINTER', { a: '#123456' }, mount);
    expect(mount.innerHTML).toContain('<a class="movie-title-link" href="/movies/?id=tt1">Heat</a>');
  });

  // An empty slot and a cleared one name no film, so neither carries a link.
  it('leaves the empty slots without a link', () => {
    buildLeaderboard(VIEW, 'WINTER', { a: '#123456' }, mount);
    expect(mount.innerHTML.match(/movie-title-link/g)).toHaveLength(1);
  });
});
