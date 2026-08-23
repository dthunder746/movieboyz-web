// One Campaign as the landing page's collapsed card: the year, where it sits in
// its life, and who is at the top of it. Pure: no DOM, no fetching.
//
// A card carries no figure from the year it names. Expanding one fetches that
// year's Campaign artifact and renders the Standings out of it (`standings.js`),
// which is what keeps the file everybody fetches light.

import { stateLabel } from '../shared/lifecycle.js';
import { campaignPath } from '../shared/route.js';

// The one Lifecycle state that means the year has not started. Compared by name
// rather than by a list of the states that have, so a state this build has
// never heard of is treated as a scored year and shows whatever the artifact
// says about it, which is how the rest of the site reads one.
const DRAFTING = 'drafting';

// What the User at the top of a Campaign is called, which is the difference
// between a year still being played and a year that is over. A list, because a
// tie records co-winners and the League has no tie-break rule.
function leaderLabel(state, count) {
  if (count === 0) return null;
  if (state === 'final') return count > 1 ? 'Co-winners' : 'Winner';
  return count > 1 ? 'Co-leaders' : 'Leader';
}

// The card's own words when there is nobody to name. Three different silences,
// and saying which one it is is the point of the card:
//
//   drafting  a year nobody has picked in, which must not read as a year
//             everybody scored nothing in
//   final     a year that was closed with nobody eligible, a real if
//             degenerate result and not an unfinished one
//   otherwise a scored year nobody has come out on top of yet
//
// The artifact holds a scored Campaign to naming its leader, so only the first
// of these can arrive from a healthy export. The other two are what a card
// says instead of throwing, because a card that throws takes the column with it.
function emptyMessage(state, count) {
  if (state === DRAFTING) return 'No picks entered yet.';
  if (count > 0) return null;
  return state === 'final' ? 'No winner recorded.' : 'Nobody has scored yet.';
}

// The name is denormalized onto the artifact for the reason the Roster
// denormalizes it: the site has no User registry to look an id up in.
function leaderView(leader) {
  return { userId: leader.user_id, username: leader.username ?? leader.user_id };
}

export function buildCampaignCards(landing) {
  const slug = landing?.league_slug;

  return (landing?.campaigns ?? []).map((campaign) => {
    const drafting = campaign.state === DRAFTING;
    // Null is the artifact's own answer for a `drafting` year and an empty list
    // is a scored year with nobody in it, which is why the two are held apart
    // upstream. Here they collapse: neither names anybody, and `state` is what
    // says which silence this is.
    const leaders = drafting ? [] : (campaign.leader ?? []).map(leaderView);

    return {
      year: campaign.year,
      state: campaign.state,
      stateLabel: stateLabel(campaign.state),
      // A path rather than an href. The site root is a fact about where the
      // page is being served, which only the document can answer, and this
      // module is pure (`shared/route.js`).
      path: campaignPath(slug, campaign.year),
      leaderLabel: drafting ? null : leaderLabel(campaign.state, leaders.length),
      leaders,
      empty: emptyMessage(campaign.state, leaders.length),
      // A drafting year has no Standings worth fetching: they would be a Roster
      // of zeroes, which is the reading its empty state exists to prevent.
      expandable: !drafting,
    };
  });
}
