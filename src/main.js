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
import { defaultViewPath } from './shared/route.js';

// `replace` rather than an assignment, so the root does not sit in the reader's
// history as a step to go back through on the way out of the Campaign page.
function go(path) {
  window.location.replace(new URL(path, window.location.href).href);
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
    const path = defaultViewPath(manifest);
    if (path) go(path);
    else renderError('The published manifest names no default view.');
  })
  .catch((error) => {
    renderError(`Could not load the published artifacts: ${error.message}`);
    console.error('Manifest load failed', error);
  });
