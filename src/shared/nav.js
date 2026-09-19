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
// addresses that name a League. Where the path names none, which is the Movies
// page and the root, it depends on how many are published: the one League stays
// in the bar, so that the bar never falls to a single entry the reader is
// already standing on, while one of several would be a guess and is left out.
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

  // The League the reader is inside, by either address. A path can name a
  // League the Manifest has never heard of, which is what the catch-all page
  // renders under, and that is nobody's League.
  const inside =
    published.find((entry) => entry.slug === (landing?.leagueSlug ?? here?.leagueSlug)) ?? null;

  // With one League published it is the whole site, so it is in the bar on
  // every page, including the ones naming no League. That keeps the one League
  // bar and the several League bar reading the same, and it is what stops the
  // Movies page from being a bar of one entry, which is the page the reader is
  // already standing on. With several published there is a Leagues menu to get
  // back through, so the entry is the reader's own League or nothing.
  const league = inside ?? (published.length === 1 ? published[0] : null);

  const leagues =
    published.length > 1
      ? {
          items: published.map((entry) => ({
            slug: entry.slug,
            name: entry.name ?? entry.slug,
            href: leagueHref(root, entry.slug),
            // Highlighted rather than marked: it says which of the listed
            // Leagues the reader is in, not which entry of the bar they are on.
            current: entry.slug === inside?.slug,
          })),
          // The site root is already the directory of every League and year
          // (#81, #84), so the menu points at it rather than repeating it.
          showAllHref: root,
        }
      : null;

  const leagueEntry = league && {
    slug: league.slug,
    name: league.name ?? league.slug,
    href: leagueHref(root, league.slug),
    // Inside this League, by either address. It dresses the menu the years hang
    // under, which the reader is inside whichever of the two they are on, and
    // which they are not on a page naming no League at all.
    current: league === inside,
    // On this League's own landing page, which is a link and can only be one
    // place. A Campaign marks its year rather than its League, so exactly one
    // entry is ever marked.
    landing: Boolean(landing) && league === inside,
    years: buildYears(league, root, here),
  };

  const movies = { href: `${root}movies/`, current: isMoviesPath(pathname) };

  return {
    brandHref: root,
    // One League is no choice, so the menu that offers the choice is absent
    // until a second is published.
    leagues,
    league: leagueEntry,
    movies,
    // The bar itself: the entries that are present, in the order the reader
    // narrows, and never more than three however many Leagues are published
    // (#157). `current` is the highlight the bar carries rather than the mark,
    // which is why the Leagues entry never has it: it leads to every League and
    // is where none of them is. What each entry holds hangs off the named
    // fields above, because the three are shaped differently.
    entries: [
      ...(leagues ? [{ kind: 'leagues', label: 'Leagues', current: false }] : []),
      ...(leagueEntry
        ? [{ kind: 'league', label: leagueEntry.name, current: leagueEntry.current }]
        : []),
      { kind: 'movies', label: 'Movies', current: movies.current },
    ],
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

// The same navigation, flattened, for the widths where the bar is one button
// (#165). Below the breakpoint three menus side by side do not fit, so the
// entries become one overlay list, one level deep: every League, then the
// reader's own League's Overview and years, then the lookup. It is a reading of
// `buildNav` rather than a second reading of the Manifest, so the two cannot
// drift: what the bar holds is what the overlay holds, in the same order.
//
// `current` is the highlight and `marked` is the mark, kept apart for the
// reason the bar keeps them apart: a listed League is highlighted to say which
// of them the reader is in, while exactly one item is marked to say which page
// they are on. A header is a label with nowhere to go.
export function buildCompactMenu(nav) {
  const items = [];

  if (nav.leagues) {
    items.push({ kind: 'header', label: 'Leagues' });
    for (const league of nav.leagues.items) {
      items.push(link(league.name, league.href, { current: league.current }));
    }
    // The way out of one League and into the directory that lists them all,
    // which is the job the bar's own Leagues menu ends on.
    items.push(link('Show all', nav.leagues.showAllHref));
  }

  if (nav.league) {
    // The League names its own section, so the years below it need no prefix
    // and Overview is labelled for its job, exactly as in the bar's menu.
    items.push({ kind: 'header', label: nav.league.name });
    items.push(
      link('Overview', nav.league.href, { current: nav.league.landing, marked: nav.league.landing }),
    );
    for (const year of nav.league.years) {
      items.push(
        link(year.label, year.href, {
          current: year.current,
          marked: year.current,
          state: year.state,
          stateLabel: year.stateLabel,
        }),
      );
    }
  }

  items.push(link('Movies', nav.movies.href, { current: nav.movies.current, marked: nav.movies.current }));

  return items;
}

function link(label, href, { current = false, marked = false, state, stateLabel } = {}) {
  return { kind: 'link', label, href, current, marked, state, stateLabel };
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

  // The bar is the view model's `entries` in its own order, so the shape is
  // decided above the divider and only the drawing happens here.
  host.innerHTML = nav.entries
    .map((entry) => {
      if (entry.kind === 'leagues') return leaguesMenu(nav.leagues, entry);
      if (entry.kind === 'league') return leagueMenu(nav.league, entry);
      return moviesLink(nav.movies, entry);
    })
    .join('');
}

// The shell both menus are: a toggle carrying the bar's highlight and the list
// that drops from it. Written once so the two cannot drift apart, since the
// point of the bar is that they read the same.
function dropdown(label, current, items) {
  return `<div class="dropdown">
      <button class="site-nav-link dropdown-toggle${current ? ' is-current' : ''}"
        type="button" data-bs-toggle="dropdown" aria-expanded="false">${escapeHtml(label)}</button>
      <ul class="dropdown-menu">${items}</ul>
    </div>`;
}

const DIVIDER = '<li><hr class="dropdown-divider"></li>';

// Every published League, behind one fixed toggle. The toggle never carries the
// highlight, because it leads to all of them and is where none of them is; the
// League the reader is inside is highlighted inside the menu instead, with no
// `aria-current`, because that is where the menu leads rather than the page the
// reader is on.
function leaguesMenu(leagues, entry) {
  const items = leagues.items
    .map(
      (league) =>
        `<li><a class="dropdown-item${league.current ? ' is-current' : ''}"
          href="${escapeHtml(league.href)}">${escapeHtml(league.name)}</a></li>`,
    )
    .join('');

  const showAll = `<li><a class="dropdown-item"
      href="${escapeHtml(leagues.showAllHref)}">Show all</a></li>`;

  return dropdown(entry.label, entry.current, `${items}${DIVIDER}${showAll}`);
}

function leagueMenu(league, entry) {
  // The landing page leads the menu, where it is labelled for its job rather
  // than repeating the League name the toggle above it already carries.
  const overview = `<li><a class="dropdown-item${league.landing ? ' is-current' : ''}"
      href="${escapeHtml(league.href)}"${league.landing ? ' aria-current="page"' : ''}>Overview</a></li>`;

  const years = league.years.map((year) => `<li>${yearLink(year)}</li>`).join('');

  return dropdown(entry.label, entry.current, `${overview}${DIVIDER}${years}`);
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

function moviesLink(movies, entry) {
  return `<a class="site-nav-link${movies.current ? ' is-current' : ''}" href="${escapeHtml(movies.href)}"${
    movies.current ? ' aria-current="page"' : ''
  }>${escapeHtml(entry.label)}</a>`;
}
