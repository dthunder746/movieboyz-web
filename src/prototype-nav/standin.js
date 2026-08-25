// PROTOTYPE — throwaway. What sits under the bar.
//
// A bar judged over an empty page looks fine in every variant, so each page the
// nav can sit on gets a stand-in with roughly the density the real one has. It
// is the same for all three variants on purpose: nothing here is being judged,
// it is there so the bar is not floating in a vacuum.
//
// The Campaign stand-in carries the in page `Draft` link #81 settled, because
// whether the bar's Draft entry is redundant next to it is a real question the
// layout has to answer — and in the two modes that drop Draft from the menu, it
// is the only way between a year's two pages.
//
// It is a pair of links and not a tab strip. A Campaign is one page plus a
// draft page: there is no Standings/Board split, and `board.js` is the join
// behind the movie table rather than a section of its own.

import { escapeHtml } from '../shared/format.js';

const PLAYERS = [
  ['Marcus', '$412.6M', '+$118.2M'],
  ['Chris', '$389.1M', '+$74.9M'],
  ['Emerson', '$355.4M', '+$12.7M'],
  ['Connie', '$298.0M', '−$41.3M'],
  ['Matt', '$276.8M', '−$88.5M'],
];

export function renderStandin(model) {
  const { here } = model;
  const league = model.leagues.find((entry) => entry.slug === here.leagueSlug);
  const leagueName = league ? league.name : 'League';
  const state = league?.years.find((entry) => entry.year === here.year)?.state;

  if (here.kind === 'campaign') return campaign(leagueName, here.year, 'standings', state);
  if (here.kind === 'draft') return campaign(leagueName, here.year, 'draft', state);
  if (here.kind === 'landing') return landing(leagueName);
  if (here.kind === 'movies') return movies();
  return '';
}

function campaign(leagueName, year, page, state) {
  const draft = page === 'draft';

  // The way between a year's two pages, and the whole of it. Highlighted so it
  // is easy to see how much work it is being asked to do when the menu has no
  // Draft entry.
  const crossLink = draft
    ? '<a class="proto-standin-crosslink" href="#">← Standings</a>'
    : '<a class="proto-standin-crosslink" href="#">Draft →</a>';

  return `
<div class="container-fluid px-3 proto-standin">
  <div class="proto-standin-titlerow">
    <h1 class="h4 mb-0">${escapeHtml(leagueName)} ${escapeHtml(String(year))}${draft ? ' draft' : ''}</h1>
    ${crossLink}
  </div>

  ${draft ? draftBody() : standingsBody(state)}
</div>`;
}

// A `drafting` year has no scores yet, so its standings page is an empty state.
// That is the case the state-aware mode exists for: pick 2027 in the page
// picker and see what a reader lands on when the menu sent them at a year whose
// figures do not exist.
function standingsBody(state) {
  if (state === 'drafting') {
    return `
  <div class="proto-standin-empty">
    <p class="mb-1">This campaign has not started.</p>
    <p class="text-muted mb-0">The slate is still being picked.</p>
  </div>`;
  }

  return `
  <div class="proto-standin-strip mb-3">
    ${['Weekend', 'Biggest mover', 'Best pick', 'Worst pick']
      .map(
        (title) => `<div class="proto-standin-card">
          <div class="proto-standin-cardtitle">${title}</div>
          <div class="proto-standin-cardvalue">$—</div>
        </div>`,
      )
      .join('')}
  </div>

  <div class="proto-standin-chart mb-3">Profit over time</div>

  <table class="table table-sm">
    <thead><tr><th>#</th><th>Player</th><th class="text-end">Gross</th><th class="text-end">Profit</th></tr></thead>
    <tbody>
      ${PLAYERS.map(
        ([name, gross, profit], index) => `<tr>
          <td>${index + 1}</td><td>${name}</td>
          <td class="text-end">${gross}</td><td class="text-end">${profit}</td>
        </tr>`,
      ).join('')}
    </tbody>
  </table>`;
}

function draftBody() {
  return `
  <div class="proto-standin-board">
    ${PLAYERS.map(
      ([name]) => `<div class="proto-standin-boardcol">
        <div class="proto-standin-cardtitle">${name}</div>
        ${['Hit', 'Seasonal', 'Alt', 'Bomb']
          .map((slot) => `<div class="proto-standin-slot">${slot}</div>`)
          .join('')}
      </div>`,
    ).join('')}
  </div>`;
}

function landing(leagueName) {
  return `
<div class="container-fluid px-3 proto-standin">
  <h1 class="h4 mb-1">${escapeHtml(leagueName)}</h1>
  <p class="text-muted">Every campaign this crew has run, and who is ahead across all of them.</p>
  <div class="proto-standin-two">
    <div class="proto-standin-chart">All time</div>
    <div class="proto-standin-chart">Campaigns</div>
  </div>
</div>`;
}

function movies() {
  return `
<div class="container-fluid px-3 proto-standin">
  <h1 class="h4 mb-1">Movies</h1>
  <p class="text-muted">Every movie the platform tracks, starting from January 2026.</p>
  <div class="proto-standin-chart mb-3">Box office</div>
  <table class="table table-sm">
    <thead><tr><th>Title</th><th class="text-end">Gross</th><th class="text-end">Budget</th></tr></thead>
    <tbody>
      ${['Greenland 2: Migration', 'Dead Man’s Wire', 'The Long Walk', 'Mortal Kombat II']
        .map(
          (title) => `<tr><td>${escapeHtml(title)}</td><td class="text-end">$—</td><td class="text-end">$—</td></tr>`,
        )
        .join('')}
    </tbody>
  </table>
</div>`;
}
