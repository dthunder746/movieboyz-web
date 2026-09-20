// What the landing page calls the League it is showing, and the sentence under
// it. Pure: no DOM, no fetching.
//
// Both read the same name off the landing artifact, and the artifact may not
// carry one. The slug is what the page's own address named the League by and is
// always there, so that is what stands in; the generic word is the last resort
// for an artifact carrying neither. The title and the lede share the chain
// rather than each guessing, so a League with no published name reads the same
// in both places.

export function leagueName(landing) {
  return landing.league_name ?? landing.league_slug ?? 'League';
}

export function leagueLede(landing) {
  return `Every campaign that ${leagueName(landing)} has run, and who is ahead across all of them.`;
}
