// The draft page's markup, held in a module for the reason the Campaign page's
// is: two HTML files need it, the real directory for the current year and the
// catch-all the host serves for a path it has no file for (#64). A copy in each
// would drift, and every surface here is addressed by id, so where the ids come
// from is nobody's business but this module's.
//
// It is markup and not a view model: nothing here reads an artifact. The body
// below `#draft-app` is written by `page.js` once the Campaign lands, which is
// how the old page worked and is left as it stands (#85).
//
// The head of the page carries a link back to the Campaign's own page, the
// other half of the cross link the Campaign page carries to this one. The
// navigation marks the year on both pages (#83), so it is the marked entry that
// leads back, and a marked entry is a poor thing to ask a reader to click.

export const DRAFT_LAYOUT = `
<!-- ── Header ─────────────────────────────────────────────────────────── -->
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

<!-- ── Main ───────────────────────────────────────────────────────────── -->
<div class="container-fluid px-3">

  <!-- The way back to this Campaign's own page. It ships hidden and with no
       href, and the page module reveals it once it has an address: an empty
       href resolves to the current page, so a Board missing its League or year
       would leave a link that silently reloads, as would a click landing
       before the Campaign does. The Campaign page's link back here sits the
       same way. -->
  <div class="d-flex flex-wrap align-items-baseline gap-3 mb-3">
    <h1 class="h4 mb-0" id="draft-title"></h1>
    <a class="text-decoration-none" id="draft-standings-link" hidden>Standings and board &rarr;</a>
  </div>

  <!-- Everything below is written by the page module: the season tabs, the
       what-if pill and banner, the leaderboard, the picks table, the
       highlights strip and the unpicked sidebar. What-if mode reads this
       element by id and toggles its own classes on it, so it is the page's
       root and not a wrapper. -->
  <div id="draft-app"></div>

</div>

<!-- ── Footer ─────────────────────────────────────────────────────────── -->
<div class="container-fluid px-3 mt-3 pb-3 border-top pt-2">
  <small class="text-muted d-block" id="data-updated"></small>
</div>
`;
