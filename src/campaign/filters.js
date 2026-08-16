// Filter state: the single source of truth for every dimension the toolbar
// exposes. Pure state, no DOM. The toolbar, the table and the cards all
// subscribe through `onChange` and read back through `snapshot` and `filter`.
//
// Filters run over Board rows, so `filter` takes rows and returns the imdb ids
// that survive.

const DEFAULT = {
  search: '',
  users: null, // null means every User; a Set means only these.
  pickTypes: null, // null means every type; a Set means only these.
  releaseFrom: '',
  releaseTo: '',
  released: 'all', // 'all' | 'released' | 'upcoming'
  profitability: 'all', // 'all' | 'profitable' | 'red'
  showUnowned: false,
};

const RELEASED_STATUSES = ['all', 'released', 'upcoming'];
const PROFITABILITY_MODES = ['all', 'profitable', 'red'];

function clone(state) {
  return {
    ...state,
    users: state.users ? new Set(state.users) : null,
    pickTypes: state.pickTypes ? new Set(state.pickTypes) : null,
  };
}

function isDefault(state) {
  return state.search === ''
    && state.users === null
    && state.pickTypes === null
    && state.releaseFrom === ''
    && state.releaseTo === ''
    && state.released === 'all'
    && state.profitability === 'all'
    && state.showUnowned === false;
}

// One per dimension, however many values it holds: the badge counts the ways
// the table has been narrowed, not the individual choices inside them.
function activeDimensionCount(state) {
  let count = 0;
  if (state.search !== '') count += 1;
  if (state.users !== null) count += 1;
  if (state.pickTypes !== null) count += 1;
  if (state.releaseFrom || state.releaseTo) count += 1;
  if (state.released !== 'all') count += 1;
  if (state.profitability !== 'all') count += 1;
  if (state.showUnowned) count += 1;
  return count;
}

function matchSearch(row, query) {
  if (!query) return true;
  return (row.title || '').toLowerCase().includes(query.toLowerCase());
}

function matchUser(row, users) {
  if (!users) return true;
  return users.has(row.userId);
}

function matchPickType(row, pickTypes) {
  if (!pickTypes) return true;
  return pickTypes.has((row.pickType || '').toLowerCase());
}

function matchReleaseRange(row, from, to) {
  if (!from && !to) return true;
  const date = row.releaseDate;
  // A Movie with no announced date cannot be inside a range. The Board rule
  // should keep these off the page entirely, but the old data carried 'TBA' and
  // the filter stays tolerant of it.
  if (!date || date === 'TBA') return false;
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

function matchReleasedStatus(row, status, latestDate) {
  if (status === 'all') return true;
  const date = row.releaseDate;
  if (!date || date === 'TBA') return status === 'upcoming';
  if (!latestDate) return false;
  return status === 'released' ? date <= latestDate : date > latestDate;
}

function matchProfitability(row, mode) {
  if (mode === 'all') return true;
  // No Profit yet is not the same as breaking even, so neither side claims it.
  if (row.profitTd === null || row.profitTd === undefined) return false;
  return mode === 'profitable' ? row.profitTd > 0 : row.profitTd < 0;
}

// The Board is the whole year but the page opens on the League, so Movies
// nobody holds stay hidden until asked for. An explicit User filter is already
// a statement about who to show, so it answers this question itself.
function matchUnowned(row, showUnowned, hasUserFilter) {
  if (hasUserFilter) return true;
  return row.userId !== null || showUnowned;
}

export function createFilterState(opts) {
  let state = clone(DEFAULT);
  const onChange = (opts && opts.onChange) || (() => {});

  function snapshot() {
    return {
      search: state.search,
      users: state.users ? [...state.users] : null,
      pickTypes: state.pickTypes ? [...state.pickTypes] : null,
      releaseFrom: state.releaseFrom,
      releaseTo: state.releaseTo,
      released: state.released,
      profitability: state.profitability,
      showUnowned: state.showUnowned,
      activeCount: activeDimensionCount(state),
      isDefault: isDefault(state),
    };
  }

  function notify() {
    onChange(snapshot());
  }

  // Toggling the last value off means "no opinion", which is the same as every
  // value being allowed. Collapsing an empty Set back to null keeps that one
  // state rather than two that behave alike but count differently.
  function toggleIn(key, value) {
    if (state[key] === null) state[key] = new Set();
    if (state[key].has(value)) state[key].delete(value);
    else state[key].add(value);
    if (state[key].size === 0) state[key] = null;
    notify();
  }

  return {
    snapshot,

    setSearch(query) {
      state.search = query || '';
      notify();
    },

    toggleUser(userId) {
      toggleIn('users', userId);
    },

    setUsers(userIds) {
      state.users = userIds && userIds.length ? new Set(userIds) : null;
      notify();
    },

    clearUsers() {
      state.users = null;
      notify();
    },

    togglePickType(pickType) {
      toggleIn('pickTypes', (pickType || '').toLowerCase());
    },

    clearPickTypes() {
      state.pickTypes = null;
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

    setProfitability(mode) {
      if (!PROFITABILITY_MODES.includes(mode)) return;
      state.profitability = mode;
      notify();
    },

    setShowUnowned(show) {
      state.showUnowned = !!show;
      notify();
    },

    clearAll() {
      state = clone(DEFAULT);
      notify();
    },

    clearDimension(name) {
      switch (name) {
        case 'search': state.search = ''; break;
        case 'users': state.users = null; break;
        case 'pickTypes': state.pickTypes = null; break;
        case 'releaseRange': state.releaseFrom = ''; state.releaseTo = ''; break;
        case 'released': state.released = 'all'; break;
        case 'profitability': state.profitability = 'all'; break;
        case 'unowned': state.showUnowned = false; break;
        default: return;
      }
      notify();
    },

    filter(rows, latestDate) {
      const hasUserFilter = state.users !== null;
      return (rows || [])
        .filter((row) => matchSearch(row, state.search)
          && matchUser(row, state.users)
          && matchPickType(row, state.pickTypes)
          && matchReleaseRange(row, state.releaseFrom, state.releaseTo)
          && matchReleasedStatus(row, state.released, latestDate)
          && matchProfitability(row, state.profitability)
          && matchUnowned(row, state.showUnowned, hasUserFilter))
        .map((row) => row.imdbId);
    },
  };
}
