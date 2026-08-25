// PROTOTYPE — throwaway. Variant A, "Flyout".
//
// The least distance from what the site already does: a Bootstrap dropdown,
// year rows laid out with `justify-content: space-between` the way
// `.site-nav .dropdown-item` already is, and a second League opening a nested
// flyout panel to the side.
//
// Its bet is that the two link year row reads as one row with a trailing
// action, and that nesting one level is cheap because the menu is small.
//
// The root page is the same idiom opened out: an indented outline, League then
// years, nothing boxed.

import { escapeHtml } from '../shared/format.js';

export const NAME = 'Flyout';

export function renderHeader(model) {
  return `
<nav class="navbar navbar-expand-sm mb-3 border-bottom">
  <div class="container-fluid">
    <a class="navbar-brand fw-bold" href="#">🎬 MBZ</a>
    <div class="site-nav">
      ${leaguesMenu(model)}
      ${moviesLink(model.movies)}
    </div>
    ${themeSwitch()}
  </div>
</nav>`;
}

function leaguesMenu(model) {
  const body = model.grouped
    ? model.leagues.map(leagueFlyout).join('')
    : flatLeague(model.leagues[0]);

  // Inside a League by either address, so the toggle itself is dressed. It is
  // never the marked entry: exactly one entry is marked and it is a link.
  const inside = model.leagues.some((league) => league.current);

  return `<div class="dropdown">
    <button class="site-nav-link dropdown-toggle${inside ? ' is-current' : ''}" type="button"
      data-bs-toggle="dropdown" aria-expanded="false">Leagues</button>
    <ul class="dropdown-menu proto-a-menu">${body}</ul>
  </div>`;
}

// One League: its landing entry leads, its years follow, all at one level.
function flatLeague(league) {
  if (!league) return '<li><span class="dropdown-item-text text-muted">No leagues published</span></li>';

  return `
    <li><a class="dropdown-item proto-a-league${league.landing ? ' is-current' : ''}"
      href="${escapeHtml(league.href)}"${league.landing ? ' aria-current="page"' : ''}>${escapeHtml(league.name)}</a></li>
    <li><hr class="dropdown-divider"></li>
    ${league.years.map(yearRow).join('')}`;
}

// Two or more: each League is a row that opens its own panel to the side.
function leagueFlyout(league) {
  return `
    <li class="proto-a-flyout">
      <button type="button" class="dropdown-item proto-a-league proto-a-flyout-toggle${league.current ? ' is-inside' : ''}">
        <span>${escapeHtml(league.name)}</span>
        <span class="proto-a-caret">›</span>
      </button>
      <ul class="dropdown-menu proto-a-submenu">
        <li><a class="dropdown-item proto-a-league${league.landing ? ' is-current' : ''}"
          href="${escapeHtml(league.href)}"${league.landing ? ' aria-current="page"' : ''}>Overview</a></li>
        <li><hr class="dropdown-divider"></li>
        ${league.years.map(yearRow).join('')}
      </ul>
    </li>`;
}

// The piece most in doubt: one row, two targets. The year and its badge lead,
// Draft is pushed to the end of the row. `showDraft` is off in the two modes
// that leave the draft page to the Campaign page instead, and the row collapses
// to a single link.
function yearRow(year) {
  const draft = year.showDraft
    ? `<a class="proto-a-draft${year.draftCurrent ? ' is-current' : ''}" href="${escapeHtml(year.draftHref)}"${
        year.draftCurrent ? ' aria-current="page"' : ''
      }>Draft</a>`
    : '';

  return `
    <li class="proto-a-row">
      <a class="proto-a-year${year.current ? ' is-current' : ''}" href="${escapeHtml(year.href)}"${
        year.current ? ' aria-current="page"' : ''
      }>${escapeHtml(year.label)}
        <span class="badge ${year.stateTone} site-nav-badge">${escapeHtml(year.stateLabel)}</span>
      </a>
      ${draft}
    </li>`;
}

function moviesLink(movies) {
  return `<a class="site-nav-link${movies.current ? ' is-current' : ''}" href="${escapeHtml(movies.href)}"${
    movies.current ? ' aria-current="page"' : ''
  }>Movies</a>`;
}

function themeSwitch() {
  return `<div class="d-flex align-items-center gap-3 ms-auto">
      <div class="form-check form-switch mb-0">
        <input class="form-check-input" type="checkbox" id="themeSwitch">
        <label class="form-check-label" for="themeSwitch">Light</label>
      </div>
    </div>`;
}

// ── The root directory ────────────────────────────────────────────────────

export function renderRoot(model) {
  return `
<div class="container-fluid px-3 proto-root">
  <section class="proto-a-outline">
    <h2 class="proto-root-heading">Leagues</h2>
    ${model.leagues.map(rootLeague).join('')}
  </section>

  <section class="proto-a-outline">
    <h2 class="proto-root-heading">Movies</h2>
    <ul class="proto-a-list">
      <li class="proto-a-rootrow">
        <a href="/movies/">Every movie the platform tracks</a>
      </li>
    </ul>
  </section>
</div>`;
}

function rootLeague(league) {
  return `
    <div class="proto-a-leagueblock">
      <a class="proto-a-rootleague" href="${escapeHtml(league.href)}">${escapeHtml(league.name)}</a>
      <ul class="proto-a-list">
        ${league.years
          .map(
            (year) => `
          <li class="proto-a-rootrow">
            <a class="proto-a-rootyear" href="${escapeHtml(year.standingsHref)}">${escapeHtml(year.label)}</a>
            <span class="badge ${year.stateTone} site-nav-badge">${escapeHtml(year.stateLabel)}</span>
            <a href="${escapeHtml(year.standingsHref)}">Standings</a>
            <a href="${escapeHtml(year.draftHref)}">Draft</a>
          </li>`,
          )
          .join('')}
      </ul>
    </div>`;
}
