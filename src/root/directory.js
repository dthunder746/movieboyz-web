// The root page's view model: everything the site holds, opened out flat.
//
// The root used to redirect to whatever Campaign the Manifest named as its
// default view, which picked one League arbitrarily once there were two and
// dead-ended off season, when no Campaign is `active` and the field is null.
// Now it is a directory: every League, every year, and the two pages each year
// holds, all visible at once with nothing to click open (#81, #84).
//
// It reads the Manifest and nothing else, so no figure is shown and no entry
// outweighs another, and a new year appears the moment its artifact lands
// rather than waiting on a deploy. Pure: no DOM, no fetching. The DOM it
// becomes is in `page.js`, which is the split every page group sits on.

import { stateLabel } from '../shared/lifecycle.js';
import { campaignHref, draftHref, leagueHref, siteRoot } from '../shared/route.js';

// The page's own words when there is nothing to list. Three different silences,
// and saying which one it is is the point of the page:
//
//   null Manifest   the artifact did not load, which is a fault
//   no Leagues      the platform has published nothing yet, which is not
//   no Campaigns    a League that has not run a year yet, said under the League
//
// The Movies lookup reads no League file, so it is offered whichever silence
// this is, and the root is never a dead end (#64).
const UNREADABLE = 'The published leagues could not be read.';
const NO_LEAGUES = 'No league has been published yet.';
const NO_YEARS = 'No year has been published yet.';

export function buildDirectory(manifest, pathname) {
  const root = siteRoot(pathname);
  const leagues = (manifest?.leagues ?? []).map((league) => {
    const years = buildYears(league, root);

    return {
      slug: league.slug,
      name: league.name ?? league.slug,
      href: leagueHref(root, league.slug),
      years,
      yearsNote: years.length ? null : NO_YEARS,
    };
  });

  return {
    brandHref: root,
    leagues,
    leaguesNote: leaguesNote(manifest, leagues),
    movies: { href: `${root}movies/` },
  };
}

function leaguesNote(manifest, leagues) {
  if (!manifest) return UNREADABLE;
  return leagues.length ? null : NO_LEAGUES;
}

// Newest first, as the navigation lists them: it is the order the League thinks
// about its years in.
function buildYears(league, root) {
  return [...(league.campaigns ?? [])]
    .sort((left, right) => right.year - left.year)
    .map((campaign) => ({
      year: campaign.year,
      label: String(campaign.year),
      state: campaign.state,
      stateLabel: stateLabel(campaign.state),
      standingsHref: campaignHref(root, league.slug, campaign.year),
      draftHref: draftHref(root, league.slug, campaign.year),
    }));
}
