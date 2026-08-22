// What both Campaign HTML files load: the real directory for the current year,
// and the catch-all the host serves for a path it has no file for (#64).
//
// The two differ only in how they are reached, so they share an entry. The
// Campaign is read off the page's own URL either way, which is what lets a
// newly published year work the moment its artifact lands rather than waiting
// on a code deploy.

import { loadManifest } from '../shared/artifacts.js';
import { renderNotice } from '../shared/notice.js';
import { campaignFromPath } from '../shared/route.js';

import { startCampaignPage } from './page.js';

const campaign = campaignFromPath(window.location.pathname);

if (campaign) {
  startCampaignPage(campaign);
} else {
  // Only the catch-all reaches this: the real directory's own path always names
  // its Campaign. It is any other unmatched address, so there is no Campaign to
  // fall back to and the navigation is the whole of the answer.
  loadManifest()
    .catch(() => null)
    .then((manifest) => {
      renderNotice({
        manifest,
        heading: 'Nothing here',
        message: 'This address does not name a campaign. The published years are above.',
      });
    });
}
