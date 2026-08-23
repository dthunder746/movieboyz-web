// The League landing page's markup, held in a module for the reason the
// Campaign page's is: the file is per League and its markup is not, so a second
// published League is a three-line HTML shell rather than a second copy of this
// to keep in step. The page reads which League it is showing off its own URL,
// exactly as a Campaign page reads its year.
//
// It is markup and not a view model: nothing here reads an artifact. Every
// element it defines is filled in by `page.js` once the landing artifact lands.
//
// Two columns, per decision 26 of the parent spec (#58): the mega league down
// the left, the per-year accordion down the right.

export const LEAGUE_LAYOUT = `
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

  <h1 id="league-title" class="league-title"></h1>
  <p class="league-lede text-muted">Every campaign this crew has run, and who is ahead across all of them.</p>

  <div class="league-columns">

    <!-- The mega league. A League read across every Campaign it has run. -->
    <section class="league-panel" aria-labelledby="all-time-heading">
      <h2 id="all-time-heading" class="league-panel-heading">All time</h2>
      <p class="league-panel-note">
        Every player who has competed, ranked by all-time profit. Each year is
        added at its own scale, so this is a lifetime total rather than an average.
      </p>
      <div class="league-table-scroll">
        <table class="table table-sm league-table">
          <thead>
            <tr>
              <th scope="col" class="league-rank-col">#</th>
              <th scope="col">Player</th>
              <th scope="col" class="league-num-col">All-time profit</th>
              <th scope="col" class="league-num-col">Gross</th>
              <th scope="col" class="league-num-col">Breakeven</th>
              <th scope="col" class="league-num-col">Bombs absorbed</th>
              <th scope="col" class="league-num-col">Bombs dealt</th>
              <th scope="col" class="league-num-col">Picks</th>
              <th scope="col" class="league-num-col">Years</th>
            </tr>
          </thead>
          <tbody id="all-time-rows"></tbody>
        </table>
      </div>
      <p id="all-time-empty" class="league-empty d-none">Nobody has competed in this league yet.</p>
      <p class="league-panel-footnote">
        There is no all-time breakeven line: each year's multiplier is already
        inside that year's profit, so being in the black is the sign of the
        profit column.
      </p>
    </section>

    <!-- One card per Campaign, newest first. -->
    <section class="league-panel" aria-labelledby="campaigns-heading">
      <h2 id="campaigns-heading" class="league-panel-heading">Campaigns</h2>
      <p class="league-panel-note">
        Open a year to read its standings here. The year's own page has the board.
      </p>
      <div id="campaign-cards" class="league-cards"></div>
      <p id="campaigns-empty" class="league-empty d-none">This league has not run a campaign yet.</p>
    </section>

  </div>

</div>

<!-- ── Footer ─────────────────────────────────────────────────────────── -->
<div class="container-fluid px-3 mt-3 pb-3 border-top pt-2">
  <small class="text-muted d-block" id="data-updated"></small>
</div>
`;
