// What the Campaign page calls itself: the heading over the Standings, and the
// tab title, which are the same sentence. Pure: no DOM, no fetching.
//
// The name is the artifact's and the artifact may not carry one. The brand
// stands in, which is the answer the draft page's heading already gives for
// the same gap (`draft/page.js`, `renderChrome`): the two pages sit one segment
// apart and a Campaign with no published League name has to read the same on
// both.
//
// Decided here rather than in `page.js` because it is a decision rather than
// wiring, which is the split every page module in this repo keeps.

import { movieTitleLink } from '../shared/cards.js';
import { escapeHtml } from '../shared/format.js';

const BRAND = 'MovieBoyz';

export function campaignHeading(campaign) {
  return `${campaign.league_name ?? BRAND} ${campaign.year} Standings`;
}

// What the chart over the Standings calls itself, as markup rather than text.
//
// A film named here is a link to its page, as every other film name on the
// page now is (#188), which is why this hands back HTML. Everything it says
// about Users and counts is escaped on the way out, because the page writes
// the result through `innerHTML` and a published name is not this module's to
// trust.
//
// Past two films the heading counts them instead: three names is a list, not a
// heading, and the chart's legend is where the reader reads them off.
export function chartHeadingHtml({
  activeUsers, activeMovieIds, byId, usernames,
}) {
  if (activeMovieIds.length === 1) {
    const title = byId.get(activeMovieIds[0])?.title;
    if (!title) return 'Selected Movie';
    return movieTitleLink(activeMovieIds[0], escapeHtml(title));
  }
  if (activeMovieIds.length === 2) {
    return activeMovieIds
      .map((id) => {
        const title = byId.get(id)?.title;
        return movieTitleLink(id, escapeHtml(title ?? id));
      })
      .join(' · ');
  }
  if (activeMovieIds.length > 2) return `${activeMovieIds.length} Movies`;
  if (activeUsers.length === 1) {
    return `${escapeHtml(usernames.get(activeUsers[0]) ?? activeUsers[0])}: Movie Profits`;
  }
  return 'Profit Over Time';
}
