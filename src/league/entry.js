// What the League landing HTML loads. It reads which League it is showing off
// the page's own URL, so the HTML file is a shell with no League in it and a
// second published League needs a copy of the shell rather than a copy of the
// page (`layout.js`).
//
// A path that names no League cannot reach here through the host: `404.html` is
// what answers an address with no file behind it, and that page renders the
// Campaign entry. So the one failure this page really has to answer for is a
// League whose landing artifact is not published, which `page.js` does.

import { loadManifest } from '../shared/artifacts.js';
import { renderNotice } from '../shared/notice.js';
import { leagueFromPath } from '../shared/route.js';

import { startLeaguePage } from './page.js';

const league = leagueFromPath(window.location.pathname);

if (league) {
  startLeaguePage(league);
} else {
  // Only a host serving this file somewhere it does not belong gets here. There
  // is no League to fall back to, so the navigation is the whole of the answer,
  // which is why the Manifest is still read (#64).
  loadManifest()
    .catch(() => null)
    .then((manifest) => {
      renderNotice({
        manifest,
        heading: 'Nothing here',
        message: 'This address does not name a league. The published years are above.',
      });
    });
}
