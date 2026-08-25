// The catch-all's dispatcher: which page an unmatched address names.
//
// Pages serves exactly one `404.html` for every path it has no file for, so
// there is one catch-all for the whole site and it has to decide for itself
// what to render (ADR 0010). It used to load the Campaign page unconditionally,
// which was right while the Campaign was the only page a Campaign path could
// name; a draft address is the same path with one segment on the end, so an
// unregistered year's draft would have rendered that year's standings (#85).
//
// The decision is `draftFromPath`, next door in `shared/route.js` with a test
// beside it. What is here is the import that follows from it, and it is dynamic
// so that Vite splits the two pages: a reader who lands on a Campaign address
// should not be made to download the draft page's what-if mode to see it.
//
// Nothing else is dispatched on. The Movies section and the League landing page
// have real files at their own addresses, and an address naming neither a
// Campaign nor a draft is answered by the Campaign entry's own notice.

import { draftFromPath } from '../shared/route.js';

if (draftFromPath(window.location.pathname)) {
  import('../draft/entry.js');
} else {
  import('../campaign/entry.js');
}
