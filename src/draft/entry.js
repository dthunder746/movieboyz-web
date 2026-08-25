// What the draft page's own HTML file loads: the real directory for the current
// year. The catch-all reaches the same page through `src/catchall/entry.js`,
// which dispatches on the path before importing either page.
//
// The Campaign is read off the page's own URL, which is what lets a newly
// published year work the moment its artifact lands rather than waiting on a
// code deploy.

import { loadManifest } from '../shared/artifacts.js';
import { renderNotice } from '../shared/notice.js';
import { draftFromPath } from '../shared/route.js';

import { startDraftPage } from './page.js';

const draft = draftFromPath(window.location.pathname);

if (draft) {
  startDraftPage(draft);
} else {
  // Only a host serving this file somewhere it does not belong gets here: the
  // real directory's own path always names its Campaign, and the catch-all
  // never imports this module for a path that is not a draft address. There is
  // no Campaign to fall back to, so the navigation is the whole of the answer.
  loadManifest()
    .catch(() => null)
    .then((manifest) => {
      renderNotice({
        manifest,
        heading: 'Nothing here',
        message: 'This address does not name a draft. The published years are above.',
      });
    });
}
