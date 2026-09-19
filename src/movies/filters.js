// What the Movies page is showing: a title search, a set of release years, a
// set of Seasons, a release date range and whether a Movie is out yet. Pure
// state, no DOM. The toolbar, the table and the chart all read back through
// `snapshot` and `filter` rather than each keeping a copy.
//
// Five dimensions where the Campaign page has seven. The two it has beyond
// these belong to a League (who holds the Pick and its type, whether it is in
// profit), and this page has no League (#62). The range and the released
// segment are the Campaign's own, semantics verbatim, because the question a
// reader is asking is the same one whichever page they ask it on (#161).

// Season is a closed set of three the platform derives from a release date, so
// the chips for it are fixed where the year chips come from the Manifest. The
// set itself lives with the row shape that carries it.
import { SEASONS } from './rows.js';

const DEFAULT = {
  search: '',
  years: null, // null means every year; a Set means only these.
  seasons: null, // and the same for Seasons.
  releaseFrom: '',
  releaseTo: '',
  released: 'all', // 'all' | 'released' | 'upcoming'
};

const RELEASED_STATUSES = ['all', 'released', 'upcoming'];

function isDefault(state) {
  return state.search === ''
    && state.years === null
    && state.seasons === null
    && state.releaseFrom === ''
    && state.releaseTo === ''
    && state.released === 'all';
}

// One per dimension, however many values it holds: the badge counts the ways
// the list has been narrowed, not the individual choices inside them. A range
// with one open end is still one narrowing.
function activeDimensionCount(state) {
  let count = 0;
  if (state.search !== '') count += 1;
  if (state.years !== null) count += 1;
  if (state.seasons !== null) count += 1;
  if (state.releaseFrom || state.releaseTo) count += 1;
  if (state.released !== 'all') count += 1;
  return count;
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

function matchReleaseRange(row, from, to) {
  if (!from && !to) return true;
  const date = row.releaseDate;
  // A Movie with no announced date cannot be inside a range: the reader asked
  // for a window of the calendar. Old slices carried 'TBA' where newer ones
  // carry null, so both are tolerated.
  if (!date || date === 'TBA') return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

// "Out yet" is read against the latest box office day the page knows rather
// than today's date, so the answer agrees with the figures beside it.
function matchReleasedStatus(row, status, latestDate) {
  if (status === 'all') return true;
  const date = row.releaseDate;
  if (!date || date === 'TBA') return status === 'upcoming';
  if (!latestDate) return false;
  return status === 'released' ? date <= latestDate : date > latestDate;
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
      releaseFrom: state.releaseFrom,
      releaseTo: state.releaseTo,
      released: state.released,
      activeCount: activeDimensionCount(state),
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

    setReleaseRange(from, to) {
      state.releaseFrom = from || '';
      state.releaseTo = to || '';
      notify();
    },

    clearReleaseRange() {
      state.releaseFrom = '';
      state.releaseTo = '';
      notify();
    },

    setReleasedStatus(status) {
      if (!RELEASED_STATUSES.includes(status)) return;
      state.released = status;
      notify();
    },

    clearAll() {
      state.search = '';
      state.years = null;
      state.seasons = null;
      state.releaseFrom = '';
      state.releaseTo = '';
      state.released = 'all';
      notify();
    },

    // The key a chip on the active row carries, handed straight back, so the
    // cross on it and the dimension it clears cannot drift apart.
    clearDimension(name) {
      switch (name) {
        case 'search': state.search = ''; break;
        case 'years': state.years = null; break;
        case 'seasons': state.seasons = null; break;
        case 'releaseRange': state.releaseFrom = ''; state.releaseTo = ''; break;
        case 'released': state.released = 'all'; break;
        default: return;
      }
      notify();
    },

    // `latestDate` is the newest box office day the page has loaded, which is
    // what "released" is measured against.
    filter(rows, latestDate) {
      return (rows || []).filter(
        (row) => matchSearch(row, state.search)
          && matchYear(row, state.years)
          && matchSeason(row, state.seasons)
          && matchReleaseRange(row, state.releaseFrom, state.releaseTo)
          && matchReleasedStatus(row, state.released, latestDate),
      );
    },
  };
}
