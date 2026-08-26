// What-if mode's state: which Picks the reader has moved around, and the
// settings that go with it.
//
// Ported from the old site's `js/draft/whatif-store.js`. Two things changed,
// and both follow from the page now having an address per Campaign rather than
// being the one 2026 file (#85):
//
// - **The keys are scoped to the Campaign.** The old page was the only draft
//   page there would ever be, so it wrote to bare `mb_whatif_*` keys. With a
//   page per year those keys would put 2026's swaps on 2027's board, where the
//   IMDB ids name Movies that year never had.
// - **The default draft date is the Campaign's own year.** The old file seeded
//   `{ WINTER: '2026-01-31' }`, the day that year's Winter draft was actually
//   held. Nothing publishes a draft date, so the port keeps the seed and takes
//   the year off the Campaign instead of the source. It is a starting value the
//   reader can change, and it is what stops what-if drafting a film that had
//   already opened.
//
// The state lives in the module and is announced by subscription. `applyToRows`
// is the half that decides anything, and it is pure, so it is the half with a
// test beside it.

const KEYS = {
  enabled: 'mb_whatif_enabled',
  swaps: 'mb_whatif_swaps',
  hideLocked: 'mb_whatif_hide_locked',
  draftDates: 'mb_whatif_draft_dates',
};

let scope = '';

const state = {
  enabled: false,
  swaps: [],
  hideLocked: false,
  draftDates: {},
};

let lastOp = null;
const listeners = [];

function key(name) {
  return scope ? `${KEYS[name]}:${scope}` : KEYS[name];
}

function notify() {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.error(error);
    }
  }
}

function persist() {
  try {
    localStorage.setItem(key('enabled'), state.enabled ? '1' : '0');
    localStorage.setItem(key('swaps'), JSON.stringify(state.swaps));
    localStorage.setItem(key('hideLocked'), state.hideLocked ? '1' : '0');
    localStorage.setItem(key('draftDates'), JSON.stringify(state.draftDates));
  } catch (error) {
    console.warn('whatif-store: persist failed', error);
  }
}

// Read this Campaign's saved state back. `year` seeds the Winter draft date the
// first time this Campaign is opened, and only then: once the key exists, an
// empty object is the reader having cleared it rather than never having set it.
export function hydrate({ leagueSlug, year }) {
  scope = `${leagueSlug}:${year}`;

  try {
    state.enabled = localStorage.getItem(key('enabled')) === '1';

    const rawSwaps = localStorage.getItem(key('swaps'));
    state.swaps = rawSwaps ? JSON.parse(rawSwaps) : [];
    if (!Array.isArray(state.swaps)) state.swaps = [];

    state.hideLocked = localStorage.getItem(key('hideLocked')) === '1';

    const rawDates = localStorage.getItem(key('draftDates'));
    if (rawDates === null) {
      state.draftDates = year ? { WINTER: `${year}-01-31` } : {};
      try {
        localStorage.setItem(key('draftDates'), JSON.stringify(state.draftDates));
      } catch {
        // A storage that will not take a write still reads correctly for this
        // page load, which is all the seed is for.
      }
    } else {
      const parsed = JSON.parse(rawDates);
      state.draftDates = parsed && typeof parsed === 'object' ? parsed : {};
    }
  } catch {
    state.enabled = false;
    state.swaps = [];
    state.hideLocked = false;
    state.draftDates = {};
  }
}

export function getState() {
  return { enabled: state.enabled, swaps: state.swaps.slice(), hideLocked: state.hideLocked };
}

export function setHideLocked(value) {
  const next = Boolean(value);
  if (state.hideLocked === next) return;
  state.hideLocked = next;
  lastOp = 'hideLocked';
  persist();
  notify();
}

export function getDraftDate(season) {
  if (!season) return null;
  return state.draftDates[season] || null;
}

export function setDraftDate(season, isoDate) {
  if (!season) return;
  const next = isoDate || null;
  if ((state.draftDates[season] || null) === next) return;
  if (next === null) delete state.draftDates[season];
  else state.draftDates[season] = next;
  lastOp = 'draftDate';
  persist();
  notify();
}

export function enable() {
  if (state.enabled) return;
  state.enabled = true;
  lastOp = 'enable';
  persist();
  notify();
}

export function disable() {
  if (!state.enabled && state.swaps.length === 0) return;
  state.enabled = false;
  state.swaps = [];
  lastOp = 'disable';
  persist();
  notify();
}

export function pushSwap(slotImdbId, replacementImdbId, season) {
  if (!slotImdbId || !replacementImdbId || slotImdbId === replacementImdbId) return;
  state.swaps.push({ slotImdbId, replacementImdbId, season });
  lastOp = 'swap';
  persist();
  notify();
}

export function pushClear(slotImdbId, season) {
  if (!slotImdbId) return;
  state.swaps.push({ slotImdbId, replacementImdbId: null, season });
  lastOp = 'clear';
  persist();
  notify();
}

export function pushFill(clearedImdbId, originalSlot, replacementImdbId, season) {
  if (!originalSlot || !replacementImdbId) return;
  state.swaps.push({
    kind: 'fill',
    clearedImdbId: clearedImdbId || null,
    replacementImdbId,
    season,
    originalSlot: {
      userId: originalSlot.userId,
      pickType: originalSlot.pickType,
      draftPick: originalSlot.draftPick,
    },
  });
  lastOp = 'fill';
  persist();
  notify();
}

export function undo() {
  if (state.swaps.length === 0) return;
  state.swaps.pop();
  lastOp = 'undo';
  persist();
  notify();
}

export function reset() {
  if (state.swaps.length === 0) return;
  state.swaps = [];
  lastOp = 'reset';
  persist();
  notify();
}

export function getLastOp() {
  return lastOp;
}

export function subscribe(listener) {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index !== -1) listeners.splice(index, 1);
  };
}

export function getAffectedImdbIds() {
  const ids = {};
  for (const swap of state.swaps) {
    if (swap.slotImdbId) ids[swap.slotImdbId] = true;
    if (swap.replacementImdbId) ids[swap.replacementImdbId] = true;
  }
  return ids;
}

// The Board as the swaps make it. Pure, and the only part of what-if mode that
// decides anything: everything else is storage and paint.
//
// A swap moves who holds a slot, never the Movie's own figures — Profit and
// Breakeven belong to the film, and the question the mode asks is what a Slate
// would have been worth holding a different one. Clearing a slot leaves a
// **ghost**: the slot still exists in the draft order and can be filled again,
// so it has to survive as something the board can render.
//
// A swap naming a Movie this Board does not carry is skipped rather than
// dropped. The stored swaps outlive a republish, and a Campaign can lose a
// Movie (ADR 0012), so the reader's other swaps should not go with it.
export function applyToRows(rows, swaps, usernames = new Map()) {
  if (!swaps || swaps.length === 0) return { rows, ghostSlots: [] };

  const byId = new Map(rows.map((row) => [row.imdbId, row]));
  let ghostSlots = [];

  // A filled slot takes the holder off the ghost, which stores an id and not a
  // name. Every other path carries the pairing along with the row it came from.
  const nameFor = (userId) => (userId == null ? null : (usernames.get(userId) ?? userId));

  for (const entry of swaps) {
    if (entry.kind === 'fill') {
      const replacement = byId.get(entry.replacementImdbId);
      if (!replacement) {
        console.warn('whatif-store: fill skipped, missing replacement', entry);
        continue;
      }
      byId.set(entry.replacementImdbId, {
        ...replacement,
        userId: entry.originalSlot.userId,
        username: nameFor(entry.originalSlot.userId),
        pickType: entry.originalSlot.pickType,
        draftPick: entry.originalSlot.draftPick,
      });
      ghostSlots = ghostSlots.filter(
        (ghost) =>
          !(ghost.userId === entry.originalSlot.userId
            && ghost.pickType === entry.originalSlot.pickType
            && ghost.draftPick === entry.originalSlot.draftPick),
      );
      continue;
    }

    const slot = byId.get(entry.slotImdbId);
    if (!slot) {
      console.warn('whatif-store: entry skipped, missing slot movie', entry);
      continue;
    }

    if (!entry.replacementImdbId) {
      if (slot.userId != null && slot.pickType != null) {
        ghostSlots.push({
          userId: slot.userId,
          username: slot.username,
          pickType: slot.pickType,
          draftPick: slot.draftPick,
          season: slot.season,
          clearedImdbId: entry.slotImdbId,
          clearedTitle: slot.title,
        });
      }
      byId.set(entry.slotImdbId, { ...slot, userId: null, username: null, pickType: null, draftPick: null });
      continue;
    }

    const replacement = byId.get(entry.replacementImdbId);
    if (!replacement) {
      console.warn('whatif-store: swap skipped, missing replacement', entry);
      continue;
    }

    byId.set(entry.slotImdbId, {
      ...slot,
      userId: replacement.userId,
      username: replacement.username,
      pickType: replacement.pickType,
      draftPick: replacement.draftPick,
    });
    byId.set(entry.replacementImdbId, {
      ...replacement,
      userId: slot.userId,
      username: slot.username,
      pickType: slot.pickType,
      draftPick: slot.draftPick,
    });
  }

  // Rebuilt in the Board's own order rather than the Map's, so a swap never
  // reshuffles rows that were not part of it.
  return { rows: rows.map((row) => byId.get(row.imdbId)), ghostSlots };
}

// The Board plus whatever what-if has done to it, which is what every renderer
// on the page draws from.
export function viewOf(board) {
  const usernames = new Map((board.users || []).map((user) => [user.userId, user.username]));
  const { rows, ghostSlots } = applyToRows(board.rows, state.swaps, usernames);
  return { ...board, rows, ghostSlots };
}
