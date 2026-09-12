// The root page's entry point: it reads the Manifest once and draws the
// directory out of it. Everything decided rather than rendered is next door in
// `directory.js` with a test beside it; what is left here is wiring and markup,
// untested by design as the rest of the site's is.
//
// It draws no navigation bar. The page is the navigation opened out, so
// `mountNav` is not called and the shell in `index.html` carries only the
// brand and the theme switch (#81, #84).
//
// The Manifest not loading is answered on the page rather than by the shared
// notice, which would draw the bar this page must not carry. The Leagues
// section says the Manifest could not be read, and the Movies section is drawn
// regardless, because the lookup reads no League file and is what keeps the
// root from being a dead end (#64).

import { loadManifest } from '../shared/artifacts.js';
import { escapeHtml } from '../shared/format.js';
import { stateTone } from '../shared/lifecycle.js';
import { createThemeSwitch } from '../shared/theme.js';

import { buildDirectory } from './directory.js';

// PROTOTYPE hook (platform#84 follow up): `?variant=` under `npm run dev` swaps
// the page for a layout variant. Throwaway; see prototype-variants.js.
import { mountVariant, requestedVariant } from './prototype-variants.js';

// One row per year: the year, its Lifecycle badge, and the two pages it holds.
// The year itself leads to the standings as well, so the row reads the way the
// navigation's year entries do and the prototype the layout was settled on did
// (#83). No entry is emphasised over another.
function yearRow(year) {
  return `<li class="site-directory-row">
    <a class="site-directory-year" href="${escapeHtml(year.standingsHref)}">${escapeHtml(year.label)}</a>
    <span class="badge ${stateTone(year.state)} site-nav-badge">${escapeHtml(year.stateLabel)}</span>
    <a href="${escapeHtml(year.standingsHref)}">Standings</a>
    <a href="${escapeHtml(year.draftHref)}">Draft</a>
  </li>`;
}

function leagueBlock(league) {
  const years = league.years.length
    ? `<ul class="site-directory-list">${league.years.map(yearRow).join('')}</ul>`
    : `<p class="site-directory-note">${escapeHtml(league.yearsNote)}</p>`;

  return `<div class="site-directory-league">
    <a class="site-directory-league-link" href="${escapeHtml(league.href)}">${escapeHtml(league.name)}</a>
    ${years}
  </div>`;
}

function render(directory) {
  const brand = document.getElementById('site-brand');
  if (brand) brand.setAttribute('href', directory.brandHref);

  const leagues = document.getElementById('directory-leagues');
  if (leagues) {
    leagues.innerHTML = directory.leaguesNote
      ? `<p class="site-directory-note">${escapeHtml(directory.leaguesNote)}</p>`
      : directory.leagues.map(leagueBlock).join('');
  }

  const movies = document.getElementById('directory-movies');
  if (movies) {
    movies.innerHTML = `<ul class="site-directory-list">
      <li class="site-directory-row">
        <a href="${escapeHtml(directory.movies.href)}">Every movie the platform tracks</a>
      </li>
    </ul>`;
  }
}

// Nothing on this page bakes in a colour, so the switch has nothing to tell.
createThemeSwitch(() => {});

// A Manifest in a shape this build cannot read is answered the same way as
// one that did not arrive: the page says the leagues could not be read and
// still offers Movies, rather than freezing on its loading line. The view model
// reads tolerantly, but a tolerant reader still has to be handed a list.
function directoryFor(manifest) {
  try {
    return buildDirectory(manifest, window.location.pathname);
  } catch (error) {
    console.error('Manifest could not be read', error);
    return buildDirectory(null, window.location.pathname);
  }
}

loadManifest()
  .catch((error) => {
    console.error('Manifest load failed', error);
    return null;
  })
  .then((manifest) => {
    const directory = directoryFor(manifest);
    const variant = import.meta.env.DEV ? requestedVariant() : null;
    if (variant === 'current' || !variant) render(directory);
    if (variant) mountVariant(variant, directory);
  });
