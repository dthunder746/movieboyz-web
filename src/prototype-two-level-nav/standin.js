// PROTOTYPE — throwaway. What sits under the bar.
//
// A bar judged over an empty page looks fine in every mode, so each page the
// nav can sit on gets a stand-in at roughly the density the real one has. It is
// faded, because nothing here is what is being judged.
//
// Lifted from the #83 prototype with the parts that ticket was arguing about
// removed. The Campaign cross link stays, because in the `alone` year mode it
// is the whole way between a year's two pages and that is one of the four
// questions #168 asks.

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
  const name = league ? league.name : 'League';
  const state = league?.years.find((entry) => entry.year === here.year)?.state;

  if (here.kind === 'campaign') return campaign(name, here.year, false, state);
  if (here.kind === 'draft') return campaign(name, here.year, true, state);
  if (here.kind === 'landing') return landing(name);
  if (here.kind === 'movies') return movies();
  return root(model);
}

function campaign(name, year, draft, state) {
  const crossLink = draft
    ? '<a class="proto-standin-crosslink" href="#">← Standings</a>'
    : '<a class="proto-standin-crosslink" href="#">Draft →</a>';

  return page(`
  <div class="proto-standin-titlerow">
    <h1 class="h4 mb-0">${escapeHtml(name)} ${year}${draft ? ' draft' : ''}</h1>
    ${crossLink}
  </div>
  ${draft ? draftBody() : standingsBody(state)}`);
}

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

function landing(name) {
  return page(`
  <h1 class="h4 mb-1">${escapeHtml(name)}</h1>
  <p class="text-muted">Every campaign this crew has run, and who is ahead across all of them.</p>
  <div class="proto-standin-two">
    <div class="proto-standin-chart">All time</div>
    <div class="proto-standin-chart">Campaigns</div>
  </div>`);
}

function movies() {
  return page(`
  <h1 class="h4 mb-1">Movies</h1>
  <p class="text-muted">Every movie the platform tracks, starting from January 2026.</p>
  <div class="proto-standin-chart mb-3">Box office</div>
  <table class="table table-sm">
    <thead><tr><th>Title</th><th class="text-end">Gross</th><th class="text-end">Budget</th></tr></thead>
    <tbody>
      ${['Greenland 2: Migration', 'Dead Man’s Wire', 'The Long Walk', 'Mortal Kombat II']
        .map((title) => `<tr><td>${escapeHtml(title)}</td><td class="text-end">$—</td><td class="text-end">$—</td></tr>`)
        .join('')}
    </tbody>
  </table>`);
}

// The root is the directory of every League and year (#84). The real one
// carries no bar, since the page is the navigation opened out; this prototype
// draws the bar there anyway, so the marking modes can be seen on a page that
// is inside no League at all. Noted in the README.
function root(model) {
  const leagues = model.leagues
    .map(
      (league) => `<li class="proto-rootleague">${escapeHtml(league.name)}
        <ul>${league.years.map((year) => `<li>${year.label} — ${year.stateLabel}</li>`).join('')}</ul>
      </li>`,
    )
    .join('');

  return page(`
  <h1 class="h4 mb-1">MovieBoyz</h1>
  <p class="text-muted">Every league and every campaign published.</p>
  <ul class="proto-rootlist">${leagues}</ul>`);
}

function page(body) {
  return `<div class="container-fluid px-3 pt-3 proto-standin">${body}</div>`;
}
