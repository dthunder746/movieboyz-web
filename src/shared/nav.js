// The navigation every page carries, so that no surface is a dead end (#64).
//
// Its depth is the Manifest's answer rather than a build-time one (decision 20
// of the parent spec, #58). While one League is published its landing page and
// its years are the navigation; publish a second and both move under a League
// menu, with no code change and no deploy. `buildNav` is where that decision is
// made and it is the half with a test beside it.
//
// Exactly one entry is ever marked. A Campaign marks its year rather than its
// League, so the League entry is marked only on the League's own landing page
// (#67).
//
// Links are absolute from the site root rather than relative, because the same
// build serves from the domain apex and from a Pages project path, and because
// the catch-all page sets a `<base>` a `../` would be counted against twice
// (`route.js`).
//
// The file splits in two at the divider below: a pure view model above, the DOM
// it becomes underneath, which is the split every page group in this site sits
// on.

import { escapeHtml } from './format.js';
import { stateLabel, stateTone } from './lifecycle.js';
import { documentRoot } from './location.js';
import {
  campaignFromPath,
  campaignHref,
  isMoviesPath,
  leagueFromPath,
  leagueHref,
  siteRoot,
} from './route.js';

export function buildNav(manifest, pathname, explicitRoot) {
  const root = siteRoot(pathname, explicitRoot);
  const here = campaignFromPath(pathname);
  // The League landing page is the other address that names a League, and the
  // two never both answer: a landing path carries no year and a Campaign path
  // is not a landing (`route.js`).
  const landing = leagueFromPath(pathname);
  const leagues = manifest?.leagues ?? [];

  const built = leagues.map((league) => {
    const onLanding = Boolean(landing) && landing.leagueSlug === league.slug;

    return {
      slug: league.slug,
      name: league.name ?? league.slug,
      href: leagueHref(root, league.slug),
      // Inside this League, by either address. It dresses the menu the years
      // hang under, which the reader is inside whichever of the two they are on.
      current: onLanding || (Boolean(here) && here.leagueSlug === league.slug),
      // On this League's own landing page, which is a link and can only be one
      // place. A Campaign marks its year rather than its League, so exactly one
      // entry is ever marked.
      landing: onLanding,
      years: buildYears(league, root, here),
    };
  });

  // One League is the whole site today, so its years are the navigation. A
  // second published League is what puts them behind a menu.
  const menued = built.length > 1;

  return {
    brandHref: root,
    mode: menued ? 'leagues' : 'years',
    // The one League's landing entry, sitting at the top level beside its own
    // years. With a menu it moves inside that menu instead, so that two
    // Leagues do not put two more entries in the bar (#67).
    league: menued ? null : (built[0] ?? null),
    leagues: menued ? built : [],
    years: menued ? [] : (built[0]?.years ?? []),
    movies: { href: `${root}movies/`, current: isMoviesPath(pathname) },
  };
}

// Newest first, which is the order the League thinks about its years in and the
// order the Manifest's own year menu is documented to read.
function buildYears(league, root, here) {
  return [...(league.campaigns ?? [])]
    .sort((left, right) => right.year - left.year)
    .map((campaign) => ({
      leagueSlug: league.slug,
      year: campaign.year,
      label: String(campaign.year),
      state: campaign.state,
      stateLabel: stateLabel(campaign.state),
      href: campaignHref(root, league.slug, campaign.year),
      // A path can name a year the Manifest does not list, which is exactly what
      // the catch-all page renders under. Nothing is marked for it.
      current:
        Boolean(here) && here.leagueSlug === league.slug && here.year === campaign.year,
    }));
}

// ── The DOM it becomes ────────────────────────────────────────────────────
//
// Untested by design, as the rest of the site's wiring is. Everything decided
// rather than rendered is above the divider.

export function mountNav(manifest) {
  const host = document.getElementById('site-nav');
  if (!host) return;

  const nav = buildNav(manifest, window.location.pathname, documentRoot());

  const brand = document.getElementById('site-brand');
  if (brand) brand.setAttribute('href', nav.brandHref);

  const entries =
    nav.mode === 'leagues'
      ? nav.leagues.map(leagueMenu)
      : [
          ...(nav.league ? [leagueLink(nav.league)] : []),
          ...nav.years.map((year) => yearLink(year, 'site-nav-link')),
        ];

  entries.push(moviesLink(nav.movies));
  host.innerHTML = entries.join('');
}

// The League's own landing page, at the top level. It leads the years because
// the League is what they belong to.
function leagueLink(league) {
  return `<a class="site-nav-link${league.landing ? ' is-current' : ''}" href="${escapeHtml(league.href)}"${
    league.landing ? ' aria-current="page"' : ''
  }>${escapeHtml(league.name)}</a>`;
}

function leagueMenu(league) {
  // The landing page leads the menu, where it is labelled for its job rather
  // than repeating the League name the toggle above it already carries.
  const overview = `<li><a class="dropdown-item${league.landing ? ' is-current' : ''}"
      href="${escapeHtml(league.href)}"${league.landing ? ' aria-current="page"' : ''}>Overview</a></li>`;

  const items = league.years
    .map((year) => `<li>${yearLink(year, 'dropdown-item')}</li>`)
    .join('');

  return `<div class="dropdown">
      <button class="site-nav-link dropdown-toggle${league.current ? ' is-current' : ''}"
        type="button" data-bs-toggle="dropdown" aria-expanded="false">${escapeHtml(league.name)}</button>
      <ul class="dropdown-menu">${overview}<li><hr class="dropdown-divider"></li>${items}</ul>
    </div>`;
}

function yearLink(year, className) {
  const tone = stateTone(year.state);
  const badge = year.stateLabel
    ? ` <span class="badge ${tone} site-nav-badge">${escapeHtml(year.stateLabel)}</span>`
    : '';

  return `<a class="${className}${year.current ? ' is-current' : ''}" href="${escapeHtml(year.href)}"${
    year.current ? ' aria-current="page"' : ''
  }>${escapeHtml(year.label)}${badge}</a>`;
}

function moviesLink(movies) {
  return `<a class="site-nav-link${movies.current ? ' is-current' : ''}" href="${escapeHtml(movies.href)}"${
    movies.current ? ' aria-current="page"' : ''
  }>Movies</a>`;
}
