import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildScorecards } from './scorecards.js';

// The strip is faked rather than mounted: the builder rewrites the element's
// `innerHTML` and hangs one listener off it, so the markup it drew is all a
// test needs to read.
let strip;

beforeEach(() => {
  strip = {
    innerHTML: '',
    classList: { add: () => {}, remove: () => {} },
    addEventListener: () => {},
  };
  vi.stubGlobal('window', { location: { pathname: '/league/movieboyz/2026/' } });
  vi.stubGlobal('document', {
    cookie: '',
    querySelector: () => null,
    getElementById: (id) => (id === 'weekend-strip' ? strip : null),
  });
});

const STANDINGS = {
  rows: [{
    userId: 'u1',
    username: 'Marcus',
    rank: 1,
    total: 200,
    slateProfit: 200,
    bombImpact: 0,
    avgLetterboxd: 70,
    roi: 50,
    released: [{
      imdbId: 'tt0111161',
      title: 'Heat',
      pickType: 'hit',
      season: 'WINTER',
      breakeven: 100,
      grossTd: 300,
      profitTd: 200,
    }],
    nextPick: {
      imdbId: 'tt0222222',
      title: 'The Next One',
      pickType: 'alt',
      season: 'SPRING',
      daysUntil: 12,
    },
  }],
};

function draw() {
  buildScorecards(STANDINGS, { u1: '#123456' });
  return strip.innerHTML;
}

describe('the scorecard strip', () => {
  it('links every released Pick to its Movie page', () => {
    expect(draw()).toContain('<a class="movie-title-link" href="/movies/?id=tt0111161">Heat</a>');
  });

  it('links the Next footer to the Movie page', () => {
    expect(draw()).toContain('<a class="movie-title-link" href="/movies/?id=tt0222222">The Next One</a>');
  });
});
