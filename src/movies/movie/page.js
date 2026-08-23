// The Movie page's entry point: it reads which Movie off its own query string,
// fetches everything the site publishes, and renders one film.
//
// The page has no controls beyond the chart's zoom, so there is no shared
// state to keep in step and none of the lookup page's rebuild machinery. What
// it does have is three ways of being asked for nothing: an address naming no
// Movie, a Movie no slice carries, and a Movie with no box office published
// yet. The first two hand the page to `shared/notice.js`; the third is a
// sentence where the canvas would be.

import { loadManifest } from '../../shared/artifacts.js';
import { colorClass, escapeHtml, fmt, formatShortDate } from '../../shared/format.js';
import { stateLabel, stateTone } from '../../shared/lifecycle.js';
import { currentRoot } from '../../shared/location.js';
import { mountNav } from '../../shared/nav.js';
import { renderNotice } from '../../shared/notice.js';
import { campaignHref, movieIdFromSearch } from '../../shared/route.js';
import { createThemeSwitch } from '../../shared/theme.js';

import { applyChartTheme, buildMovieChart } from './chart.js';
import { loadMovie } from './data.js';
import { blankMessage, buildMovieSeries, measurementNote } from './series.js';
import { buildMovieView } from './view.js';

const DASH = '—';

// The Pick types a League can hold a Movie under, in the words the Campaign
// page uses for them. An unrecognised type is shown as the artifact wrote it,
// for the same reason a Lifecycle state is.
const PICK_LABELS = {
  hit: 'Hit',
  seasonal: 'Seasonal',
  alt: 'Alt',
  bomb: 'Bomb',
};

function pickLabel(pickType) {
  return PICK_LABELS[pickType] ?? pickType;
}

// A date as the rest of the site writes one: "Jun 5 2026".
function longDate(isoDate) {
  if (!isoDate || isoDate === 'TBA') return null;
  return `${formatShortDate(isoDate)} ${isoDate.slice(0, 4)}`;
}

// ── The film itself ───────────────────────────────────────────────────────

function renderHeader(view) {
  const host = document.getElementById('movie-header');
  if (!host) return;

  // A slice written before the identity fields carries no title (#60), and the
  // identifier is then the only name the Movie has.
  const title = view.title ?? view.imdbId;
  const released = longDate(view.releaseDate);
  const line = [
    released ? `Released ${released}` : 'Release date not published',
    view.seasonLabel,
  ].filter(Boolean);

  document.title = `${title} · MovieBoyz`;

  host.innerHTML = `
    <h1 class="movie-title">${escapeHtml(title)}</h1>
    <p class="movie-lede text-muted">${escapeHtml(line.join(' · '))}</p>`;
}

// One figure and its name. The page is a handful of these rather than a table,
// because there is one Movie and nothing to line it up against.
function fact(label, value, title = '') {
  const attribute = title ? ` title="${escapeHtml(title)}"` : '';
  return `<div class="movie-fact"${attribute}>
      <div class="movie-fact-label">${escapeHtml(label)}</div>
      <div class="movie-fact-value">${value}</div>
    </div>`;
}

function renderFacts(view) {
  const host = document.getElementById('movie-facts');
  if (!host) return;

  // Upstream's own word on whether it read the budget or guessed it, marked
  // rather than printed plain, exactly as the lookup table marks it.
  const budget = view.budget === null
    ? DASH
    : view.estimatedBudget
      ? `<span class="budget-estimated">≈ ${escapeHtml(fmt(view.budget))}</span>`
      : escapeHtml(fmt(view.budget));

  const facts = [
    fact('Gross to date', escapeHtml(fmt(view.grossTd))),
    fact(
      'Budget',
      budget,
      view.estimatedBudget ? 'A budget upstream estimated rather than reported' : '',
    ),
    fact('Released', escapeHtml(longDate(view.releaseDate) ?? DASH)),
    fact('Season', escapeHtml(view.seasonLabel ?? DASH)),
    fact('Days running', view.daysRunning === null ? DASH : escapeHtml(view.daysRunning)),
    fact('Digital release', escapeHtml(longDate(view.releasedDigital) ?? DASH)),
  ];

  host.innerHTML = facts.join('');
}

// ── Ratings ───────────────────────────────────────────────────────────────

// Every source that has scored the Movie, each in its own units. The Campaign
// table shows Letterboxd and hides the rest; this page has room for all of
// them, which is the acceptance criterion the shared catalogue exists for.
function renderRatings(view) {
  const host = document.getElementById('movie-ratings');
  if (!host) return;

  if (view.ratings.length === 0) {
    host.innerHTML = '<h2 class="movie-section-heading">Ratings</h2>'
      + '<p class="text-muted mb-0">No source has scored this Movie yet.</p>';
    return;
  }

  const cards = view.ratings.map((rating) => {
    const icon = rating.emoji
      ? `<span class="movie-rating-icon">${rating.icon}</span>`
      : `<img class="movie-rating-icon" src="${escapeHtml(rating.icon)}" alt="" width="16" height="16">`;
    const votes = rating.votes === null
      ? ''
      : `<div class="movie-rating-votes">${rating.votes.toLocaleString()} votes</div>`;

    return `<div class="movie-rating">
        <div class="movie-rating-source">${icon}${escapeHtml(rating.label)}</div>
        <div class="movie-rating-score">${escapeHtml(rating.display)}</div>
        ${votes}
      </div>`;
  });

  const read = view.ratingsFetchedAt
    ? `<p class="movie-section-note">Read ${escapeHtml(view.ratingsFetchedAt)}.</p>`
    : '';

  host.innerHTML = '<h2 class="movie-section-heading">Ratings</h2>'
    + `<div class="movie-ratings-grid">${cards.join('')}</div>${read}`;
}

// ── The way back to the contests ──────────────────────────────────────────

// A Movie belongs to no League. This is the only part of the page that names
// one, and a Movie nobody picked simply has nothing here (#63).
function renderHoldings(view) {
  const host = document.getElementById('movie-holdings');
  if (!host) return;

  const heading = '<h2 class="movie-section-heading">Picked in</h2>';

  if (view.holdings.length === 0) {
    host.innerHTML = `${heading}<p class="text-muted mb-0">No League has picked this Movie.</p>`;
    return;
  }

  const root = currentRoot();

  const cards = view.holdings.map((holding) => {
    const href = campaignHref(root, holding.leagueSlug, holding.year);
    const name = holding.leagueName ?? holding.leagueSlug;
    const holder = holding.username ?? holding.userId;
    const pick = holding.pickType ? ` · ${escapeHtml(pickLabel(holding.pickType))}` : '';
    const draft = holding.draftPick ? ` · pick ${escapeHtml(holding.draftPick)}` : '';

    return `<a class="movie-holding" href="${escapeHtml(href)}">
        <div class="movie-holding-title">
          ${escapeHtml(name)} ${escapeHtml(holding.year)}
          <span class="badge ${stateTone(holding.state)} site-nav-badge">${escapeHtml(stateLabel(holding.state))}</span>
        </div>
        <div class="movie-holding-holder">${escapeHtml(holder)}${pick}${draft}</div>
        <div class="movie-holding-profit ${colorClass(holding.profitTd)}">${escapeHtml(fmt(holding.profitTd))}</div>
      </a>`;
  });

  host.innerHTML = `${heading}<div class="movie-holdings-grid">${cards.join('')}</div>`;
}

// ── The chart ─────────────────────────────────────────────────────────────

// The newest day any loaded slice was measured on. It stands in for a Movie
// whose own slice has never been measured, which is every film in a release
// year nothing in has opened yet.
function newestMeasuredDay(slices) {
  const days = slices.map((slice) => slice.latest_date).filter(Boolean).sort();
  return days.length ? days[days.length - 1] : null;
}

function renderChart(view, asOf) {
  const built = buildMovieSeries(view, { asOf });

  const wrapper = document.getElementById('chart-wrapper');
  const blank = document.getElementById('chart-blank');
  const message = blankMessage(built);

  let chart = null;
  if (message) {
    wrapper.classList.add('d-none');
    blank.classList.remove('d-none');
    blank.textContent = message;
  } else {
    blank.classList.add('d-none');
    wrapper.classList.remove('d-none');
    chart = buildMovieChart(built);
  }

  // Every Movie that opened before the platform started capturing has a curve
  // that begins partway up its own run. Unsaid, the plot reads as wrong.
  const note = document.getElementById('chart-note');
  if (note) {
    const text = measurementNote(built);
    note.textContent = text ?? '';
    note.classList.toggle('d-none', !text);
  }

  // Nothing to reset when there is no canvas.
  document.getElementById('reset-zoom')?.classList.toggle('d-none', chart === null);

  return chart;
}

// ── Chrome ────────────────────────────────────────────────────────────────

// A slice the Manifest publishes that did not load. It is worth saying here
// rather than only on the lookup page: the missing slice could be the one
// carrying a Pick, so the Campaign list below may be short.
function renderChrome(manifest, view, missingYears) {
  mountNav(manifest);

  const notice = document.getElementById('slice-notice');
  if (notice && missingYears.length > 0) {
    notice.textContent = `The Movies for ${missingYears.join(', ')} did not load,`
      + ' so anything they carry is missing from this page.';
    notice.classList.remove('d-none');
  }

  const updated = document.getElementById('data-updated');
  if (updated && view.measuredOn) {
    updated.textContent = `Box office measured to ${view.measuredOn}`;
  }
}

// ── Load ──────────────────────────────────────────────────────────────────

// No favicon paint. The Campaign page's tab icon is its League's leader, and a
// Movie belongs to no League.

function init({ manifest, slices, campaigns, missingYears }, imdbId) {
  const view = buildMovieView({ imdbId, slices, campaigns });

  // A Movie no slice carries. The reader may have followed a link to a film
  // the platform has stopped publishing, or typed an id that was never one.
  if (!view.found) {
    renderNotice({
      manifest,
      heading: 'No such Movie',
      message: `Nothing published carries ${imdbId}.`
        + ' It may not be tracked, or its release year may not be published yet.',
    });
    return;
  }

  renderChrome(manifest, view, missingYears);
  renderHeader(view);
  renderFacts(view);
  renderRatings(view);
  renderHoldings(view);

  const chart = renderChart(view, newestMeasuredDay(slices));

  document.getElementById('reset-zoom')?.addEventListener('click', () => {
    if (chart) chart.zoomScale('x', chart._zoomReset);
  });

  createThemeSwitch((theme) => {
    if (chart) applyChartTheme(chart, theme);
  });
}

const imdbId = movieIdFromSearch(window.location.search);

if (!imdbId) {
  // The page reached without a Movie named. It is a real address with a real
  // page behind it, so it says what is missing rather than failing to load.
  // The Manifest alone, which is all the navigation on the notice needs. There
  // is no Movie to look for, so there is nothing to read the slices for.
  loadManifest()
    .catch(() => null)
    .then((manifest) => renderNotice({
      manifest,
      heading: 'No Movie named',
      message: 'This address needs a Movie to show. Pick one from the Movies list.',
    }));
} else {
  loadMovie()
    .then((loaded) => init(loaded, imdbId))
    .catch((error) => {
      // The navigation still goes in, so a page that could not load its own
      // data is not also a dead end (#64).
      mountNav(null);
      document.body.insertAdjacentHTML(
        'beforeend',
        `<div class="alert alert-danger m-3">Failed to load the Movie: ${escapeHtml(error.message)}</div>`,
      );
    });
}
