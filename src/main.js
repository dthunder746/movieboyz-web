// Entry point for the repo root, which is a signpost rather than a page.
//
// The site renders and does not score: every figure a league rule decides is
// pre-computed in the published artifacts, and it imports no shared Python code.
// A couple of presentational figures are still worked out in the browser, and
// the README names them (platform#55). The root's whole job is to send a reader
// who asked for nothing in particular at the Campaign
// the manifest currently defaults to, so a new season moves the landing page by
// republishing rather than by a code change.
//
// The Phase 1 walking skeleton used to render here. Its fetch seam is now
// exercised by the Campaign page itself, which reads the same three artifacts
// for real.

import { loadManifest } from './shared/artifacts.js';
import { defaultViewTarget } from './shared/route.js';

// `replace` rather than an assignment, so the root does not sit in the reader's
// history as a step to go back through on the way out of the Campaign page.
//
// The target is already absolute from the site root, which is what stops a root
// served at an address that is not the root from appending the default view to
// that address over and over (`route.js`).
function go(path) {
  window.location.replace(new URL(path, window.location.origin).href);
}

function renderError(message) {
  const root = document.querySelector('#app');
  if (!root) return;
  root.innerHTML = '<h1>MovieBoyz</h1>';

  const paragraph = document.createElement('p');
  paragraph.className = 'error';
  paragraph.textContent = message;
  root.append(paragraph);
}

loadManifest()
  .then((manifest) => {
    const target = defaultViewTarget(window.location.pathname, manifest);

    if (!target) renderError('The published manifest names no default view.');
    // The hop leads back to the address it started from, so there is nothing to
    // hop to. Only a host serving this page somewhere it does not belong gets
    // here, and saying so beats going round again.
    else if (target === window.location.pathname) renderError('There is no page at this address.');
    else go(target);
  })
  .catch((error) => {
    renderError(`Could not load the published artifacts: ${error.message}`);
    console.error('Manifest load failed', error);
  });
