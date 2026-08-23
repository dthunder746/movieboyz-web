// What the League landing page asks the network for. The fetch plumbing itself
// is shared (`../shared/artifacts.js`); what lives here is which artifacts this
// page needs and when, which is the split `campaign/data.js` and `movies/data.js`
// sit on the other side of (#59).
//
// The page is one fetch. The landing artifact carries the whole mega league and
// a card per Campaign, which is what it exists for, and the page computes no
// figure it does not carry. The Manifest goes out beside it, for the navigation
// rather than for the page: the URL already names the League, so nothing here
// waits on it.
//
// The accordion's fetch is the second half, below. It is made when a reader
// expands a card, so it is not on the path to first paint and does not undo the
// load-order work of #53.

import { fetchArtifact, loadManifest, speculate } from '../shared/artifacts.js';

// A landing artifact that did not load, carrying enough for the page to be
// legible about it: which League was asked for, whether the Manifest lists it at
// all, and the Manifest itself so the navigation still renders (#64).
export class LeagueUnavailable extends Error {
  constructor({ manifest, leagueSlug, cause }) {
    super(`The ${leagueSlug} league could not be loaded`, { cause });
    this.name = 'LeagueUnavailable';
    this.manifest = manifest;
    this.leagueSlug = leagueSlug;
    // A League the Manifest lists and whose file is missing is a publishing
    // failure; a League it does not list was never published at all. A Manifest
    // that did not load itself answers neither, and reads as the second, which
    // is the one the page can say something useful about.
    this.published = (manifest?.leagues ?? []).some((league) => league.slug === leagueSlug);
  }
}

export async function loadLeague({ leagueSlug } = {}) {
  // Both in flight before either is awaited. The landing artifact is speculative
  // only in the sense that nothing has confirmed the League exists; the page's
  // own address is what named it, and a League that is not published costs one
  // request and a legible page.
  const pendingManifest = loadManifest();
  const pendingLanding = speculate(`leagues/${leagueSlug}/index.json`);

  // The Manifest is the navigation's, not the page's. It failing is survivable
  // and the landing artifact failing is not, so they are awaited apart.
  const manifest = await pendingManifest.catch((error) => {
    console.warn('Manifest did not load', error);
    return null;
  });

  try {
    return { manifest, landing: await pendingLanding };
  } catch (cause) {
    throw new LeagueUnavailable({ manifest, leagueSlug, cause });
  }
}

// One year's Campaign artifact, for a card the reader has expanded.
//
// No Movie slice goes with it. The card draws that year's ranking, which the
// Campaign artifact carries on its own, and the Board it would need the slices
// for is one click away on the card's own link.
export async function loadCampaignYear(leagueSlug, year) {
  return fetchArtifact(`leagues/${leagueSlug}/${year}.json`);
}
