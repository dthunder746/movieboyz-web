// PROTOTYPE — throwaway. Variant C, "Wide panel".
//
// Leagues opens a full width panel under the bar rather than a dropdown, with
// one column per League. Depth is still the Manifest's answer — one League is
// one column, four Leagues are four — but it is spent sideways, so every year
// of every League is on screen at once and nothing hovers or nests.
//
// Its bet is that the two link year row stops being a row at all: the year and
// Draft are two chips side by side, sized like buttons, which is the shape that
// says plainest that a row holds two destinations.
//
// The root page is the same panel with the bar taken off: one card per League.

import { escapeHtml } from '../shared/format.js';

export const NAME = 'Wide panel';

export function renderHeader(model) {
  const inside = model.leagues.some((league) => league.current);

  return `
<nav class="navbar navbar-expand-sm border-bottom proto-c-bar">
  <div class="container-fluid">
    <a class="navbar-brand fw-bold" href="#">🎬 MBZ</a>
    <div class="site-nav">
      <button class="site-nav-link dropdown-toggle${inside ? ' is-current' : ''}" type="button"
        id="proto-c-toggle" aria-expanded="false" aria-controls="proto-c-panel">Leagues</button>
      ${moviesLink(model.movies)}
    </div>
    ${themeSwitch()}
  </div>
</nav>

<div id="proto-c-panel" class="proto-c-panel" hidden>
  <div class="container-fluid px-3">
    <div class="proto-c-columns">
      ${model.leagues.map(column).join('')}
    </div>
  </div>
</div>
<div class="mb-3"></div>`;
}

function column(league) {
  return `
    <section class="proto-c-column">
      <a class="proto-c-heading${league.landing ? ' is-current' : ''}" href="${escapeHtml(league.href)}"${
        league.landing ? ' aria-current="page"' : ''
      }>${escapeHtml(league.name)}</a>
      <p class="proto-c-note text-muted">All years and the overall table</p>
      ${league.years.map(yearChips).join('')}
    </section>`;
}

// Two chips, not a row with a trailing link. Each is its own target and looks
// like one.
function yearChips(year) {
  return `
    <div class="proto-c-year">
      <a class="proto-c-chip proto-c-standings${year.current ? ' is-current' : ''}" href="${escapeHtml(year.href)}"${
        year.current ? ' aria-current="page"' : ''
      }>
        <span class="proto-c-yearlabel">${escapeHtml(year.label)}</span>
        <span class="badge ${year.stateTone} site-nav-badge">${escapeHtml(year.stateLabel)}</span>
      </a>
      <a class="proto-c-chip proto-c-draftchip${year.draftCurrent ? ' is-current' : ''}" href="${escapeHtml(
        year.draftHref,
      )}"${year.draftCurrent ? ' aria-current="page"' : ''}>Draft</a>
    </div>`;
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

// The panel is a toggle rather than a Bootstrap dropdown, so it needs wiring.
export function afterRender() {
  const toggle = document.getElementById('proto-c-toggle');
  const panel = document.getElementById('proto-c-panel');
  if (!toggle || !panel) return;

  toggle.addEventListener('click', () => {
    const open = !panel.hidden;
    panel.hidden = open;
    toggle.setAttribute('aria-expanded', String(!open));
  });
}

// ── The root directory ────────────────────────────────────────────────────

export function renderRoot(model) {
  return `
<div class="container-fluid px-3 proto-root">
  <div class="proto-c-cards">
    ${model.leagues.map(rootCard).join('')}
    <section class="proto-c-card proto-c-moviescard">
      <a class="proto-c-heading" href="/movies/">Movies</a>
      <p class="proto-c-note text-muted">Every movie the platform tracks, belonging to no league</p>
      <div class="proto-c-year">
        <a class="proto-c-chip" href="/movies/">Open</a>
      </div>
    </section>
  </div>
</div>`;
}

function rootCard(league) {
  return `
    <section class="proto-c-card">
      <a class="proto-c-heading" href="${escapeHtml(league.href)}">${escapeHtml(league.name)}</a>
      <p class="proto-c-note text-muted">All years and the overall table</p>
      ${league.years.map(yearChips).join('')}
    </section>`;
}
