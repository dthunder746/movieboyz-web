import { describe, expect, it } from 'vitest';

import { RATING_SOURCES, displayRatings } from './ratings.js';

const SOME_RATINGS = {
  fetched_at: '2026-08-10',
  imdb: { score: 65, votes: 97567 },
  letterboxd: { score: 60, votes: 451636 },
  metacritic: { score: 71, votes: null },
  rt_audience: { score: 88, votes: 1200 },
  rt_critic: { score: 92, votes: 340 },
  tmdb: { score: 74, votes: 900 },
  trakt: { score: 80, votes: 1 },
};

// Every source publishes on the 0-100 scale the platform stores, and every one
// of them is read by its own audience in different units.
describe('RATING_SOURCES', () => {
  it('puts each score back into the units that source is read in', () => {
    const display = Object.fromEntries(
      RATING_SOURCES.map((source) => [source.key, source.display(80)]),
    );

    expect(display).toEqual({
      letterboxd: '4.0',
      imdb: '8.0',
      tmdb: '8.0',
      rt_audience: '80%',
      rt_critic: '80%',
      trakt: '80%',
      metacritic: '80',
    });
  });

  it('names every source without repeating one', () => {
    const keys = RATING_SOURCES.map((source) => source.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('displayRatings', () => {
  it('gives every scored source in the catalogue order', () => {
    const rows = displayRatings(SOME_RATINGS);

    expect(rows.map((row) => row.key)).toEqual(RATING_SOURCES.map((source) => source.key));
    expect(rows[0]).toEqual({
      key: 'letterboxd',
      label: 'Letterboxd',
      icon: RATING_SOURCES[0].icon,
      emoji: false,
      score: 60,
      display: '3.0',
      votes: 451636,
    });
  });

  // A source that has not scored the Movie yet is left out rather than shown
  // empty: a page that lists seven blanks says less than one that lists the
  // three sources that have answered.
  it('leaves out a source with no score', () => {
    const rows = displayRatings({ trakt: { score: 80, votes: 1 }, imdb: { score: null } });
    expect(rows.map((row) => row.key)).toEqual(['trakt']);
  });

  it('is empty where the Movie has no ratings at all', () => {
    expect(displayRatings(null)).toEqual([]);
    expect(displayRatings({ fetched_at: '2026-08-10' })).toEqual([]);
  });

  // A source that publishes no count gets none rather than a misleading zero,
  // which is the same rule the Campaign table's tooltips follow.
  it('carries a vote count only where there is one', () => {
    const [row] = displayRatings({ metacritic: { score: 71, votes: null } });
    expect(row.votes).toBe(null);
  });
});
