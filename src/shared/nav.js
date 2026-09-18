// The navigation every page carries, so that no surface is a dead end (#64).
//
// Three entries at most, however many Leagues the Manifest holds (#157). With
// one League published the bar is that League's menu and Movies; publish a
// second and a fixed Leagues menu leads the bar, holding every League by name.
// The count lives inside a menu rather than in the bar, so the bar is the same
// width for ten Leagues as for two.
//
// Its depth is still the Manifest's answer rather than a build-time one
// (decision 20 of the parent spec, #58, as amended by #157): publishing a
// second League adds the Leagues menu with no code change and no deploy.
// `buildNav` is where that decision is made and it is the half with a test
// beside it.
//
// The second entry is the one League the reader is inside, by either of the two
// addresses that name a League. At a path naming none, which is the Movies page
// and the root, the entry is absent rather than guessed at.
//
// Exactly one entry is ever marked. A Campaign marks its year rather than its
// League, so Overview is marked only on the League's own landing page (#67).
// The League's toggle is highlighted anywhere inside that League, which dresses
// the menu the marked entry hangs under rather than saying where the reader is,
// and the Leagues toggle is never marked at all.
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
  const published = manifest?.leagues ?? [];

  // The one League the reader is inside, by either address. A path can name a
  // League the Manifest has never heard of, which is what the catch-all page
  // renders under, and that is nobody's League: the entry is left off rather
  // than invented.
  const inside = landing?.leagueSlug ?? here?.leagueSlug ?? null;
  const league = published.find((entry) => entry.slug === inside) ?? null;

  return {
    brandHref: root,
    // One League is no choice, so the menu that offers the choice is absent
    // until a second is published.
    leagues:
      published.length > 1
        ? {
            items: published.map((entry) => ({
              slug: entry.slug,
              name: entry.name ?? entry.slug,
              href: leagueHref(root, entry.slug),
              // Bold rather than marked: it says which of the listed Leagues
              // the reader is in, not which entry of the bar they are on.
              current: entry.slug === league?.slug,
            })),
            // The site root is already the directory of every League and year
            // (#81, #84), so the menu points at it rather than repeating it.
            showAllHref: root,
          }
        : null,
    league: league && {
      slug: league.slug,
      name: league.name ?? league.slug,
      href: leagueHref(root, league.slug),
      // Inside this League, by either address. It dresses the menu the years
      // hang under, which the reader is inside whichever of the two they are on.
      current: true,
      // On this League's own landing page, which is a link and can only be one
      // place. A Campaign marks its year rather than its League, so exactly one
      // entry is ever marked.
      landing: Boolean(landing),
      years: buildYears(league, root, here),
    },
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

  // At most three, in the order the reader narrows: every League, then the one
  // they are inside, then the lookup that belongs to none of them (#157).
  const entries = [
    ...(nav.leagues ? [leaguesMenu(nav.leagues)] : []),
    ...(nav.league ? [leagueMenu(nav.league)] : []),
    moviesLink(nav.movies),
  ];

  host.innerHTML = entries.join('');
}

// Every published League, behind one fixed toggle. The toggle is never marked,
// because it leads to all of them and is where none of them is; the League the
// reader is inside is bold inside the menu instead.
function leaguesMenu(leagues) {
  const items = leagues.items
    .map(
      (league) =>
        `<li><a class="dropdown-item${league.current ? ' fw-bold' : ''}"
          href="${escapeHtml(league.href)}">${escapeHtml(league.name)}</a></li>`,
    )
    .join('');

  return `<div class="dropdown">
      <button class="site-nav-link dropdown-toggle" type="button"
        data-bs-toggle="dropdown" aria-expanded="false">Leagues</button>
      <ul class="dropdown-menu">${items}<li><hr class="dropdown-divider"></li>
        <li><a class="dropdown-item" href="${escapeHtml(leagues.showAllHref)}">Show all</a></li></ul>
    </div>`;
}

function leagueMenu(league) {
  // The landing page leads the menu, where it is labelled for its job rather
  // than repeating the League name the toggle above it already carries.
  const overview = `<li><a class="dropdown-item${league.landing ? ' is-current' : ''}"
      href="${escapeHtml(league.href)}"${league.landing ? ' aria-current="page"' : ''}>Overview</a></li>`;

  const items = league.years.map((year) => `<li>${yearLink(year)}</li>`).join('');

  return `<div class="dropdown">
      <button class="site-nav-link dropdown-toggle${league.current ? ' is-current' : ''}"
        type="button" data-bs-toggle="dropdown" aria-expanded="false">${escapeHtml(league.name)}</button>
      <ul class="dropdown-menu">${overview}<li><hr class="dropdown-divider"></li>${items}</ul>
    </div>`;
}

function yearLink(year) {
  const tone = stateTone(year.state);
  const badge = year.stateLabel
    ? ` <span class="badge ${tone} site-nav-badge">${escapeHtml(year.stateLabel)}</span>`
    : '';

  return `<a class="dropdown-item${year.current ? ' is-current' : ''}" href="${escapeHtml(year.href)}"${
    year.current ? ' aria-current="page"' : ''
  }>${escapeHtml(year.label)}${badge}</a>`;
}

function moviesLink(movies) {
  return `<a class="site-nav-link${movies.current ? ' is-current' : ''}" href="${escapeHtml(movies.href)}"${
    movies.current ? ' aria-current="page"' : ''
  }>Movies</a>`;
}
