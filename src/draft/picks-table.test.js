import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildPicksTable, buildYearPicksTable } from './picks-table.js';

// Both builders write one string into the element they are handed, so the
// element is a plain object holding it.
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

const COLORS = { a: '#123456' };

describe('the draft order table', () => {
  it('links the film in a Pick row', () => {
    buildPicksTable({ rows: [pick()], users: [], ghostSlots: [] }, 'WINTER', COLORS, mount);
    expect(mount.innerHTML).toContain('<a class="movie-title-link" href="/movies/?id=tt1">Heat</a>');
  });

  it('links the film on the year tab too', () => {
    const view = { rows: [pick({ pickType: 'hit', imdbId: 'tt2', title: 'Tenet' })], users: [], ghostSlots: [] };
    buildYearPicksTable(view, COLORS, mount);
    expect(mount.innerHTML).toContain('<a class="movie-title-link" href="/movies/?id=tt2">Tenet</a>');
  });

  // An emptied slot names no film, so there is nothing to link and no anchor
  // pointing at an empty address.
  it('leaves an emptied slot without a link', () => {
    const view = { rows: [], users: [], ghostSlots: [{ userId: 'a', username: 'Ann', pickType: 'seasonal', draftPick: 2, season: 'WINTER' }] };
    buildPicksTable(view, 'WINTER', COLORS, mount);
    expect(mount.innerHTML).toContain('cleared');
    expect(mount.innerHTML).not.toContain('movie-title-link');
  });
});
