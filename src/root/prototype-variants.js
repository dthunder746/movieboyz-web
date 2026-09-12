// PROTOTYPE — throwaway, platform#84 follow up. Not for main.
//
// Question: the root directory page works but reads as the site bar with its
// middle pulled out over six short lines. What frame should it have?
//
// Three variants of the root page on the real route, over the real Manifest,
// switchable with `?variant=` and a floating bar at the bottom. `current` is
// the page as built on `root-directory-page`, untouched, for comparison.
// Only under `npm run dev`: `page.js` hands over here when the param is set
// and the build is a dev build, so nothing of this ships.

import { escapeHtml } from '../shared/format.js';
import { stateTone } from '../shared/lifecycle.js';
import { createThemeSwitch } from '../shared/theme.js';
import { MANIFESTS } from './prototype-manifests.js';

// `?manifest=` picks the Manifest the page is drawn over: `real` is the one
// published today (one League, one year); the others are faked, with several
// Leagues and years, so the frame is judged at the depth it will reach.
export const MANIFEST_KEYS = ['real', ...Object.keys(MANIFESTS)];

export function requestedManifest(real) {
  const wanted = new URLSearchParams(window.location.search).get('manifest');
  if (!wanted || wanted === 'real' || !MANIFESTS[wanted]) return { key: 'real', manifest: real };
  return { key: wanted, manifest: MANIFESTS[wanted].manifest };
}

export const VARIANTS = ['current', 'A', 'B', 'C'];

const NAMES = {
  current: 'As built',
  A: 'Framed outline',
  B: 'Framed panels',
  C: 'Contents',
};

export function requestedVariant() {
  const wanted = new URLSearchParams(window.location.search).get('variant');
  return VARIANTS.includes(wanted) ? wanted : null;
}

// ── Shared pieces ──────────────────────────────────────────────────────────

function themeSwitch() {
  return `<div class="form-check form-switch mb-0 proto-switch">
    <input class="form-check-input" type="checkbox" id="themeSwitch">
    <label class="form-check-label" for="themeSwitch">Light</label>
  </div>`;
}

function badge(year) {
  return `<span class="badge ${stateTone(year.state)} site-nav-badge">${escapeHtml(year.stateLabel)}</span>`;
}

function note(text) {
  return `<p class="proto-note">${escapeHtml(text)}</p>`;
}

// ── A: framed outline ──────────────────────────────────────────────────────
// No bar strip. The brand is the page heading with a lede under it, the switch
// sits top right on its own, and the outline from the built page runs in a
// narrow centred column a size up.

function variantA(d) {
  const leagues = d.leaguesNote
    ? note(d.leaguesNote)
    : d.leagues.map((league) => `
      <div class="proto-a-league">
        <a class="proto-a-league-link" href="${escapeHtml(league.href)}">${escapeHtml(league.name)}</a>
        ${league.years.length ? `<ul class="proto-a-list">${league.years.map((y) => `
          <li class="proto-a-row">
            <a class="proto-a-year" href="${escapeHtml(y.standingsHref)}">${escapeHtml(y.label)}</a>
            ${badge(y)}
            <a href="${escapeHtml(y.standingsHref)}">Standings</a>
            <a href="${escapeHtml(y.draftHref)}">Draft</a>
          </li>`).join('')}</ul>` : note(league.yearsNote)}
      </div>`).join('');

  return `
  <div class="proto-a">
    ${themeSwitch()}
    <header class="proto-a-head">
      <a class="proto-a-brand" href="${escapeHtml(d.brandHref)}">🎬 MBZ</a>
      <p class="proto-a-lede">Fantasy box office. Every league and every year the platform holds.</p>
    </header>

    <section class="proto-a-section">
      <h2 class="proto-a-heading">Leagues</h2>
      ${leagues}
    </section>

    <section class="proto-a-section">
      <h2 class="proto-a-heading">Movies</h2>
      <ul class="proto-a-list proto-a-list-flat">
        <li class="proto-a-row"><a href="${escapeHtml(d.movies.href)}">Every movie the platform tracks</a></li>
      </ul>
    </section>
  </div>`;
}

// ── B: framed panels ───────────────────────────────────────────────────────
// A's header, then each section boxed the way the League page boxes its two
// panels. The League's name heads its panel; years are rows inside it.

function variantB(d) {
  const leaguePanels = d.leaguesNote
    ? `<section class="league-panel proto-b-panel"><h2 class="league-panel-heading">Leagues</h2>${note(d.leaguesNote)}</section>`
    : d.leagues.map((league) => `
      <section class="league-panel proto-b-panel">
        <h2 class="league-panel-heading">League</h2>
        <a class="proto-b-title" href="${escapeHtml(league.href)}">${escapeHtml(league.name)}</a>
        <p class="league-panel-note">Landing page, all-time table, and every year this crew has run.</p>
        ${league.years.length ? `<ul class="proto-b-rows">${league.years.map((y) => `
          <li class="proto-b-row">
            <a class="proto-b-year" href="${escapeHtml(y.standingsHref)}">${escapeHtml(y.label)}</a>
            ${badge(y)}
            <span class="proto-b-links">
              <a href="${escapeHtml(y.standingsHref)}">Standings</a>
              <a href="${escapeHtml(y.draftHref)}">Draft</a>
            </span>
          </li>`).join('')}</ul>` : note(league.yearsNote)}
      </section>`).join('');

  return `
  <div class="proto-a proto-b">
    ${themeSwitch()}
    <header class="proto-a-head">
      <a class="proto-a-brand" href="${escapeHtml(d.brandHref)}">🎬 MBZ</a>
      <p class="proto-a-lede">Fantasy box office. Every league and every year the platform holds.</p>
    </header>

    <div class="proto-b-grid">
      ${leaguePanels}
      <section class="league-panel proto-b-panel">
        <h2 class="league-panel-heading">Movies</h2>
        <a class="proto-b-title" href="${escapeHtml(d.movies.href)}">Every movie the platform tracks</a>
        <p class="league-panel-note">Lookup by title, with grosses, ratings and who picked it.</p>
      </section>
    </div>
  </div>`;
}

// ── C: contents ────────────────────────────────────────────────────────────
// A table of contents. No section labels and no indentation: every destination
// is a full width row between rules, the League row carrying its years as a
// row of chips beneath the name. Structurally unlike the outline.

function variantC(d) {
  const leagueRows = d.leaguesNote
    ? `<li class="proto-c-row">${note(d.leaguesNote)}</li>`
    : d.leagues.map((league) => `
      <li class="proto-c-row">
        <a class="proto-c-title" href="${escapeHtml(league.href)}">${escapeHtml(league.name)}<span class="proto-c-arrow">&rarr;</span></a>
        <div class="proto-c-sub">League</div>
        ${league.years.length ? `<div class="proto-c-chips">${league.years.map((y) => `
          <span class="proto-c-chipgroup">
            <a class="proto-c-chip" href="${escapeHtml(y.standingsHref)}">${escapeHtml(y.label)} ${badge(y)}</a>
            <a class="proto-c-chip proto-c-chip-secondary" href="${escapeHtml(y.standingsHref)}">Standings</a>
            <a class="proto-c-chip proto-c-chip-secondary" href="${escapeHtml(y.draftHref)}">Draft</a>
          </span>`).join('')}</div>` : note(league.yearsNote)}
      </li>`).join('');

  return `
  <div class="proto-c">
    ${themeSwitch()}
    <header class="proto-c-head">
      <a class="proto-c-brand" href="${escapeHtml(d.brandHref)}">🎬 MBZ</a>
      <p class="proto-c-lede">Fantasy box office</p>
    </header>
    <ul class="proto-c-list">
      ${leagueRows}
      <li class="proto-c-row">
        <a class="proto-c-title" href="${escapeHtml(d.movies.href)}">Movies<span class="proto-c-arrow">&rarr;</span></a>
        <div class="proto-c-sub">Every movie the platform tracks</div>
      </li>
    </ul>
  </div>`;
}

// ── Styles, inline so site.css is not touched ─────────────────────────────

const CSS = `
.proto-switch { position: absolute; top: 0.9rem; right: 1rem; }
.proto-a { position: relative; max-width: 42rem; margin: 0 auto; padding: 3.5rem 1.25rem 4rem; }
.proto-a-head { margin-bottom: 2.5rem; }
.proto-a-brand { font-size: 2rem; font-weight: 700; color: var(--bs-body-color); text-decoration: none; }
.proto-a-lede { font-size: 0.95rem; color: var(--bs-secondary-color); margin: 0.4rem 0 0; }
.proto-a-section { margin-bottom: 2.5rem; }
.proto-a-heading { font-size: 0.78rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em; color: var(--bs-secondary-color); margin-bottom: 0.9rem; }
.proto-a-league { margin-bottom: 1.5rem; }
.proto-a-league-link { font-size: 1.2rem; font-weight: 600; color: var(--bs-body-color); text-decoration: none; }
.proto-a-league-link:hover { text-decoration: underline; }
.proto-a-list { list-style: none; margin: 0.5rem 0 0; padding-left: 1.5rem; }
.proto-a-list-flat { padding-left: 0; }
.proto-a-row { display: flex; flex-wrap: wrap; align-items: center; gap: 1rem; padding: 0.45rem 0; font-size: 1rem; }
.proto-a-row a { text-decoration: none; }
.proto-a-row a:hover { text-decoration: underline; }
.proto-a-year { min-width: 3.25rem; color: var(--bs-body-color); font-weight: 500; }
.proto-note { font-size: 0.9rem; color: var(--bs-secondary-color); margin: 0.35rem 0 0; }

.proto-b { max-width: 48rem; }
.proto-b-grid { display: grid; gap: 1rem; }
.proto-b-panel { padding: 1.1rem 1.25rem; }
.proto-b-title { display: inline-block; font-size: 1.2rem; font-weight: 600; color: var(--bs-body-color); text-decoration: none; margin-bottom: 0.15rem; }
.proto-b-title:hover { text-decoration: underline; }
.proto-b-rows { list-style: none; margin: 0.25rem 0 0; padding: 0; }
.proto-b-row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.9rem; padding: 0.55rem 0; border-top: 1px solid var(--bs-border-color); font-size: 0.98rem; }
.proto-b-year { min-width: 3.25rem; color: var(--bs-body-color); font-weight: 600; text-decoration: none; }
.proto-b-links { margin-left: auto; display: flex; gap: 1rem; }
.proto-b-links a { text-decoration: none; }
.proto-b-links a:hover { text-decoration: underline; }

.proto-c { position: relative; max-width: 40rem; margin: 0 auto; padding: 4.5rem 1.25rem 4rem; }
.proto-c-head { text-align: center; margin-bottom: 2.5rem; }
.proto-c-brand { font-size: 2.6rem; font-weight: 700; color: var(--bs-body-color); text-decoration: none; }
.proto-c-lede { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.14em; color: var(--bs-secondary-color); margin: 0.25rem 0 0; }
.proto-c-list { list-style: none; margin: 0; padding: 0; border-top: 1px solid var(--bs-border-color); }
.proto-c-row { padding: 1.25rem 0; border-bottom: 1px solid var(--bs-border-color); }
.proto-c-title { display: flex; justify-content: space-between; align-items: baseline; font-size: 1.35rem; font-weight: 600; color: var(--bs-body-color); text-decoration: none; }
.proto-c-title:hover { text-decoration: underline; }
.proto-c-arrow { font-size: 1.1rem; color: var(--bs-secondary-color); }
.proto-c-sub { font-size: 0.85rem; color: var(--bs-secondary-color); margin-top: 0.15rem; }
.proto-c-chips { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-top: 0.9rem; }
.proto-c-chipgroup { display: inline-flex; gap: 0.35rem; align-items: center; }
.proto-c-chip { display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.7rem; border: 1px solid var(--bs-border-color); border-radius: 999px; font-size: 0.9rem; color: var(--bs-body-color); text-decoration: none; }
.proto-c-chip:hover { background: var(--bs-tertiary-bg); }
.proto-c-chip-secondary { color: var(--bs-link-color); border-style: dashed; }

.proto-bar { position: fixed; left: 50%; bottom: 1rem; transform: translateX(-50%); display: flex; align-items: center; gap: 0.75rem; padding: 0.4rem 0.6rem; border-radius: 999px; background: #ffd400; color: #111; font: 600 0.85rem system-ui, sans-serif; box-shadow: 0 4px 16px rgba(0,0,0,0.35); z-index: 9999; }
.proto-bar button { border: 0; background: #111; color: #ffd400; width: 1.8rem; height: 1.8rem; border-radius: 50%; cursor: pointer; font-size: 1rem; line-height: 1; }
.proto-bar span { min-width: 11rem; text-align: center; }
.proto-bar .proto-bar-manifest { width: auto; height: auto; border-radius: 999px; padding: 0.3rem 0.7rem; font-size: 0.8rem; white-space: nowrap; }
`;

// ── Switcher and mount ─────────────────────────────────────────────────────

function go(variant, manifestKey) {
  const url = new URL(window.location.href);
  url.searchParams.set('variant', variant);
  url.searchParams.set('manifest', manifestKey);
  window.location.replace(url.toString());
}

function switcher(variant, manifestKey) {
  const i = VARIANTS.indexOf(variant);
  const prev = VARIANTS[(i - 1 + VARIANTS.length) % VARIANTS.length];
  const next = VARIANTS[(i + 1) % VARIANTS.length];
  const m = MANIFEST_KEYS.indexOf(manifestKey);
  const nextManifest = MANIFEST_KEYS[(m + 1) % MANIFEST_KEYS.length];
  const manifestLabel = manifestKey === 'real' ? 'real Manifest' : MANIFESTS[manifestKey].label;

  const bar = document.createElement('div');
  bar.className = 'proto-bar';
  bar.innerHTML = `<button type="button" aria-label="Previous variant">&larr;</button>
    <span>PROTOTYPE ${escapeHtml(variant)} — ${escapeHtml(NAMES[variant])}</span>
    <button type="button" aria-label="Next variant">&rarr;</button>
    <button type="button" class="proto-bar-manifest" aria-label="Next Manifest">${escapeHtml(manifestLabel)} &#8635;</button>`;
  const [left, right, manifest] = bar.querySelectorAll('button');
  left.addEventListener('click', () => go(prev, manifestKey));
  right.addEventListener('click', () => go(next, manifestKey));
  manifest.addEventListener('click', () => go(variant, nextManifest));
  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (e.key === 'ArrowLeft') go(prev, manifestKey);
    if (e.key === 'ArrowRight') go(next, manifestKey);
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') go(variant, nextManifest);
  });
  document.body.appendChild(bar);
}

const RENDER = { A: variantA, B: variantB, C: variantC };

// `current` leaves the built page alone and only adds the bar. The others
// replace the body wholesale, which is why the theme switch is created here.
export function mountVariant(variant, directory, manifestKey) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  if (variant !== 'current') {
    document.body.innerHTML = RENDER[variant](directory);
    createThemeSwitch(() => {});
  }
  switcher(variant, manifestKey);
}
