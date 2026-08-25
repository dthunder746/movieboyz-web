// PROTOTYPE — throwaway. The view model all three variants render.
//
// Deliberately not `src/shared/nav.js`: #81 changes what `buildNav` returns
// (the `mode: 'leagues' | 'years'` switch goes away for an always present
// Leagues section) and a prototype that imports the old shape would be judging
// the shape it is replacing. This is the #81 shape, written once so the three
// variants disagree about layout and nothing else.
//
// What it settles, and what every variant therefore shares:
//   - two sections in the bar, Leagues and Movies, whatever the League count
//   - `Leagues` opens a menu and is not itself a link
//   - one League lists flat inside that menu, two or more group per League
//   - every year row carries two targets, the year and Draft
//   - on a draft page the Draft entry is marked, not the year
//   - exactly one entry is ever marked

import { stateLabel, stateTone } from '../shared/lifecycle.js';

// Which surface the pretend path names. The real site reads this off
// `window.location`; the prototype is told, so every page can be seen without
// building any of them.
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

// What a year's row in the menu holds. The one question left open on #83 once
// the page set is settled: a Campaign is one page plus a draft page, so the bar
// either carries both addresses or carries one and lets the page carry the
// other.
//
//   two-link    the year and Draft, side by side. As #81 settled it.
//   year-only   the year alone. Draft is reached from the Campaign page.
//   state-aware the year alone, but pointing at the draft page while the year
//               is `drafting`, because that is what the year *is* then and its
//               standings page is empty until the slate is picked.
export const YEAR_MODES = {
  'two-link': 'Year + Draft',
  'year-only': 'Year only',
  'state-aware': 'Year only, state aware',
};

export function buildModel(manifest, pathname, yearMode = 'two-link') {
  const here = readPath(pathname);
  const leagues = (manifest?.leagues ?? []).map((league) => {
    const inside = here.leagueSlug === league.slug;

    return {
      slug: league.slug,
      name: league.name ?? league.slug,
      href: `/league/${league.slug}/`,
      // Dresses the group the years hang under. True on either of the League's
      // two addresses, because the reader is inside the League on both.
      current: inside,
      // The landing page is a link, and can be the one marked entry.
      landing: inside && here.kind === 'landing',
      years: [...(league.campaigns ?? [])]
        .sort((left, right) => right.year - left.year)
        .map((campaign) => year(campaign, league, inside, here, yearMode)),
    };
  });

  return {
    here,
    brandHref: '/',
    // One League lists flat inside the Leagues menu; two or more group. The
    // bar's own shape does not change either way — only what the menu holds.
    grouped: leagues.length > 1,
    leagues,
    movies: { href: '/movies/', current: here.kind === 'movies' },
    yearMode,
  };
}

function year(campaign, league, inside, here, yearMode) {
  const standingsHref = `/league/${league.slug}/${campaign.year}/`;
  const draftHref = `${standingsHref}draft/`;
  const onYear = inside && here.year === campaign.year;

  // Where the year's own link goes. Only `state-aware` makes this depend on
  // anything, which is the whole of what it is here to be judged on: the same
  // word means a different destination in a different Lifecycle state.
  const linkHref =
    yearMode === 'state-aware' && campaign.state === 'drafting' ? draftHref : standingsHref;

  const showDraft = yearMode === 'two-link';

  return {
    year: campaign.year,
    label: String(campaign.year),
    state: campaign.state,
    stateLabel: stateLabel(campaign.state),
    stateTone: stateTone(campaign.state),
    href: linkHref,
    standingsHref,
    draftHref,
    showDraft,
    // Exactly one entry is ever marked, in all three modes. With Draft in the
    // row the year is marked on the standings page and Draft on the draft page,
    // so the two never both light up. Without it the year is the only entry the
    // League has, so it is marked on both of its pages — a reader on a draft
    // page still has to be able to see where they are.
    current: showDraft
      ? onYear && here.kind === 'campaign'
      : onYear && (here.kind === 'campaign' || here.kind === 'draft'),
    draftCurrent: showDraft && onYear && here.kind === 'draft',
  };
}

// Every address the current Manifest answers, for the prototype's page picker.
export function addresses(manifest) {
  const paths = [{ path: '/', label: '/  (root directory)' }];

  for (const league of manifest?.leagues ?? []) {
    paths.push({ path: `/league/${league.slug}/`, label: `${league.name} — landing` });
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
