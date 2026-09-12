// The root page's entry point: it reads the Manifest once and draws the
// directory out of it. Everything decided rather than rendered is next door in
// `directory.js` with a test beside it; what is left here is wiring and markup,
// untested by design as the rest of the site's is.
//
// It draws no navigation bar. The page is the navigation opened out, so
// `mountNav` is not called and the shell in `index.html` carries the brand as
// its heading and the theme switch (#81, #84).
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

// One row per year: the year, its Lifecycle badge, and the two pages it holds.
// The year itself leads to the standings as well, so the row reads the way the
// navigation's year entries do and the prototype the layout was settled on did
// (#83). No entry is emphasised over another.
function yearRow(year) {
  return `<li class="site-directory-row">
    <a class="site-directory-year" href="${escapeHtml(year.standingsHref)}">${escapeHtml(year.label)}</a>
    <span class="badge ${stateTone(year.state)} site-nav-badge">${escapeHtml(year.stateLabel)}</span>
    <span class="site-directory-links">
      <a href="${escapeHtml(year.standingsHref)}">Standings</a>
      <a href="${escapeHtml(year.draftHref)}">Draft</a>
    </span>
  </li>`;
}

// A League is a panel that folds, its name a link in the summary. Clicking the
// name goes to the League; clicking anywhere else on the summary folds it, and
// the caret the summary draws for itself turns. A link inside a summary is two
// tab stops, the fold then the page, which is the League page's card toggle
// and title in one row and reads the same way.
function leaguePanel(league) {
  const years = league.years.length
    ? `<ul class="site-directory-list">${league.years.map(yearRow).join('')}</ul>`
    : `<p class="site-directory-note">${escapeHtml(league.yearsNote)}</p>`;

  return `<details class="league-panel site-directory-league" open>
    <summary class="site-directory-summary">
      <a class="site-directory-title" href="${escapeHtml(league.href)}">${escapeHtml(league.name)}</a>
    </summary>
    ${years}
  </details>`;
}

function notePanel(text) {
  return `<div class="league-panel"><p class="site-directory-note">${escapeHtml(text)}</p></div>`;
}

// The brand and the Movies link hang off the path alone, so they are written
// before anything is fetched: the Movies panel is a box in the shell and an
// empty box while the Manifest is in flight would be a wrong thing to show.
function renderShell(directory) {
  const brand = document.getElementById('site-brand');
  if (brand) brand.setAttribute('href', directory.brandHref);

  const movies = document.getElementById('directory-movies');
  if (movies) {
    movies.innerHTML = `<a class="site-directory-title" href="${escapeHtml(directory.movies.href)}">Every movie the platform tracks</a>`;
  }
}

function renderLeagues(directory) {
  const leagues = document.getElementById('directory-leagues');
  if (leagues) {
    leagues.innerHTML = directory.leaguesNote
      ? notePanel(directory.leaguesNote)
      : directory.leagues.map(leaguePanel).join('');
  }
}

// Nothing on this page bakes in a colour, so the switch has nothing to tell.
createThemeSwitch(() => {});

renderShell(buildDirectory(null, window.location.pathname));

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
  .then((manifest) => renderLeagues(directoryFor(manifest)));
