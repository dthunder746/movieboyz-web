// The Movies page's filter sections, and the labels on its active chips.
//
// The Filters button, the panel's folding and the chips row itself are the
// shared shell's (`shared/filters-shell.js`), and the search, the date range
// and the Released segment are the shared sections
// (`shared/filter-sections.js`). What is here is what only this page filters
// by: the release year and the Season (#161).
//
// This module holds no filter state of its own. Every control pushes into
// `filters.js` and every repaint reads back out of it, so the panel and the
// chips cannot disagree with what the table is actually showing. It is
// `campaign/toolbar.js` with the League taken out.

import {
  bindDateRange,
  bindReleasedStatus,
  bindSearch,
  dateSection,
  releasedSection,
  searchSection,
  syncDateRange,
  syncSearch,
  syncSegmented,
} from '../shared/filter-sections.js';
import { createFilterShell } from '../shared/filters-shell.js';

import { publishedYears } from './filters.js';
import { SEASONS, SEASON_LABELS } from './rows.js';

const SEARCH_DEBOUNCE_MS = 150;

export function createToolbar({ filters, manifest }) {
  // The years the platform has published, newest first, which is the order the
  // League thinks about them in. No "All" chip: every chip off already means
  // every year, the way the Campaign's Owner and Pick type rows read.
  const years = publishedYears(manifest);

  // ── Panel sections ──────────────────────────────────────────────────────

  function yearSection(snapshot) {
    const active = snapshot.years ? new Set(snapshot.years) : null;
    const chips = years.map((year) => {
      const on = active !== null && active.has(year);
      return `<button class="filter-chip-toggle${on ? ' on' : ''}"`
        + ` data-year="${year}" type="button">${year}</button>`;
    }).join('');

    return '<div class="filter-row"><span class="filter-label">Release year</span>'
      + `<div class="filter-chips-toggle">${chips}</div></div>`;
  }

  // Season's three are fixed where the years are published, because a Season is
  // one of three the platform derives from a release date rather than a file it
  // writes (decision 2 of the parent spec, #58).
  function seasonSection(snapshot) {
    const active = snapshot.seasons ? new Set(snapshot.seasons) : null;
    const chips = SEASONS.map((season) => {
      const on = active !== null && active.has(season);
      return `<button class="filter-chip-toggle${on ? ' on' : ''}"`
        + ` data-season="${season}" type="button">${SEASON_LABELS[season]}</button>`;
    }).join('');

    return '<div class="filter-row"><span class="filter-label">Season</span>'
      + `<div class="filter-chips-toggle">${chips}</div></div>`;
  }

  // The Campaign bundles this button in beside its unowned checkbox; this page
  // has nothing to put next to it, so the row is the button alone.
  function clearAllSection() {
    return '<div class="filter-row">'
      + '<button id="filter-clear-all" class="btn btn-link btn-sm ms-auto" type="button"'
      + ' style="font-size:0.8rem">Clear all filters</button>'
      + '</div>';
  }

  // Repaint the open panel in place rather than rebuilding it, so an input the
  // reader is mid-way through typing in keeps its focus and its caret.
  function syncPanel(panel, snapshot) {
    const activeYears = snapshot.years ? new Set(snapshot.years) : null;
    const activeSeasons = snapshot.seasons ? new Set(snapshot.seasons) : null;

    for (const button of panel.querySelectorAll('[data-year]')) {
      button.classList.toggle('on', !!activeYears && activeYears.has(Number(button.dataset.year)));
    }
    for (const button of panel.querySelectorAll('[data-season]')) {
      button.classList.toggle('on', !!activeSeasons && activeSeasons.has(button.dataset.season));
    }
    syncSegmented(panel, 'released-status', snapshot.released);
    syncDateRange(panel, snapshot);
    syncSearch(panel, snapshot);
  }

  function bindPanel(panel) {
    panel.addEventListener('click', (event) => {
      const yearButton = event.target.closest('[data-year]');
      // A year is a number everywhere else on the page, so it is parsed here
      // rather than leaving the filter to hold a string for one chip and a
      // number for the rest.
      if (yearButton) return filters.toggleYear(parseInt(yearButton.dataset.year, 10));

      const seasonButton = event.target.closest('[data-season]');
      if (seasonButton) return filters.toggleSeason(seasonButton.dataset.season);

      if (event.target.id === 'filter-clear-all') filters.clearAll();
      return undefined;
    });

    bindReleasedStatus(panel, filters);
    bindDateRange(panel, filters);
    bindSearch(panel, filters, SEARCH_DEBOUNCE_MS);
  }

  // ── Chips ───────────────────────────────────────────────────────────────

  // One chip per narrowed dimension, and the key on it is the one
  // `clearDimension` takes, so its cross clears exactly what it names. Years
  // are listed while there are few enough to read and counted after that, which
  // is the rule the Campaign's Owner chip follows.
  function chipsForSnapshot(snapshot) {
    const chips = [];

    if (snapshot.search) chips.push({ key: 'search', label: `Search: "${snapshot.search}"` });

    if (snapshot.years && snapshot.years.length > 0) {
      chips.push({
        key: 'years',
        label: snapshot.years.length <= 2
          ? `Years: ${snapshot.years.join(', ')}`
          : `Years: ${snapshot.years.length}`,
      });
    }

    if (snapshot.seasons && snapshot.seasons.length > 0) {
      const names = snapshot.seasons.map((season) => SEASON_LABELS[season] ?? season);
      chips.push({ key: 'seasons', label: `Seasons: ${names.join(', ')}` });
    }

    if (snapshot.releaseFrom || snapshot.releaseTo) {
      chips.push({
        key: 'releaseRange',
        label: `Released: ${snapshot.releaseFrom || '…'} to ${snapshot.releaseTo || '…'}`,
      });
    }

    if (snapshot.released !== 'all') {
      chips.push({
        key: 'released',
        label: snapshot.released === 'released' ? 'Released only' : 'Upcoming only',
      });
    }

    return chips;
  }

  return createFilterShell({
    filters,
    sections: [
      searchSection,
      yearSection,
      seasonSection,
      dateSection,
      releasedSection,
      clearAllSection,
    ],
    chipsFor: chipsForSnapshot,
    bindPanel,
    syncPanel,
  });
}
