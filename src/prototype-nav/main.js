// PROTOTYPE — throwaway. Wiring for platform#83.
//
// Three variants of the navigation bar and of the root directory page, on one
// throwaway route, switchable via `?variant=`. Two more parameters fake the
// Manifest (`?manifest=`) and the address the reader is at (`?path=`), because
// the questions the ticket asks are "what does this look like with several
// Leagues" and "which entry is marked where", and neither can be seen from one
// fixed page.
//
// Every variant keeps the shape #81 settled — two bar sections, the 🎬 MBZ
// brand, Leagues as a menu rather than a link, Manifest driven depth, the two
// link year row, a bar-less flat root. They disagree only about layout, which
// is what this ticket exists to judge.
//
// Nothing here is production code and none of it is a build entry.

import { buildModel, addresses } from './model.js';
import { MANIFESTS, MANIFEST_KEYS } from './manifests.js';
import { renderStandin } from './standin.js';
import { mountSwitcher } from './switcher.js';
import * as variantA from './variant-a.js';
import * as variantB from './variant-b.js';
import * as variantC from './variant-c.js';

const VARIANTS = { A: variantA, B: variantB, C: variantC };
const VARIANT_KEYS = Object.keys(VARIANTS);
const VARIANT_NAMES = Object.fromEntries(
  VARIANT_KEYS.map((key) => [key, VARIANTS[key].NAME]),
);

function params() {
  const search = new URLSearchParams(window.location.search);
  const variant = VARIANT_KEYS.includes(search.get('variant')) ? search.get('variant') : 'A';
  const manifest = MANIFEST_KEYS.includes(search.get('manifest')) ? search.get('manifest') : 'two';
  const path = search.get('path') ?? '/league/movieboyz/2026/';
  return { variant, manifest, path };
}

function setParam(name, value) {
  const url = new URL(window.location.href);
  url.searchParams.set(name, value);
  window.history.replaceState(null, '', url);
  render();
}

// The prototype's own controls. Above the page and unmistakably not part of it,
// for the same reason the switcher is.
function renderControls({ manifest, path }, manifestObject) {
  const options = addresses(manifestObject)
    .map(
      (entry) =>
        `<option value="${entry.path}"${entry.path === path ? ' selected' : ''}>${entry.label}</option>`,
    )
    .join('');

  const manifests = MANIFEST_KEYS.map(
    (key) =>
      `<option value="${key}"${key === manifest ? ' selected' : ''}>${MANIFESTS[key].label}</option>`,
  ).join('');

  return `
<div class="proto-controls">
  <span class="proto-controls-tag">PROTOTYPE · platform#83</span>
  <label>Manifest
    <select id="proto-manifest">${manifests}</select>
  </label>
  <label>Reader is at
    <select id="proto-path">${options}</select>
  </label>
  <span class="proto-controls-note">← → switch variant</span>
</div>`;
}

function render() {
  const state = params();
  const manifestObject = MANIFESTS[state.manifest].manifest;
  const model = buildModel(manifestObject, state.path);
  const variant = VARIANTS[state.variant];

  const page =
    model.here.kind === 'root'
      ? `${rootHeader()}${variant.renderRoot(model)}`
      : `${variant.renderHeader(model)}${renderStandin(model)}`;

  document.getElementById('page').innerHTML =
    renderControls(state, manifestObject) + page;

  document.getElementById('proto-manifest').addEventListener('change', (event) => {
    // The address may not exist in the new Manifest, so fall back to its root.
    setParamPair('manifest', event.target.value, 'path', '/');
  });
  document.getElementById('proto-path').addEventListener('change', (event) => {
    setParam('path', event.target.value);
  });

  variant.afterRender?.();
  wireTheme();
}

function setParamPair(a, aValue, b, bValue) {
  const url = new URL(window.location.href);
  url.searchParams.set(a, aValue);
  url.searchParams.set(b, bValue);
  window.history.replaceState(null, '', url);
  render();
}

// The root carries no navigation bar, only the brand and the theme switch: the
// page *is* the navigation opened out, so showing the collapsed menu above it
// would say the same thing twice (#81). Shared by all three variants because
// that part is settled.
function rootHeader() {
  return `
<nav class="navbar navbar-expand-sm mb-4 border-bottom">
  <div class="container-fluid">
    <a class="navbar-brand fw-bold" href="#">🎬 MBZ</a>
    <div class="d-flex align-items-center gap-3 ms-auto">
      <div class="form-check form-switch mb-0">
        <input class="form-check-input" type="checkbox" id="themeSwitch">
        <label class="form-check-label" for="themeSwitch">Light</label>
      </div>
    </div>
  </div>
</nav>`;
}

function wireTheme() {
  const input = document.getElementById('themeSwitch');
  if (!input) return;

  const saved = localStorage.getItem('mbTheme') || 'dark';
  input.checked = saved === 'light';

  input.addEventListener('change', () => {
    const theme = input.checked ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', theme);
    localStorage.setItem('mbTheme', theme);
  });
}

mountSwitcher({
  keys: VARIANT_KEYS,
  names: VARIANT_NAMES,
  getCurrent: () => params().variant,
  onChange: (key) => setParam('variant', key),
});

render();
