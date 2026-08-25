// PROTOTYPE — throwaway. Variant B, "One panel".
//
// No nesting at any League count. The menu is a single panel and a second
// League is a headed section inside it rather than a level of depth, so the
// number of clicks to any year is the same whether the platform holds one
// League or four.
//
// Its bet is on rails: the year, the badge and Draft each sit in a column, so
// the eye runs down the Draft links rather than hunting the end of each row.
// The cost is a taller panel, which is what the four League case is here to
// show.
//
// The root page is the same rails carried to their conclusion: one table, one
// row per Campaign, every column aligned.

import { escapeHtml } from '../shared/format.js';

export const NAME = 'One panel';

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
  const inside = model.leagues.some((league) => league.current);

  const sections = model.leagues.length
    ? model.leagues.map((league, index) => section(league, index, model.grouped)).join('')
    : '<div class="proto-b-empty text-muted">No leagues published</div>';

  return `<div class="dropdown">
    <button class="site-nav-link dropdown-toggle${inside ? ' is-current' : ''}" type="button"
      data-bs-toggle="dropdown" aria-expanded="false">Leagues</button>
    <div class="dropdown-menu proto-b-menu">${sections}</div>
  </div>`;
}

// With one League the name is a plain leading entry; with several it becomes a
// section heading that is still a link to the landing page. Same markup, so the
// second League adds a rule above it and nothing else.
function section(league, index, grouped) {
  const divider = index > 0 ? '<hr class="dropdown-divider">' : '';

  return `${divider}
    <a class="proto-b-heading${grouped ? ' is-grouped' : ''}${league.landing ? ' is-current' : ''}"
      href="${escapeHtml(league.href)}"${league.landing ? ' aria-current="page"' : ''}>${escapeHtml(league.name)}</a>
    <div class="proto-b-grid">
      ${league.years.map(yearCells).join('')}
    </div>`;
}

// Three cells, not one row: the grid is what puts every badge and every Draft
// link on the same vertical line down the panel.
function yearCells(year) {
  return `
    <a class="proto-b-year${year.current ? ' is-current' : ''}" href="${escapeHtml(year.href)}"${
      year.current ? ' aria-current="page"' : ''
    }>${escapeHtml(year.label)}</a>
    <span class="proto-b-state"><span class="badge ${year.stateTone} site-nav-badge">${escapeHtml(
      year.stateLabel,
    )}</span></span>
    <a class="proto-b-draft${year.draftCurrent ? ' is-current' : ''}" href="${escapeHtml(year.draftHref)}"${
      year.draftCurrent ? ' aria-current="page"' : ''
    }>Draft</a>`;
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
  const rows = model.leagues
    .flatMap((league) =>
      league.years.map((year, index) => campaignRow(league, year, index === 0)),
    )
    .join('');

  return `
<div class="container-fluid px-3 proto-root">
  <div class="proto-b-tablewrap">
    <table class="table table-sm proto-b-table">
      <thead>
        <tr>
          <th scope="col">League</th>
          <th scope="col">Year</th>
          <th scope="col">State</th>
          <th scope="col">Standings</th>
          <th scope="col">Draft</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <table class="table table-sm proto-b-table proto-b-movies">
    <tbody>
      <tr>
        <td><a href="/movies/">Movies</a></td>
        <td colspan="4" class="text-muted">Every movie the platform tracks</td>
      </tr>
    </tbody>
  </table>
</div>`;
}

// The League cell is filled only on its first year, so the eye groups without a
// heading and every Campaign is still one full row.
function campaignRow(league, year, first) {
  return `
    <tr${first ? ' class="proto-b-firstyear"' : ''}>
      <td>${first ? `<a class="proto-b-rootleague" href="${escapeHtml(league.href)}">${escapeHtml(league.name)}</a>` : ''}</td>
      <td><a href="${escapeHtml(year.href)}">${escapeHtml(year.label)}</a></td>
      <td><span class="badge ${year.stateTone} site-nav-badge">${escapeHtml(year.stateLabel)}</span></td>
      <td><a href="${escapeHtml(year.href)}">Standings</a></td>
      <td><a href="${escapeHtml(year.draftHref)}">Draft</a></td>
    </tr>`;
}
