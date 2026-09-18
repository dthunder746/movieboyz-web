// The catch-all's dispatcher: which page an unmatched address names.
//
// Pages serves exactly one `404.html` for every path it has no file for, so
// there is one catch-all for the whole site and it has to decide for itself
// what to render (ADR 0010). It used to load the Campaign page unconditionally,
// which was right while the Campaign was the only page a Campaign path could
// name; a draft address is the same path with one segment on the end, so an
// unregistered year's draft would have rendered that year's standings (#85).
//
// The decision is `pageForPath`, next door in `shared/route.js` with a test
// beside it. What is here is the import that follows from it, and it is dynamic
// so that Vite splits the three pages: a reader who lands on a Campaign address
// should not be made to download the draft page's what-if mode to see it.
//
// A League landing address is dispatched on for the same reason a Campaign year
// is. The root's directory page links to every League in the Manifest, so a
// League created in admin is advertised the moment the processor publishes it,
// and only the built directories have files of their own (#101). The Movies
// section still has real files at its own addresses, and an address naming none
// of these pages is answered by the Campaign entry's own notice.

import { pageForPath } from '../shared/route.js';

const page = pageForPath(window.location.pathname);

if (page === 'draft') {
  import('../draft/entry.js');
} else if (page === 'league') {
  import('../league/entry.js');
} else {
  import('../campaign/entry.js');
}
