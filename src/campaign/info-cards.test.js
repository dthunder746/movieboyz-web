import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildInfoCards } from './info-cards.js';

// The card is faked the way the scorecard strip's test fakes the strip: the
// builder rewrites `innerHTML` and hangs one listener off the element.
let card;

beforeEach(() => {
  card = {
    innerHTML: '',
    addEventListener: () => {},
    querySelectorAll: () => [],
    style: {},
  };
  vi.stubGlobal('window', {
    location: { pathname: '/league/movieboyz/2026/' },
    innerWidth: 1200,
    addEventListener: () => {},
  });
  vi.stubGlobal('document', {
    cookie: '',
    querySelector: () => null,
    getElementById: (id) => (id === 'info-cards' ? card : null),
  });
});

function movie(imdbId, title) {
  return {
    imdbId,
    title,
    userId: 'u1',
    username: 'Marcus',
    pickType: 'hit',
    season: 'WINTER',
    releaseDate: '2026-01-10',
    releasedDigital: '2026-03-01',
    digitalWindowDays: 50,
    profitTd: 200,
    roi: 50,
  };
}

const HIGHLIGHTS = {
  upcoming: [movie('tt1', 'Upcoming One')],
  profitable: [movie('tt2', 'Profitable One')],
  worst: [movie('tt3', 'Worst One')],
  streaming: {
    all: [movie('tt4', 'Streaming One')],
    upcomingDigital: [movie('tt4', 'Streaming One')],
    availableNow: [],
  },
  daily: { label: 'Daily', rows: [{ movie: movie('tt5', 'Daily One'), gross: 10, pctYd: 1, pctLw: 2 }] },
  weekly: { label: 'Weekly', rows: [{ movie: movie('tt6', 'Weekly One'), gross: 10, pctLw: 2 }] },
};

describe('the info tabs', () => {
  // Every tab writes its Movie cell through the one helper, so linking there
  // links all six at once (#188).
  it('links the film name in every tab', () => {
    buildInfoCards(HIGHLIGHTS, { u1: '#123456' });
    for (const [id, title] of [
      ['tt1', 'Upcoming One'], ['tt2', 'Profitable One'], ['tt3', 'Worst One'],
      ['tt4', 'Streaming One'], ['tt5', 'Daily One'], ['tt6', 'Weekly One'],
    ]) {
      expect(card.innerHTML).toContain(`<a class="movie-title-link" href="/movies/?id=${id}">${title}</a>`);
    }
  });
});
