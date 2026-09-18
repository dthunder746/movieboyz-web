// The year-long Picks: the five hits and the five bombs, and what the tab that
// makes them editable is allowed to offer in exchange (#89).
//
// They were locked everywhere until now, and the reason was the sidebar rather
// than the rule. A Season board offers the unheld Movies of that Season, and a
// year-long Pick is not bound to one: four of the 2026 hits open in Summer and
// the bombs span all three Seasons. A tab that is not a Season is the way out,
// so the pool here is the whole year rather than one Season of it.
//
// Pure: no fetching, no DOM.

import {
  ghostRowFrom,
  profitRanksForSeason,
  releasedOf,
  unreleasedOf,
} from './season-helpers.js';
import { initialSeason, SEASON_ORDER } from './board.js';

// Not a Season, deliberately. The Campaign publishes three and this is a fourth
// tab over the same Board, so it needs a key the Season checks fail on rather
// than a fourth value they would have to start accepting.
export const YEAR_TAB = 'YEAR';

export const YEAR_TAB_LABEL = 'Hits & Bombs';

export function isYearTab(tab) {
  return tab === YEAR_TAB;
}

// Every tab the draft page draws, in the order they are shown. The year tab
// sits last because it is a reading of Picks the three Season boards have
// already shown, not a fourth part of the draft.
export const TAB_ORDER = [...SEASON_ORDER, YEAR_TAB];

// Which tab the page opens on, with the reader's last choice still winning.
// It wraps the Season rule rather than replacing it: `initialSeason` checks a
// cookie against the Seasons that exist, and the year tab is not one of them.
export function initialTab(saved, latestDate, boundaries) {
  if (isYearTab(saved)) return saved;
  return initialSeason(saved, latestDate, boundaries);
}

// Which draft date a tab is measured against. Every year-long Pick was taken at
// the Winter draft, so the year tab reads and writes Winter's date: changing it
// in the banner changes what both boards would have had available.
export function draftDateSeasonFor(tab) {
  return isYearTab(tab) ? 'WINTER' : tab;
}

function isYearLong(row) {
  const type = (row.pickType || '').toLowerCase();
  return type === 'hit' || type === 'bomb';
}

// Whether a Pick is dimmed and refused where it is being drawn. The ten
// year-long Picks appear twice: on the Winter board, in true draft order and
// locked as they have always been, and on the year tab, where they are the
// subject and the only thing editable. Same rows, two readings.
export function lockedOnBoard(row, tab) {
  if (isYearTab(tab)) return false;
  return isYearLong(row);
}

// The ten slots the tab draws, hits then bombs and each in the order it was
// taken. Not one run of draft order: the tab's subject is the two kinds, and
// the Winter board next door is where the interleaving can be read. An emptied
// slot keeps its place so it can be filled again, exactly as on a Season board.
export function yearLongPicks(view) {
  const real = (view.rows || []).filter(
    (row) => row.draftPick != null && row.userId != null && isYearLong(row),
  );

  const ghosts = (view.ghostSlots || [])
    .filter((slot) => isYearLong(slot))
    .map(ghostRowFrom);

  const order = (pick) => ((pick.pickType || '').toLowerCase() === 'hit' ? 0 : 1);

  return [...real, ...ghosts].sort((left, right) => {
    if (order(left) !== order(right)) return order(left) - order(right);
    return left.draftPick - right.draftPick;
  });
}

// Everything that was on the table at the Winter draft, whoever holds it now.
//
// Both kinds on this tab are made at the first draft of the year: the hits are
// the very first Picks anybody makes, and the bombs are taken in the same
// draft. Nobody held anything yet, so at that moment every film of the year
// was available, including the ones that later became somebody's seasonal or
// alt. That is what the pool is: the whole year minus the ten Picks the tab is
// already drawing as its slots.
//
// A film already in cinemas on draft day was never available to take, so it is
// filtered out here rather than dimmed the way a Season sidebar dims one: a
// dimmed row nobody may click would be 19 of them on the 2026 Board for no
// reader benefit. A film with no date yet had certainly not opened, so it
// stays in.
function offeredForYear(view, draftDate) {
  return (view.rows || []).filter((row) => {
    if (isYearLong(row)) return false;
    if (!draftDate) return true;
    if (!row.releaseDate || row.releaseDate === 'TBA') return true;
    return row.releaseDate >= draftDate;
  });
}

// Split on whether they have opened, the same question the Season sidebar's two
// cards answer and the same split, applied to the year's pool instead of a
// Season's (`releasedOf` and `unreleasedOf` in `season-helpers.js`).
export function yearReleasedCandidates(view, draftDate, today) {
  return releasedOf(offeredForYear(view, draftDate), today);
}

export function yearUnreleasedCandidates(view, draftDate, today) {
  return unreleasedOf(offeredForYear(view, draftDate), today);
}

// Every Movie's rank within its own Season, in one lookup. The year tab mixes
// the Seasons in a single table, and a rank is only meaningful against the
// Season the film opened in, so the three maps are merged rather than a fourth
// ranking being invented over the whole year.
export function profitRanksEverySeason(view) {
  const ranks = {};
  for (const season of SEASON_ORDER) {
    Object.assign(ranks, profitRanksForSeason(view, season));
  }
  return ranks;
}
