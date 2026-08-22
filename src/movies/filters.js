// What the Movies page is showing: a title search, a set of release years and a
// set of Seasons. Pure state, no DOM. The toolbar, the table and the chart all
// read back through `snapshot` and `filter` rather than each keeping a copy.
//
// Three dimensions where the Campaign page has seven. Everything it filters on
// beyond these belongs to a League (who holds the Pick, its type, whether it is
// in profit), and this page has no League (#62).

// Season is a closed set of three the platform derives from a release date, so
// the chips for it are fixed where the year chips come from the Manifest. The
// set itself lives with the row shape that carries it.
import { SEASONS } from './rows.js';

const DEFAULT = {
  search: '',
  years: null, // null means every year; a Set means only these.
  seasons: null, // and the same for Seasons.
};

function isDefault(state) {
  return state.search === '' && state.years === null && state.seasons === null;
}

function matchSearch(row, query) {
  if (!query) return true;
  // A Movie whose slice predates the identity fields has no title to match, so
  // a search hides it rather than showing every unsearchable row alongside the
  // hits (#60).
  return (row.title || '').toLowerCase().includes(query.toLowerCase());
}

function matchYear(row, years) {
  if (!years) return true;
  return years.has(row.releaseYear);
}

// A Movie from a slice written before `season` is in no Season, so a Season
// filter hides it rather than showing it under a label it does not carry
// (#60), which is the rule the title search already follows.
function matchSeason(row, seasons) {
  if (!seasons) return true;
  return row.season !== null && row.season !== undefined && seasons.has(row.season);
}

// The chips come from the Manifest rather than from the rows, so a year the
// platform has published shows up as an offer even before its slice arrives,
// and a new year needs no code change (#62). Newest first, which is the order
// the League thinks about them in.
export function publishedYears(manifest) {
  return [...(manifest?.movie_years || [])].sort((a, b) => b - a);
}

export function createMovieFilters(opts) {
  const state = { ...DEFAULT };
  const onChange = (opts && opts.onChange) || (() => {});

  function snapshot() {
    return {
      search: state.search,
      years: state.years ? [...state.years].sort((a, b) => b - a) : null,
      seasons: state.seasons
        ? SEASONS.filter((season) => state.seasons.has(season))
        : null,
      isDefault: isDefault(state),
    };
  }

  function notify() {
    onChange(snapshot());
  }

  return {
    snapshot,

    setSearch(query) {
      state.search = query || '';
      notify();
    },

    // Toggling the last year off means "no opinion", which is the same as every
    // year being allowed. Collapsing the empty Set back to null keeps that one
    // state rather than two that behave alike.
    toggleYear(year) {
      if (state.years === null) state.years = new Set();
      if (state.years.has(year)) state.years.delete(year);
      else state.years.add(year);
      if (state.years.size === 0) state.years = null;
      notify();
    },

    setYears(years) {
      state.years = years && years.length ? new Set(years) : null;
      notify();
    },

    clearYears() {
      state.years = null;
      notify();
    },

    // The year chips' rule, on the other set: the last Season toggled off is no
    // opinion rather than no Season.
    toggleSeason(season) {
      if (state.seasons === null) state.seasons = new Set();
      if (state.seasons.has(season)) state.seasons.delete(season);
      else state.seasons.add(season);
      if (state.seasons.size === 0) state.seasons = null;
      notify();
    },

    clearSeasons() {
      state.seasons = null;
      notify();
    },

    clearAll() {
      state.search = '';
      state.years = null;
      state.seasons = null;
      notify();
    },

    filter(rows) {
      return (rows || []).filter(
        (row) => matchSearch(row, state.search)
          && matchYear(row, state.years)
          && matchSeason(row, state.seasons),
      );
    },
  };
}
