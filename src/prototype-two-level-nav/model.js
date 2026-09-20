// PROTOTYPE — throwaway. The view model both readings render, for platform#168.
//
// #157 put every League behind one fixed `Leagues` toggle but left that menu
// one level deep: it lists Leagues, and the reader's own League gets a second
// bar entry holding the years. #168 asks for the other shape — no League ever
// gets a bar entry, and the years hang off the League inside the menu, so the
// menu is two levels.
//
// Deliberately not `src/shared/nav.js`: that builds the bar this is proposing
// to replace, and a prototype importing it would be judging the shape it is
// replacing. This is the #168 shape.

import { stateLabel, stateTone } from '../shared/lifecycle.js';

// How the second level opens without a hover. The question the ticket calls
// touch: a cascade that only opens on hover has no answer on a phone, and the
// answer it picks decides whether a League name is a link at level one.
export const TOUCH_MODES = {
  'tap-row': 'tap-row — row opens submenu, name not a link',
  split: 'split — name links to Overview, chevron opens',
  drill: 'drill — narrow replaces level one, wide = tap-row',
};

// What a year's row holds. #83 settled `alone`; the other two are rendered so
// that can be confirmed or reversed against the two level shape rather than
// against the flat one it was decided on.
export const YEAR_MODES = {
  alone: 'alone — year only (as #83 settled)',
  trailing: 'trailing — year + small Draft link',
  'two-rows': 'two-rows — a Standings row and a Draft row',
};

// Where the reader is told they are, when they are inside a League.
export const MARK_MODES = {
  toggle: 'toggle — bar Leagues highlighted + row marked',
  'rows-only': 'rows-only — nothing in the bar, rows only',
};

export function readPath(pathname) {
  const segments = String(pathname ?? '').split('/').filter(Boolean);

  if (!segments.length) return { kind: 'root' };
  if (segments[0] === 'movies') return { kind: 'movies' };

  if (segments[0] === 'league' && segments[1]) {
    const leagueSlug = segments[1];
    if (!segments[2]) return { kind: 'landing', leagueSlug };
    const year = Number(segments[2]);
    if (segments[3] === 'draft') return { kind: 'draft', leagueSlug, year };
    return { kind: 'campaign', leagueSlug, year };
  }

  return { kind: 'unknown' };
}

export function buildModel(manifest, pathname, modes) {
  const { touch = 'tap-row', year = 'alone', mark = 'toggle' } = modes ?? {};
  const here = readPath(pathname);
  const published = manifest?.leagues ?? [];
  const insideAny = published.some((entry) => entry.slug === here.leagueSlug);

  const leagues = published.map((entry) => {
    const inside = entry.slug === here.leagueSlug;

    return {
      slug: entry.slug,
      name: entry.name ?? entry.slug,
      href: `/league/${entry.slug}/`,
      // The reader is inside this League, on either of its addresses. In both
      // marking modes this dresses the row; only `rows-only` leans on it as the
      // whole of what says where the reader is.
      inside,
      // The League's own landing page, reached from the second level's first
      // row. A page like any other, so it can be the marked one.
      overviewCurrent: inside && here.kind === 'landing',
      years: [...(entry.campaigns ?? [])]
        .sort((left, right) => right.year - left.year)
        .map((campaign) => buildYear(campaign, entry, inside, here, year)),
    };
  });

  return {
    here,
    brandHref: '/',
    leagues,
    movies: { href: '/movies/', current: here.kind === 'movies' },
    // The bar's own highlight, and the entire difference between the two
    // marking modes. In `toggle` the Leagues toggle lights up anywhere inside
    // any League; in `rows-only` nothing in the bar ever does, so a closed bar
    // says nothing at all about where the reader is.
    leaguesToggleCurrent: mark === 'toggle' && insideAny,
    modes: { touch, year, mark },
  };
}

function buildYear(campaign, league, inside, here, yearMode) {
  const standingsHref = `/league/${league.slug}/${campaign.year}/`;
  const draftHref = `${standingsHref}draft/`;
  const onYear = inside && here.year === campaign.year;
  const onStandings = onYear && here.kind === 'campaign';
  const onDraft = onYear && here.kind === 'draft';

  return {
    year: campaign.year,
    label: String(campaign.year),
    state: campaign.state,
    stateLabel: stateLabel(campaign.state),
    stateTone: stateTone(campaign.state),
    standingsHref,
    draftHref,
    // With no Draft entry in the menu the year is the League's only entry for
    // that year, so it is marked on both of the year's pages: a reader on a
    // draft page still has to see where they are. With one, the two split.
    standingsCurrent: yearMode === 'alone' ? onStandings || onDraft : onStandings,
    draftCurrent: yearMode !== 'alone' && onDraft,
  };
}

// Every address the current Manifest answers, for the `?path=` picker.
export function addresses(manifest) {
  const paths = [{ path: '/', label: '/  (root directory)' }];

  for (const league of manifest?.leagues ?? []) {
    paths.push({ path: `/league/${league.slug}/`, label: `${league.name} — overview` });
    for (const campaign of [...(league.campaigns ?? [])].sort((l, r) => r.year - l.year)) {
      paths.push({
        path: `/league/${league.slug}/${campaign.year}/`,
        label: `${league.name} ${campaign.year} — standings`,
      });
      paths.push({
        path: `/league/${league.slug}/${campaign.year}/draft/`,
        label: `${league.name} ${campaign.year} — draft`,
      });
    }
  }

  paths.push({ path: '/movies/', label: 'Movies' });
  return paths;
}
