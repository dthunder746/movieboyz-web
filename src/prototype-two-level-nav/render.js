// PROTOTYPE — throwaway. The DOM the #168 shape becomes.
//
// One renderer, read twice. The wide reading (>=992px) is the bar with a
// cascading menu; the compact reading (<992px) is the same cascade inside the
// single overlay #165 already collapses the bar into. Both are drawn into the
// slot together and a media query picks between them, exactly as `nav.js` does
// today, so a resize is a repaint.
//
// The three `?touch=` modes differ in markup only at the level one row, and in
// class names the stylesheet keys off. The behaviour lives in `keys.js`.

import { escapeHtml } from '../shared/format.js';

export function renderBar(model) {
  return `
<nav class="navbar site-navbar border-bottom proto-navbar">
  <div class="container-fluid">
    <a class="navbar-brand fw-bold" href="#" id="site-brand">🎬 MBZ</a>
    <div class="site-nav proto-nav">
      ${renderMenu(model, { compact: true })}
      <div class="site-nav-wide">
        ${renderMenu(model, { compact: false })}
        ${moviesLink(model, 'site-nav-link')}
      </div>
    </div>
    <div class="ms-auto d-flex align-items-center gap-2">
      <button class="site-nav-link" type="button" id="themeSwitch" title="Theme">☀</button>
    </div>
  </div>
</nav>`;
}

// The Leagues menu, in whichever reading. The compact one wraps its own toggle
// (`Menu`) around the same cascade and folds the Movies link in as a row,
// because below the breakpoint there is only one button in the bar.
function renderMenu(model, { compact }) {
  const { touch } = model.modes;
  const classes = [
    'proto-menu',
    `proto-menu--${touch}`,
    compact ? 'proto-menu--compact site-nav-compact' : 'proto-menu--wide',
  ].join(' ');

  const toggleLabel = compact ? 'Menu' : 'Leagues';
  const toggleCurrent = !compact && model.leaguesToggleCurrent ? ' is-current' : '';

  const leagueBlocks = model.leagues.map((league) => levelOneRow(league, model, compact)).join('');

  // Below the breakpoint the bar is one button, so Movies is a row of the same
  // overlay rather than an entry beside it.
  const moviesRow = compact
    ? `<div class="proto-l1-sep"></div>${moviesLink(model, 'proto-item proto-item-flat')}`
    : '';

  return `
<div class="${classes}" data-menu>
  <button class="site-nav-link dropdown-toggle proto-toggle${toggleCurrent}" type="button"
    data-toggle aria-haspopup="true" aria-expanded="false">${toggleLabel}</button>
  <div class="proto-panel proto-panel-1" data-level="1" role="menu" hidden>
    ${leagueBlocks}${moviesRow}
  </div>
</div>`;
}

// One League at level one, plus the second level hanging off it. The row is the
// whole of what `?touch=` changes.
function levelOneRow(league, model, compact) {
  const { touch, mark } = model.modes;
  // In `rows-only` nothing in the bar says where the reader is, so the League
  // row is carrying it alone and is drawn harder. In `toggle` the bar already
  // said it, so the row only groups.
  const inside = league.inside
    ? ` is-inside${mark === 'rows-only' ? ' is-inside-strong' : ''}`
    : '';

  const caret = '<span class="proto-caret" aria-hidden="true">▸</span>';

  const row =
    touch === 'split'
      ? `<div class="proto-l1row${inside}">
           <a class="proto-item proto-item-split" data-row href="${escapeHtml(league.href)}"
             >${escapeHtml(league.name)}</a>
           <button class="proto-chev" type="button" data-row-chev data-open aria-expanded="false"
             aria-label="Campaigns of ${escapeHtml(league.name)}">${caret}</button>
         </div>`
      : `<button class="proto-item proto-item-row${inside}" type="button" data-row data-open
           aria-haspopup="true" aria-expanded="false"
           >${escapeHtml(league.name)}${caret}</button>`;

  return `
<div class="proto-l1" data-league="${escapeHtml(league.slug)}">
  ${row}
  <div class="proto-panel proto-panel-2" data-level="2" role="menu" hidden>
    ${backRow(league)}
    ${overviewRow(league)}
    ${league.years.map((year) => yearRows(league, year, model)).join('')}
  </div>
</div>`;
}

// Only `drill`, and only compact, shows this: there the second level replaces
// the first, so there has to be a way back up. The stylesheet hides it
// everywhere else rather than the renderer branching, so the same markup serves
// all three modes.
function backRow(league) {
  return `<button class="proto-item proto-back" type="button" data-row data-back
    ><span class="proto-caret" aria-hidden="true">◂</span> ${escapeHtml(league.name)}</button>`;
}

function overviewRow(league) {
  return `<a class="proto-item${league.overviewCurrent ? ' is-current' : ''}" data-row
    href="${escapeHtml(league.href)}"${league.overviewCurrent ? ' aria-current="page"' : ''}
    >Overview</a>`;
}

// The `?year=` question, which is the only thing that changes here.
function yearRows(league, year, model) {
  const badge = `<span class="badge ${year.stateTone} site-nav-badge">${escapeHtml(year.stateLabel)}</span>`;
  const mark = (on) => (on ? ' aria-current="page"' : '');
  const cur = (on) => (on ? ' is-current' : '');

  if (model.modes.year === 'two-rows') {
    return `
<a class="proto-item proto-year${cur(year.standingsCurrent)}" data-row
  href="${escapeHtml(year.standingsHref)}"${mark(year.standingsCurrent)}
  ><span class="proto-yearlabel">${year.label}</span> <span class="proto-sub">Standings</span>${badge}</a>
<a class="proto-item proto-year proto-year-second${cur(year.draftCurrent)}" data-row
  href="${escapeHtml(year.draftHref)}"${mark(year.draftCurrent)}
  ><span class="proto-yearlabel">${year.label}</span> <span class="proto-sub">Draft</span></a>`;
  }

  if (model.modes.year === 'trailing') {
    return `
<div class="proto-yearrow">
  <a class="proto-item proto-year proto-year-grow${cur(year.standingsCurrent)}" data-row
    href="${escapeHtml(year.standingsHref)}"${mark(year.standingsCurrent)}
    >${year.label}${badge}</a>
  <a class="proto-draft${cur(year.draftCurrent)}" data-row-draft
    href="${escapeHtml(year.draftHref)}"${mark(year.draftCurrent)}>Draft</a>
</div>`;
  }

  // `alone`, the default: the year is the whole row, and the draft page is
  // reached by the cross link on the Campaign page (#83).
  return `
<a class="proto-item proto-year${cur(year.standingsCurrent)}" data-row
  href="${escapeHtml(year.standingsHref)}"${mark(year.standingsCurrent)}
  >${year.label}${badge}</a>`;
}

function moviesLink(model, className) {
  const current = model.movies.current;
  return `<a class="${className}${current ? ' is-current' : ''}" href="${escapeHtml(model.movies.href)}"${
    current ? ' aria-current="page"' : ''
  }>Movies</a>`;
}
