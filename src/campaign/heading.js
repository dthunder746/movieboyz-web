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

const BRAND = 'MovieBoyz';

export function campaignHeading(campaign) {
  return `${campaign.league_name ?? BRAND} ${campaign.year} Standings`;
}
