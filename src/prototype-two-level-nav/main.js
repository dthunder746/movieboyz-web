// PROTOTYPE — throwaway. Wiring for platform#168.
//
// The two level navigation, on one throwaway route, with every open question
// behind a search parameter so any combination of answers can be looked at:
//
//   ?touch=    tap-row | split | drill      how the second level opens
//   ?year=     alone | trailing | two-rows  what a year's row holds
//   ?mark=     toggle | rows-only           what says where the reader is
//   ?manifest= three | one | ten            how many Leagues are published
//   ?path=     any address the Manifest answers, plus / and /movies/
//
// They are combinable rather than three variants of a whole bar, because the
// four questions #168 asks are independent: the touch model does not decide
// what a year row holds and neither decides what is marked. A variant per
// combination would be eighteen bars and nobody could hold them apart.
//
// Nothing here is production code and none of it is a build entry in
// `vite.config.js`, so it exists under `npm run dev` and ships nowhere.

import { MANIFESTS, MANIFEST_KEYS } from './manifests.js';
import { addresses, buildModel, MARK_MODES, TOUCH_MODES, YEAR_MODES } from './model.js';
import { renderBar } from './render.js';
import { renderStandin } from './standin.js';
import { wireMenus } from './keys.js';

const DEFAULTS = {
  touch: 'tap-row',
  year: 'alone',
  mark: 'toggle',
  manifest: 'three',
  path: '/league/movieboyz/2026/',
};

function params() {
  const search = new URLSearchParams(window.location.search);
  const pick = (name, allowed) =>
    allowed.includes(search.get(name)) ? search.get(name) : DEFAULTS[name];

  return {
    touch: pick('touch', Object.keys(TOUCH_MODES)),
    year: pick('year', Object.keys(YEAR_MODES)),
    mark: pick('mark', Object.keys(MARK_MODES)),
    manifest: pick('manifest', MANIFEST_KEYS),
    path: search.get('path') ?? DEFAULTS.path,
  };
}

function setParams(changes) {
  const url = new URL(window.location.href);
  for (const [name, value] of Object.entries(changes)) url.searchParams.set(name, value);
  window.history.replaceState(null, '', url);
  render();
}

function select(id, label, options, current) {
  const items = Object.entries(options)
    .map(
      ([value, text]) =>
        `<option value="${value}"${value === current ? ' selected' : ''}>${text}</option>`,
    )
    .join('');
  return `<label>${label} <select id="${id}">${items}</select></label>`;
}

// The floating switcher, the same idea as the #83 one widened to five controls.
// It is mounted once and repainted, rather than re-rendered with the page, so
// an open select is not yanked out from under the pointer.
function renderSwitcher(state, manifestObject) {
  const bar = document.getElementById('proto-switcher');

  const paths = Object.fromEntries(
    addresses(manifestObject).map((entry) => [entry.path, entry.label]),
  );

  bar.innerHTML = [
    select('proto-touch', 'touch', TOUCH_MODES, state.touch),
    select('proto-year', 'year', YEAR_MODES, state.year),
    select('proto-mark', 'mark', MARK_MODES, state.mark),
    select(
      'proto-manifest',
      'manifest',
      Object.fromEntries(MANIFEST_KEYS.map((key) => [key, MANIFESTS[key].label])),
      state.manifest,
    ),
    select('proto-path', 'at', paths, state.path),
    '<span class="proto-switcher-note">narrow the window under 992px for the compact reading</span>',
  ].join('');

  bar.querySelector('#proto-touch').onchange = (e) => setParams({ touch: e.target.value });
  bar.querySelector('#proto-year').onchange = (e) => setParams({ year: e.target.value });
  bar.querySelector('#proto-mark').onchange = (e) => setParams({ mark: e.target.value });
  bar.querySelector('#proto-path').onchange = (e) => setParams({ path: e.target.value });
  // The address may not exist in the new Manifest, so it falls back to its root.
  bar.querySelector('#proto-manifest').onchange = (e) =>
    setParams({ manifest: e.target.value, path: '/' });
}

function render() {
  const state = params();
  const manifestObject = MANIFESTS[state.manifest].manifest;
  const model = buildModel(manifestObject, state.path, state);

  const page = document.getElementById('page');
  page.innerHTML = renderBar(model) + renderStandin(model);

  wireMenus(page);
  wireTheme();
  renderSwitcher(state, manifestObject);
}

function wireTheme() {
  const button = document.getElementById('themeSwitch');
  if (!button) return;
  button.addEventListener('click', () => {
    const next =
      document.documentElement.getAttribute('data-bs-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-bs-theme', next);
    localStorage.setItem('mbTheme', next);
  });
}

render();
