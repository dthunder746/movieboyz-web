// The navigation every page carries, so that no surface is a dead end (#64).
//
// Its depth is the Manifest's answer rather than a build-time one (decision 20
// of the parent spec, #58). While one League is published its years are the
// navigation; publish a second and the years move under a League menu, with no
// code change and no deploy. `buildNav` is where that decision is made and it
// is the half with a test beside it.
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
import { campaignFromPath, isMoviesPath, siteRoot } from './route.js';

// What a Lifecycle state is called in the badge. A state this build has not
// heard of is shown as the artifact wrote it: the Manifest is read tolerantly,
// and dropping a year because its state is unfamiliar would hide a Campaign.
const STATE_LABELS = {
  drafting: 'Drafting',
  active: 'Active',
  final: 'Final',
};

// The badge's tone per state. Read by the renderer below rather than published
// on the view model, because it is a Bootstrap class and not a fact.
const STATE_TONE = {
  drafting: 'text-bg-secondary',
  active: 'text-bg-success',
  final: 'text-bg-primary',
};

export function buildNav(manifest, pathname) {
  const root = siteRoot(pathname);
  const here = campaignFromPath(pathname);
  const leagues = manifest?.leagues ?? [];

  const built = leagues.map((league) => ({
    slug: league.slug,
    name: league.name ?? league.slug,
    current: Boolean(here) && here.leagueSlug === league.slug,
    years: buildYears(league, root, here),
  }));

  // One League is the whole site today, so its years are the navigation. A
  // second published League is what puts them behind a menu.
  const menued = built.length > 1;

  return {
    brandHref: root,
    mode: menued ? 'leagues' : 'years',
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
      stateLabel: STATE_LABELS[campaign.state] ?? campaign.state,
      href: `${root}league/${league.slug}/${campaign.year}/`,
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

  const nav = buildNav(manifest, window.location.pathname);

  const brand = document.getElementById('site-brand');
  if (brand) brand.setAttribute('href', nav.brandHref);

  const entries =
    nav.mode === 'leagues'
      ? nav.leagues.map(leagueMenu)
      : nav.years.map((year) => yearLink(year, 'site-nav-link'));

  entries.push(moviesLink(nav.movies));
  host.innerHTML = entries.join('');
}

function leagueMenu(league) {
  const items = league.years
    .map((year) => `<li>${yearLink(year, 'dropdown-item')}</li>`)
    .join('');

  return `<div class="dropdown">
      <button class="site-nav-link dropdown-toggle${league.current ? ' is-current' : ''}"
        type="button" data-bs-toggle="dropdown" aria-expanded="false">${escapeHtml(league.name)}</button>
      <ul class="dropdown-menu">${items}</ul>
    </div>`;
}

function yearLink(year, className) {
  const tone = STATE_TONE[year.state] ?? 'text-bg-secondary';
  const badge = year.stateLabel
    ? ` <span class="badge ${tone} site-nav-badge">${escapeHtml(year.stateLabel)}</span>`
    : '';

  return `<a class="${className}${year.current ? ' is-current' : ''}" href="${year.href}"${
    year.current ? ' aria-current="page"' : ''
  }>${escapeHtml(year.label)}${badge}</a>`;
}

function moviesLink(movies) {
  return `<a class="site-nav-link${movies.current ? ' is-current' : ''}" href="${movies.href}"${
    movies.current ? ' aria-current="page"' : ''
  }>Movies</a>`;
}
