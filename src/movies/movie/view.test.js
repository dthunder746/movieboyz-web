import { describe, expect, it } from 'vitest';

import { buildMovieView, newestMeasuredDay } from './view.js';

const RATINGS = {
  fetched_at: '2026-08-10',
  imdb: { score: 65, votes: 97567 },
  letterboxd: { score: 60, votes: 451636 },
};

const MOVIE = {
  imdb_id: 'tt0427340',
  title: 'Masters of the Universe',
  release_date: '2026-06-05',
  budget: 200000000,
  estimated_budget: false,
  season: 'SUMMER',
  gross_td: 113782285,
  days_running: 77,
  gross: { '2026-06-05': 40000000 },
  weekly_gross: { '2026-W23': 54092230 },
  daily_change: { '2026-06-05': 40000000 },
  ratings: RATINGS,
  released_digital: '2026-07-21',
  status: 'SCHEDULED',
};

const OTHER = { imdb_id: 'tt9999999', title: 'Something Else', release_date: '2025-01-01' };

const SLICE_2025 = { release_year: 2025, latest_date: '2026-08-20', movies: [OTHER] };
const SLICE_2026 = { release_year: 2026, latest_date: '2026-08-21', movies: [MOVIE] };

function campaign(overrides = {}) {
  return {
    league_slug: 'movieboyz',
    league_name: 'MovieBoyz',
    year: 2026,
    state: 'active',
    roster: [{ user_id: 'emerson', username: 'Emerson' }],
    movies: [],
    ...overrides,
  };
}

function boardRow(overrides = {}) {
  return {
    imdb_id: MOVIE.imdb_id,
    title: MOVIE.title,
    release_date: MOVIE.release_date,
    season: 'SUMMER',
    budget: 200000000,
    breakeven: 400000000,
    user_id: 'emerson',
    pick_type: 'hit',
    draft_pick: 3,
    profit: {},
    profit_td: -286217715,
    ...overrides,
  };
}

describe('buildMovieView', () => {
  // The identifier is all the page is given, and which release year's slice
  // holds the Movie is not something a reader's URL can be asked to say.
  it('finds the Movie in whichever slice carries it', () => {
    const view = buildMovieView({
      imdbId: MOVIE.imdb_id,
      slices: [SLICE_2025, SLICE_2026],
      campaigns: [],
    });

    expect(view.found).toBe(true);
    expect(view.title).toBe('Masters of the Universe');
  });

  it('carries the facts a Movie is legible by', () => {
    const view = buildMovieView({ imdbId: MOVIE.imdb_id, slices: [SLICE_2026], campaigns: [] });

    expect(view).toMatchObject({
      imdbId: 'tt0427340',
      title: 'Masters of the Universe',
      releaseDate: '2026-06-05',
      releaseYear: 2026,
      season: 'SUMMER',
      seasonLabel: 'Summer',
      budget: 200000000,
      estimatedBudget: false,
      grossTd: 113782285,
      daysRunning: 77,
      releasedDigital: '2026-07-21',
      status: 'SCHEDULED',
    });
  });

  // Each slice's figures are measured on its own day (ADR 0008), so the page
  // reports the day the Movie's own slice was measured on rather than the
  // newest of the ones that happened to load.
  it('takes the measured day off the slice the Movie came out of', () => {
    const view = buildMovieView({
      imdbId: MOVIE.imdb_id,
      slices: [SLICE_2025, SLICE_2026],
      campaigns: [],
    });

    expect(view.measuredOn).toBe('2026-08-21');
  });

  it('hands the published series on for plotting', () => {
    const view = buildMovieView({ imdbId: MOVIE.imdb_id, slices: [SLICE_2026], campaigns: [] });

    expect(view.gross).toEqual({ '2026-06-05': 40000000 });
    expect(view.weeklyGross).toEqual({ '2026-W23': 54092230 });
  });

  it('gives the ratings that have answered, and when they were read', () => {
    const view = buildMovieView({ imdbId: MOVIE.imdb_id, slices: [SLICE_2026], campaigns: [] });

    expect(view.ratings.map((rating) => rating.key)).toEqual(['letterboxd', 'imdb']);
    expect(view.ratingsFetchedAt).toBe('2026-08-10');
  });

  // A Movie the reader asked for that is in no slice loaded. The page says so
  // rather than breaking, and it still knows what it was asked for.
  it('says it did not find a Movie no slice carries', () => {
    const view = buildMovieView({ imdbId: 'tt0000000', slices: [SLICE_2026], campaigns: [] });

    expect(view).toEqual({ found: false, imdbId: 'tt0000000' });
  });

  it('says it did not find one when no slice loaded at all', () => {
    expect(buildMovieView({ imdbId: 'tt1', slices: [], campaigns: [] }).found).toBe(false);
    expect(buildMovieView({ imdbId: 'tt1' }).found).toBe(false);
  });

  // A slice written before the identity fields carries the Movie without a
  // title or a release date (#60). The page is still legible: the id is the
  // only name it has, and the slice's own year is a real answer for the year.
  describe('given a Movie a slice carries no identity for', () => {
    const bare = { release_year: 2024, latest_date: '2026-08-21', movies: [{ imdb_id: 'tt1' }] };

    it('leaves the missing facts null rather than inventing them', () => {
      const view = buildMovieView({ imdbId: 'tt1', slices: [bare], campaigns: [] });

      expect(view.found).toBe(true);
      expect(view.title).toBe(null);
      expect(view.releaseDate).toBe(null);
      expect(view.season).toBe(null);
      expect(view.budget).toBe(null);
    });

    it('falls back to the slice year, which is what the file is keyed by', () => {
      expect(buildMovieView({ imdbId: 'tt1', slices: [bare], campaigns: [] }).releaseYear).toBe(2024);
    });

    // The contract's own default: tier 2's column is a non-nullable boolean, so
    // absent reads as not flagged rather than as unknown.
    it('reads an absent estimate flag as not flagged', () => {
      expect(buildMovieView({ imdbId: 'tt1', slices: [bare], campaigns: [] }).estimatedBudget)
        .toBe(false);
    });
  });
});

// The way back from a film to a contest. A Movie belongs to no League, so this
// is the one part of the page that reads League files at all, and a Movie
// nobody picked simply has none of them.
describe('buildMovieView picks', () => {
  it('names every Campaign whose Board holds the Movie as a Pick', () => {
    const view = buildMovieView({
      imdbId: MOVIE.imdb_id,
      slices: [SLICE_2026],
      campaigns: [campaign({ movies: [boardRow()] })],
    });

    expect(view.picks).toEqual([
      {
        leagueSlug: 'movieboyz',
        leagueName: 'MovieBoyz',
        year: 2026,
        state: 'active',
        campaignPath: 'league/movieboyz/2026/',
        userId: 'emerson',
        username: 'Emerson',
        pickType: 'hit',
        draftPick: 3,
        profitTd: -286217715,
        breakeven: 400000000,
      },
    ]);
  });

  // The Board carries every Movie in play for the year, picked or not, so a
  // Movie's presence on it is not a League having picked it.
  it('leaves out a Campaign whose Board carries the Movie unheld', () => {
    const view = buildMovieView({
      imdbId: MOVIE.imdb_id,
      slices: [SLICE_2026],
      campaigns: [campaign({ movies: [boardRow({ user_id: null, pick_type: null })] })],
    });

    expect(view.picks).toEqual([]);
  });

  it('leaves out a Campaign that never saw the Movie', () => {
    const view = buildMovieView({
      imdbId: MOVIE.imdb_id,
      slices: [SLICE_2026],
      campaigns: [campaign({ movies: [boardRow({ imdb_id: 'tt9999999' })] })],
    });

    expect(view.picks).toEqual([]);
  });

  // The Campaign artifact denormalizes the username onto its Roster and not
  // onto the Board row, so the holder's name is a Roster lookup.
  it('names the holder off the Roster', () => {
    const view = buildMovieView({
      imdbId: MOVIE.imdb_id,
      slices: [SLICE_2026],
      campaigns: [campaign({ roster: [], movies: [boardRow()] })],
    });

    // A Roster that does not name them still leaves the Pick, under the id.
    expect(view.picks[0]).toMatchObject({ userId: 'emerson', username: null });
  });

  it('reads newest year first, as the League thinks about its years', () => {
    const view = buildMovieView({
      imdbId: MOVIE.imdb_id,
      slices: [SLICE_2026],
      campaigns: [
        campaign({ year: 2025, movies: [boardRow()] }),
        campaign({ year: 2027, movies: [boardRow()] }),
        campaign({ year: 2026, movies: [boardRow()] }),
      ],
    });

    expect(view.picks.map((pick) => pick.year)).toEqual([2027, 2026, 2025]);
  });

  // The case that proves the page is League independent: a Movie the platform
  // tracks that no League ever picked still opens (#63).
  it('is empty for a Movie no League picked', () => {
    const view = buildMovieView({
      imdbId: MOVIE.imdb_id,
      slices: [SLICE_2026],
      campaigns: [],
    });

    expect(view.found).toBe(true);
    expect(view.picks).toEqual([]);
  });
});

// The stand-in measuring day for a Movie whose own slice has never been
// measured. A release year nothing in has opened publishes no `latest_date`,
// and without this every film in it reads as unpublished rather than unreleased.
describe('newestMeasuredDay', () => {
  it('takes the newest day any slice was measured on', () => {
    const days = newestMeasuredDay([
      { latest_date: '2026-08-19' },
      { latest_date: '2026-08-22' },
      { latest_date: '2025-12-31' },
    ]);

    expect(days).toBe('2026-08-22');
  });

  it('ignores a slice that has never been measured', () => {
    const days = newestMeasuredDay([
      { latest_date: null },
      { latest_date: '2026-08-19' },
      {},
    ]);

    expect(days).toBe('2026-08-19');
  });

  it('answers null when nothing loaded has been measured', () => {
    expect(newestMeasuredDay([{ latest_date: null }, {}])).toBe(null);
    expect(newestMeasuredDay([])).toBe(null);
    expect(newestMeasuredDay(undefined)).toBe(null);
  });
});
