// The League landing page's entry point: it fetches the landing artifact once,
// renders the mega league and the per-year cards out of it, and lazily fetches a
// year's Campaign artifact when a card is expanded.
//
// Everything decided rather than rendered lives next door and has a test beside
// it: the mega-league rows in `all-time.js`, the cards and their leader and
// empty states in `cards.js`, an expanded year's ranking in `standings.js`, and
// whether an expand goes to the network in `accordion.js`. What is left here is
// wiring and markup, which is untested by design as the rest of the site's is.
//
// The page computes no figure the artifact carries. Everything in the mega
// league is summed in the projection and published (spec #58, decision 16), and
// the order is published with it.

import { escapeHtml, fmt, fmtPct, colorClass, fmtTimestamp } from '../shared/format.js';
import { stateTone } from '../shared/lifecycle.js';
import { mountNav } from '../shared/nav.js';
import { buildColorMap } from '../shared/palettes.js';
import { renderNotice } from '../shared/notice.js';
import { currentRoot } from '../shared/location.js';
import { createThemeSwitch } from '../shared/theme.js';

import { expansionAction } from './accordion.js';
import { buildAllTimeRows } from './all-time.js';
import { buildCampaignCards } from './cards.js';
import { LeagueUnavailable, loadCampaignYear, loadLeague } from './data.js';
import { LEAGUE_LAYOUT } from './layout.js';
import { buildYearStandings } from './standings.js';

// ── The mega league ───────────────────────────────────────────────────────

// No User colours in this table, deliberately. A colour is handed out by
// position within one Campaign's sorted Roster, so there is no such thing as an
// all-time one: the same person would be one colour here and another inside an
// expanded card. The rank and the name carry the row instead.
function moneyCell(value, { coloured = false } = {}) {
  const tone = coloured ? colorClass(value) : '';
  return `<td class="league-num ${tone}">${escapeHtml(fmt(value))}</td>`;
}

function countCell(value) {
  return `<td class="league-num">${value === null ? '—' : escapeHtml(String(value))}</td>`;
}

function allTimeRow(row) {
  return '<tr>'
    + `<th scope="row" class="league-rank">${row.rank}</th>`
    + `<td class="league-user">${escapeHtml(row.username)}</td>`
    // Profit is the only coloured figure here, and it is coloured the way the
    // Campaign page colours Profit, so being in the red reads the same
    // everywhere. The two bomb columns are money moved rather than money won,
    // and their sign says which way it went rather than how a year is going.
    + moneyCell(row.profit, { coloured: true })
    + moneyCell(row.gross)
    + moneyCell(row.breakeven)
    + moneyCell(row.bombAbsorbed)
    + moneyCell(row.bombDealt)
    + countCell(row.moviesPicked)
    + countCell(row.yearsCompeted)
    + '</tr>';
}

function renderAllTime(landing) {
  const rows = buildAllTimeRows(landing);
  const body = document.getElementById('all-time-rows');
  const empty = document.getElementById('all-time-empty');

  if (body) body.innerHTML = rows.map(allTimeRow).join('');
  if (empty) empty.classList.toggle('d-none', rows.length > 0);
  document.querySelector('.league-table-scroll')?.classList.toggle('d-none', rows.length === 0);
}

// ── The per-year cards ────────────────────────────────────────────────────

function leaderLine(card) {
  if (card.empty) return `<span class="league-card-empty">${escapeHtml(card.empty)}</span>`;

  const names = card.leaders.map((leader) => escapeHtml(leader.username)).join(' & ');
  return `<span class="league-card-leader-label">${escapeHtml(card.leaderLabel)}</span>`
    + `<span class="league-card-leader-name">${names}</span>`;
}

function cardHead(card) {
  const summary = `<span class="league-card-year">${escapeHtml(String(card.year))}</span>`
    + `<span class="badge ${stateTone(card.state)} league-card-state">${escapeHtml(card.stateLabel)}</span>`
    + `<span class="league-card-leader">${leaderLine(card)}</span>`;

  // A drafting year has nothing to expand into, so its header is not a control.
  // Anything else is a button, because expanding is what it does.
  if (!card.expandable) return `<div class="league-card-header is-static">${summary}</div>`;

  return `<button class="league-card-header" type="button" aria-expanded="false"`
    + ` aria-controls="year-${escapeHtml(String(card.year))}-body">`
    + '<span class="league-card-toggle" aria-hidden="true"></span>'
    + summary
    + '</button>';
}

function campaignCard(card, root) {
  const href = `${root}${card.path}`;

  return `<article class="league-card" data-year="${escapeHtml(String(card.year))}">`
    + cardHead(card)
    + `<div class="league-card-body" id="year-${escapeHtml(String(card.year))}-body" hidden></div>`
    // Always visible, and outside the header: the way into the full Campaign
    // page is what keeps this page a hub rather than a replacement, and a link
    // nested inside a button is neither.
    + '<div class="league-card-foot">'
    + `<a class="league-card-link" href="${escapeHtml(href)}">Open ${escapeHtml(String(card.year))} →</a>`
    + '</div>'
    + '</article>';
}

// ── An expanded year ──────────────────────────────────────────────────────

function standingsRow(row, colorMap) {
  const color = colorMap[row.userId] || '#888';

  return '<tr>'
    + `<th scope="row" class="league-rank">${row.rank}</th>`
    + '<td class="league-user">'
    + `<span class="owner-dot" style="background:${escapeHtml(color)}"></span>`
    + escapeHtml(row.username)
    + '</td>'
    + `<td class="league-num">${escapeHtml(fmt(row.slateProfit))}</td>`
    + `<td class="league-num">${escapeHtml(fmt(row.bombImpact))}</td>`
    + `<td class="league-num">${row.roi === null ? '—' : escapeHtml(fmtPct(row.roi))}</td>`
    + `<td class="league-num ${colorClass(row.total)}">${escapeHtml(fmt(row.total))}</td>`
    + '</tr>';
}

function standingsTable(campaign) {
  const { latestDate, rows } = buildYearStandings(campaign);
  if (rows.length === 0) return '<p class="league-card-empty">Nobody was rostered in this year.</p>';

  // The colours a Campaign's own page uses, so an expanded card and the year it
  // links to agree about who is who. They are per Campaign by construction,
  // which is why the mega league above has none.
  const colorMap = buildColorMap(rows.map((row) => row.userId));

  return '<table class="table table-sm league-standings">'
    + '<thead><tr>'
    + '<th scope="col" class="league-rank-col">#</th>'
    + '<th scope="col">Player</th>'
    + '<th scope="col" class="league-num-col">Picks</th>'
    + '<th scope="col" class="league-num-col">Bombs</th>'
    + '<th scope="col" class="league-num-col">ROI</th>'
    + '<th scope="col" class="league-num-col">Total</th>'
    + '</tr></thead>'
    + `<tbody>${rows.map((row) => standingsRow(row, colorMap)).join('')}</tbody>`
    + '</table>'
    + (latestDate
      ? `<p class="league-card-measured">Scored to ${escapeHtml(latestDate)}.</p>`
      : '');
}

// ── Wiring ────────────────────────────────────────────────────────────────

function init({ manifest, landing }) {
  mountNav(manifest);
  createThemeSwitch(() => {});

  const title = document.getElementById('league-title');
  if (title) title.textContent = landing.league_name ?? landing.league_slug ?? 'League';
  document.title = `${landing.league_name ?? 'League'} · MovieBoyz`;

  renderAllTime(landing);

  const cards = buildCampaignCards(landing);
  const host = document.getElementById('campaign-cards');
  const root = currentRoot();
  if (host) host.innerHTML = cards.map((card) => campaignCard(card, root)).join('');
  document.getElementById('campaigns-empty')?.classList.toggle('d-none', cards.length > 0);

  wireAccordion(host, landing.league_slug);

  const updated = document.getElementById('data-updated');
  if (updated && landing.generated_at) {
    updated.textContent = `Published ${fmtTimestamp(new Date(landing.generated_at))}`;
  }
}

// One fetch per year, kept for the life of the page, so a reader comparing two
// years by toggling between them pays for each of them once. `expansionAction`
// is what reads this and decides; this half only carries the decision out.
function wireAccordion(host, leagueSlug) {
  if (!host) return;
  const cache = new Map();

  host.addEventListener('click', (event) => {
    const header = event.target.closest('.league-card-header');
    if (!header || header.classList.contains('is-static')) return;

    const card = header.closest('.league-card');
    const body = card.querySelector('.league-card-body');
    const year = Number(card.dataset.year);
    const open = header.getAttribute('aria-expanded') !== 'true';

    header.setAttribute('aria-expanded', String(open));
    card.classList.toggle('is-open', open);
    body.hidden = !open;

    const action = expansionAction({ open, entry: cache.get(year) });
    if (action === 'collapse' || action === 'wait') return;
    if (action === 'render') {
      body.innerHTML = standingsTable(cache.get(year).campaign);
      return;
    }

    body.innerHTML = `<p class="league-card-loading">Loading ${year}…</p>`;
    cache.set(year, { status: 'loading' });

    loadCampaignYear(leagueSlug, year)
      .then((campaign) => {
        cache.set(year, { status: 'ready', campaign });
        // Only paint if the card is still open. A reader who collapsed it while
        // the request was out has said they are done with it, and the answer is
        // cached either way.
        if (header.getAttribute('aria-expanded') === 'true') {
          body.innerHTML = standingsTable(campaign);
        }
      })
      .catch((error) => {
        console.warn(`Campaign ${leagueSlug} ${year} did not load`, error);
        cache.set(year, { status: 'failed' });
        if (header.getAttribute('aria-expanded') === 'true') {
          body.innerHTML =
            `<p class="league-card-empty">The ${year} standings could not be loaded. `
            + 'Open the year for its own page.</p>';
        }
      });
  });
}

// ── Load ──────────────────────────────────────────────────────────────────

// No favicon paint. The tab icon is a Campaign's leader, and this page is a
// League rather than one of its years.

export function startLeaguePage({ leagueSlug }) {
  const page = document.getElementById('page');
  if (page) page.innerHTML = LEAGUE_LAYOUT;

  loadLeague({ leagueSlug })
    .then(init)
    .catch((error) => {
      // An unpublished landing artifact is an ordinary outcome rather than a
      // fault, and the page has to stay legible and navigable about it (#64).
      const unavailable = error instanceof LeagueUnavailable;
      if (!unavailable) console.error('League landing page failed', error);

      renderNotice({
        manifest: unavailable ? error.manifest : null,
        heading: unavailable && !error.published ? 'No such league' : 'Not published yet',
        message: unavailable && !error.published
          ? `Nothing is published for “${leagueSlug}”. The published years are above.`
          : 'This league’s landing page has not been published yet. Its years are above.',
      });
    });
}
