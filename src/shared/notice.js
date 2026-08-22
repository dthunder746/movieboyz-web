// The page a reader gets when there is nothing to render: a year the platform
// has not published, or an address that names no surface at all.
//
// It exists because the catch-all page answers any path, so "there is nothing
// here" is an ordinary outcome rather than a fault, and it has to be legible
// (#64). The navigation is the point of it: a reader who landed on a year that
// does not exist needs the years that do, which is why this takes the Manifest
// rather than rendering a bare message.

import { escapeHtml } from './format.js';
import { mountNav } from './nav.js';
import { createThemeSwitch } from './theme.js';

export function renderNotice({ manifest, heading, message }) {
  const host = document.getElementById('page') ?? document.body;

  host.innerHTML = `
<nav class="navbar navbar-expand-sm mb-3 border-bottom">
  <div class="container-fluid">
    <a class="navbar-brand fw-bold" id="site-brand">🎬 MovieBoyz</a>
    <div id="site-nav" class="site-nav"></div>
    <div class="d-flex flex-wrap align-items-center gap-3 ms-auto">
      <div class="form-check form-switch mb-0">
        <input class="form-check-input" type="checkbox" id="themeSwitch">
        <label class="form-check-label" for="themeSwitch">Light</label>
      </div>
    </div>
  </div>
</nav>

<div class="container-fluid px-3">
  <div class="site-notice">
    <h1 class="site-notice-heading">${escapeHtml(heading)}</h1>
    <p class="text-muted">${escapeHtml(message)}</p>
  </div>
</div>`;

  mountNav(manifest);
  // Nothing on this page bakes in a colour, so the switch has nothing to tell.
  createThemeSwitch(() => {});
}
