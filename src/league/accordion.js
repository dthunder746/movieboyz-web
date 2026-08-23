// What expanding or collapsing a card should do. Pure: it decides, and the page
// carries it out and holds the cache the decision is made against.
//
// The landing artifact carries no figure from a year, so a card's Standings
// have to be fetched, and they are fetched when the reader asks for them rather
// than on the way to first paint. That does not conflict with the load-order
// amendment made for the Campaign page (spec #58, decision 11): that was about
// a serialised chain blocking first paint, and an expand is user triggered.
//
// The cache entry is whatever the page has for that year: absent, `loading`,
// `ready` with the Campaign artifact on it, or `failed`.

export function expansionAction({ open, entry } = {}) {
  // Nothing a collapse needs to know about the cache. What was fetched stays
  // fetched, which is what makes reopening free.
  if (!open) return 'collapse';

  // A failed fetch is not an answer, so reopening the card asks again: a year
  // whose artifact was briefly unreachable should not stay unreachable for the
  // life of the page.
  if (!entry || entry.status === 'failed') return 'fetch';

  // A second click while the first request is still out would put an identical
  // one on the wire and race it back.
  if (entry.status === 'loading') return 'wait';

  return 'render';
}
