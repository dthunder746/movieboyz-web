// PROTOTYPE — throwaway. What sits under the bar.
//
// A bar judged over an empty page looks fine in every variant, so each page the
// nav can sit on gets a stand-in with roughly the density the real one has. It
// is the same for all three variants on purpose: nothing here is being judged,
// it is there so the bar is not floating in a vacuum.
//
// The Campaign stand-in carries the in page `Draft` link #81 settled, beside
// Standings and Board, because whether the bar's Draft entry is redundant next
// to it is a real question the layout has to answer.

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

  if (here.kind === 'campaign') return campaign(leagueName, here.year, 'standings');
  if (here.kind === 'draft') return campaign(leagueName, here.year, 'draft');
  if (here.kind === 'landing') return landing(leagueName);
  if (here.kind === 'movies') return movies();
  return '';
}

function campaign(leagueName, year, tab) {
  const draft = tab === 'draft';

  return `
<div class="container-fluid px-3 proto-standin">
  <h1 class="h4 mb-1">${escapeHtml(leagueName)} ${escapeHtml(String(year))}</h1>
  <div class="btn-group btn-group-sm mb-3" role="group" aria-label="Campaign sections">
    <a class="btn btn-outline-secondary${draft ? '' : ' active'}" href="#">Standings</a>
    <a class="btn btn-outline-secondary" href="#">Board</a>
    <a class="btn btn-outline-secondary${draft ? ' active' : ''}" href="#">Draft</a>
  </div>

  ${draft ? draftBody() : standingsBody()}
</div>`;
}

function standingsBody() {
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
