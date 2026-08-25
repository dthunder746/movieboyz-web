// What the draft page asks the network for. The fetch plumbing itself is shared
// (`../shared/artifacts.js`); what lives here is which artifacts this page
// needs, which is the split `campaign/data.js` and `league/data.js` sit on the
// other side of (#59).
//
// The page is one fetch beyond the Manifest. The Campaign artifact carries the
// whole Board (ADR 0008), and everything the draft shows comes off it: Profit,
// Breakeven, ROI and rank are all the Campaign's own figures rather than
// measurements, so unlike the Campaign page there is no Movie slice to ask for.
//
// The Manifest goes out beside it, for the navigation rather than for the page:
// the URL already names the League and the year, so nothing here waits on it.

import { loadManifest, speculate } from '../shared/artifacts.js';
import { CampaignUnavailable } from '../shared/campaign-unavailable.js';

export async function loadDraft({ leagueSlug, year } = {}) {
  // Both in flight before either is awaited. The Campaign artifact is
  // speculative only in the sense that nothing has confirmed the year exists;
  // the page's own address is what named it, and a year that was never played
  // costs one request and a legible page.
  const pendingManifest = loadManifest();
  const pendingCampaign = speculate(`leagues/${leagueSlug}/${year}.json`);

  // The Manifest is the navigation's, not the page's. It failing is survivable
  // and the Campaign failing is not, so they are awaited apart.
  const manifest = await pendingManifest.catch((error) => {
    console.warn('Manifest did not load', error);
    return null;
  });

  try {
    return { manifest, campaign: await pendingCampaign };
  } catch (cause) {
    throw new CampaignUnavailable({ manifest, leagueSlug, year, cause });
  }
}
