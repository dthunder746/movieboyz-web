// The navigation every page carries, so that no surface is a dead end (#64).
//
// Two entries, however many Leagues the Manifest holds (#170): `Leagues` and
// `Movies`. The bar holds top-level pages only, and a League is not one of
// them, so every League lives inside the Leagues menu and every League's own
// pages one level further in. The bar is therefore the same width at one
// League and at ten, and it is the same bar on every page.
//
// Its depth is still the Manifest's answer rather than a build-time one
// (decision 20 of the parent spec, #58, as amended by #168): publishing a
// second League adds a row to the menu with no code change and no deploy.
// `buildNav` is where that decision is made and it is the half with a test
// beside it.
//
// The menu is two levels. The first is every published League by name, in
// Manifest order; the name is not a link there, because the row's job is to
// open the second level. The second is that League's own pages: Overview,
// then one row per year newest first with its Lifecycle badge, the year alone
// linking to the Campaign page (#83). With one League published the first
// level is a single row; accepted, because the shape is the same at one and at
// ten.
//
// Where the reader is told they are, in three places that do three jobs. The
// `Leagues` toggle is highlighted anywhere inside a League, which says the
// menu is worth opening rather than saying which page they are on. Inside the
// menu, one League row is marked at the first level, and one page row at the
// second: Overview on the landing page, the year on a Campaign or a draft
// page. On the Movies page and at the root nothing is highlighted but Movies.
//
// Links are absolute from the site root rather than relative, because the same
// build serves from the domain apex and from a Pages project path, and because
// the catch-all page sets a `<base>` a `../` would be counted against twice
// (`route.js`).
//
// The bar is one row of a fixed height at every width (#165). Below 992px it
// is one button opening a single overlay, and `buildCompactMenu` is the second
// reading of the same view model that says what the overlay holds: the same
// cascade, with each second level inline and indented rather than off to the
// right. Both readings are drawn into the slot together and a media query
// picks between them, so a resize is a repaint.
//
// The file splits in two at the divider below: a pure view model above, the DOM
// it becomes underneath, which is the split every page group in this site sits
// on.

import { escapeHtml } from './format.js';
import { stateLabel, stateTone } from './lifecycle.js';
import { documentRoot } from './location.js';
import {
  campaignFromPath,
  campaignHref,
  isMoviesPath,
  leagueFromPath,
  leagueHref,
  siteRoot,
} from './route.js';

export function buildNav(manifest, pathname, explicitRoot) {
  const root = siteRoot(pathname, explicitRoot);
  const here = campaignFromPath(pathname);
  // The League landing page is the other address that names a League, and the
  // two never both answer: a landing path carries no year and a Campaign path
  // is not a landing (`route.js`).
  const landing = leagueFromPath(pathname);
  const published = manifest?.leagues ?? [];

  // The League the reader is inside, by either address. A path can name a
  // League the Manifest has never heard of, which is what the catch-all page
  // renders under, and that is nobody's League.
  const insideSlug = landing?.leagueSlug ?? here?.leagueSlug ?? null;
  const inside = published.find((entry) => entry.slug === insideSlug) ?? null;

  const items = published.map((entry) => {
    const isInside = entry === inside;

    return {
      slug: entry.slug,
      name: entry.name ?? entry.slug,
      // The League's landing page, reached from the second level's Overview
      // row. The first level row carries no link of its own: it opens the
      // second level, which is the whole of what a League row does.
      href: leagueHref(root, entry.slug),
      // The reader is inside this League, by either address. It is the first
      // level's mark, and never more than one row carries it.
      inside: isInside,
      // On this League's own landing page, which is the second level's mark
      // there. A Campaign marks its year instead, so exactly one page row is
      // ever marked.
      overviewCurrent: isInside && Boolean(landing),
      // Every League's years, not only the reader's: the menu opens any League
      // without going anywhere first, so every second level has to be built.
      years: buildYears(entry, root, isInside ? here : null),
    };
  });

  // Nothing published is no menu to open, so the bar is the lookup alone.
  const leagues = items.length ? { current: Boolean(inside), items } : null;

  const movies = { href: `${root}movies/`, current: isMoviesPath(pathname) };

  return {
    brandHref: root,
    leagues,
    movies,
    // The bar itself: top-level pages only, in the order the reader narrows,
    // and never more than two however many Leagues are published (#170).
    // `current` is the highlight the bar carries: on `Leagues` it says the
    // reader is inside one of them, on `Movies` that they are on it.
    entries: [
      ...(leagues ? [{ kind: 'leagues', label: 'Leagues', current: leagues.current }] : []),
      { kind: 'movies', label: 'Movies', current: movies.current },
    ],
  };
}

// Newest first, which is the order the League thinks about its years in and the
// order the Manifest's own year menu is documented to read. `here` is the
// Campaign the reader is on, or null for every League they are not inside.
function buildYears(league, root, here) {
  return [...(league.campaigns ?? [])]
    .sort((left, right) => right.year - left.year)
    .map((campaign) => ({
      leagueSlug: league.slug,
      year: campaign.year,
      label: String(campaign.year),
      state: campaign.state,
      stateLabel: stateLabel(campaign.state),
      href: campaignHref(root, league.slug, campaign.year),
      // A path can name a year the Manifest does not list, which is exactly what
      // the catch-all page renders under. Nothing is marked for it.
      current: Boolean(here) && here.year === campaign.year,
    }));
}

// The same navigation for the widths where the bar is one button (#165). Below
// the breakpoint `Leagues` and `Movies` side by side leave no room for a
// cascade to the right, so the overlay holds the same two levels with each
// second level inline and indented under the League that owns it. It is a
// reading of `buildNav` rather than a second reading of the Manifest, so the
// two cannot drift: what the bar holds is what the overlay holds, in order.
//
// A League row is the first level's row, carrying its own second level; the
// Movies row is the bar's second entry folded in, because below the breakpoint
// there is only one button in the bar.
export function buildCompactMenu(nav) {
  return [
    ...(nav.leagues?.items ?? []).map((league) => ({ kind: 'league', ...league })),
    {
      kind: 'link',
      label: 'Movies',
      href: nav.movies.href,
      current: nav.movies.current,
      marked: nav.movies.current,
    },
  ];
}

// ── The DOM it becomes ────────────────────────────────────────────────────
//
// Untested by design, as the rest of the site's wiring is. Everything decided
// rather than rendered is above the divider.
//
// Bootstrap's dropdown has no second level and its key handling would have to
// be fought rather than extended, so the opening and closing is a small script
// of the site's own (`wireMenus`). It is deliberately not general: it knows
// there are exactly two levels.

// Both readings of the navigation go into the slot together, and a media query
// picks which one the reader sees (`site.css`): the entries side by side above
// 992px, the one button below it. Drawing both means a resize is a repaint
// rather than a re-render, and it means neither reading can be missing at the
// width that wants it (#165).
export function mountNav(manifest) {
  const host = document.getElementById('site-nav');
  if (!host) return;

  const nav = buildNav(manifest, window.location.pathname, documentRoot());

  const brand = document.getElementById('site-brand');
  if (brand) brand.setAttribute('href', nav.brandHref);

  // One write, so the placeholders below are replaced in a single frame rather
  // than the slot emptying first.
  host.innerHTML = compactReading(nav) + wideReading(nav);

  wireMenus(host);
}

// What the slot holds before the Manifest lands, written the moment the page's
// shell is, so the bar is never an empty slot that fills later (#165).
//
// Two boxes at an entry's own height, padding and radius, with a faint fill and
// no text. Two because that is what the bar holds at every League count. They
// are `aria-hidden` for the reason they have no text: there is nothing there
// yet to announce.
//
// Below the breakpoint it is the menu button instead, drawn at once and inert,
// because a button that will work in a moment reads better than one that
// appears from nowhere under the reader's thumb.
export function mountNavPlaceholder() {
  const host = document.getElementById('site-nav');
  if (!host) return;

  host.innerHTML =
    `<div class="site-nav-compact"><button class="site-nav-link site-nav-menu-toggle" type="button" disabled>Menu</button></div>`
    + `<div class="site-nav-wide" aria-hidden="true">${PLACEHOLDER_BOXES}</div>`;
}

const PLACEHOLDER_BOXES = '<span class="site-nav-link site-nav-placeholder"></span>'.repeat(2);

// The wide reading: the Leagues menu and the Movies link, side by side.
function wideReading(nav) {
  const leagues = nav.leagues
    ? menu({
        label: 'Leagues',
        current: nav.leagues.current,
        rows: nav.leagues.items.map((league) => leagueBlock(league)).join(''),
        compact: false,
      })
    : '';

  return `<div class="site-nav-wide">${leagues}${moviesLink(nav.movies, { row: false })}</div>`;
}

// The compact reading: one `Menu` button holding the same cascade, with Movies
// folded in as a row of it. It renders `buildCompactMenu` rather than reaching
// past it into `nav.leagues`, so the overlay that ships is the one the tests
// beside that function hold to the bar's own order.
function compactReading(nav) {
  const rows = buildCompactMenu(nav)
    .map((row) =>
      row.kind === 'league'
        ? leagueBlock(row)
        : `<div class="site-nav-rowsep"></div>${moviesLink(row, { row: true })}`,
    )
    .join('');

  return `<div class="site-nav-compact">${menu({
    label: 'Menu',
    current: false,
    rows,
    compact: true,
  })}</div>`;
}

// The shell both readings are: a toggle carrying the bar's highlight and the
// first level panel that drops from it. Written once so the two cannot drift,
// since the point of the bar is that they read the same.
//
// The panel carries no overflow rule on the wide reading: the second level is
// positioned outside it, and any overflow clips it into scrollbars. The compact
// reading sets its own, where the second level sits inline instead.
function menu({ label, current, rows, compact }) {
  const classes = `site-nav-menu site-nav-menu--${compact ? 'compact' : 'wide'}`;

  return `<div class="${classes}" data-nav-menu>
      <button class="site-nav-link site-nav-menu-toggle dropdown-toggle${current ? ' is-current' : ''}"
        type="button" data-nav-toggle aria-haspopup="true" aria-expanded="false">${escapeHtml(label)}</button>
      <div class="site-nav-panel site-nav-panel-1" data-nav-level="1" hidden>${rows}</div>
    </div>`;
}

// One League at the first level, with its own second level hanging off it. The
// row is a button rather than a link because the League name is not a link
// here: the row opens the second level, and Overview inside it is where the
// landing page is reached. `aria-current="true"` is the first level's mark,
// which says which League the reader is inside rather than which page they are
// on, so it is not `page`.
function leagueBlock(league) {
  const caret = '<span class="site-nav-caret" aria-hidden="true">▸</span>';

  return `<div class="site-nav-l1" data-nav-league="${escapeHtml(league.slug)}">
      <button class="site-nav-row site-nav-l1row${league.inside ? ' is-inside' : ''}" type="button"
        data-nav-row data-nav-open aria-haspopup="true" aria-expanded="false"${
          league.inside ? ' aria-current="true"' : ''
        }>${escapeHtml(league.name)}${caret}</button>
      <div class="site-nav-panel site-nav-panel-2" data-nav-level="2" hidden>
        ${overviewRow(league)}${league.years.map((year) => yearRow(year)).join('')}
      </div>
    </div>`;
}

function overviewRow(league) {
  return `<a class="site-nav-row${league.overviewCurrent ? ' is-current' : ''}" data-nav-row
      href="${escapeHtml(league.href)}"${
        league.overviewCurrent ? ' aria-current="page"' : ''
      }>Overview</a>`;
}

// The year alone links to the Campaign page (#83); the draft is reached by the
// cross link on the Campaign page rather than by a row of its own. The badge is
// pushed to the end of the row so the eye runs down a rail of years on the left
// and a rail of states on the right.
function yearRow(year) {
  const badge = year.stateLabel
    ? `<span class="badge ${stateTone(year.state)} site-nav-badge">${escapeHtml(year.stateLabel)}</span>`
    : '';

  return `<a class="site-nav-row site-nav-year${year.current ? ' is-current' : ''}" data-nav-row
      href="${escapeHtml(year.href)}"${
        year.current ? ' aria-current="page"' : ''
      }>${escapeHtml(year.label)}${badge}</a>`;
}

// The lookup, in either reading. `row` says which one: in the compact overlay
// it is a row of the menu and the arrow keys have to reach it, on the wide bar
// it is an entry beside the menu and they must not.
function moviesLink(movies, { row }) {
  const className = row ? 'site-nav-row' : 'site-nav-link';

  return `<a class="${className}${movies.current ? ' is-current' : ''}" href="${escapeHtml(movies.href)}"${
    movies.current ? ' aria-current="page"' : ''
  }${row ? ' data-nav-row' : ''}>Movies</a>`;
}

// ── Opening and closing ───────────────────────────────────────────────────
//
// Mirrors the prototype's `keys.js` (branch `prototype/168-two-level-nav`),
// which is the reference the operator judged the shape against. What it
// guarantees, in both readings:
//
//   Tab           reaches the toggle, and every row once a level is open
//   Enter/Space   opens the toggle, or a League's second level
//   ArrowDown/Up  moves between the rows of the level that has focus
//   ArrowRight    opens a League's second level and lands on its first row
//   ArrowLeft     closes back a level, landing on the League row
//   Escape        the same, and from the first level closes the menu
//
// Hover opens a second level in the wide reading only: a hover that opens
// something has no answer under a thumb, which is why the compact reading never
// does it.

let outsideWired = false;

function wireMenus(host) {
  for (const menuEl of host.querySelectorAll('[data-nav-menu]')) wireMenu(menuEl);

  // A click outside closes whatever is open. Wired once against the document,
  // because the bar is mounted per page load and the listener would otherwise
  // stack behind a re-render.
  if (outsideWired) return;
  outsideWired = true;
  document.addEventListener('click', (event) => {
    for (const menuEl of document.querySelectorAll('[data-nav-menu]')) {
      if (!menuEl.contains(event.target)) closeMenu(menuEl);
    }
  });
}

function wireMenu(menuEl) {
  const toggle = menuEl.querySelector('[data-nav-toggle]');

  toggle.addEventListener('click', () => {
    if (menuEl.classList.contains('is-open')) closeMenu(menuEl);
    else openMenu(menuEl);
  });

  // Opening a League. What a click does depends on the reading, because the two
  // readings answer to different hands.
  //
  // On the wide bar it only ever opens. A click that toggled would close the
  // level a hover had just opened, and on a touch screen at that width the
  // synthesized `mouseenter` fires before the tap, so a tap would open and
  // immediately close. Left and Escape are what close a level there.
  //
  // In the compact overlay it toggles: nothing opens on hover, the second level
  // sits inline and pushes the rest of the list down, and a reader who opened
  // the wrong League expects the same tap to put it away. Enter on the row
  // fires its click, so the keyboard toggles with the thumb; Right still opens
  // and Left and Escape still close.
  const toggles = menuEl.classList.contains('site-nav-menu--compact');

  for (const opener of menuEl.querySelectorAll('[data-nav-open]')) {
    opener.addEventListener('click', (event) => {
      event.preventDefault();
      const block = opener.closest('.site-nav-l1');
      if (toggles && block.classList.contains('is-open')) closeLevelTwo(menuEl);
      else openLevelTwo(menuEl, block);
    });
  }

  if (menuEl.classList.contains('site-nav-menu--wide')) {
    for (const block of menuEl.querySelectorAll('.site-nav-l1')) {
      block.addEventListener('mouseenter', () => {
        if (menuEl.classList.contains('is-open')) {
          openLevelTwo(menuEl, block, { focusFirst: false });
        }
      });
    }
  }

  menuEl.addEventListener('keydown', (event) => onKey(event, menuEl, toggle));

  // Tabbing out of the menu closes it, which is what a reader who has moved on
  // means. `relatedTarget` is where focus went, and null means the page.
  menuEl.addEventListener('focusout', (event) => {
    if (!menuEl.contains(event.relatedTarget)) closeMenu(menuEl);
  });
}

function onKey(event, menuEl, toggle) {
  const { key, target } = event;

  if (target === toggle) {
    if (key === 'Enter' || key === ' ' || key === 'ArrowDown') {
      event.preventDefault();
      openMenu(menuEl);
    }
    if (key === 'Escape') closeMenu(menuEl);
    return;
  }

  const panel = target.closest?.('[data-nav-level]');
  if (!panel) return;

  if (key === 'ArrowDown' || key === 'ArrowUp') {
    event.preventDefault();
    const items = walkable(menuEl, panel);
    const index = items.indexOf(target.closest('[data-nav-row]'));
    const next = (index + (key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[next]?.focus();
    return;
  }

  if (key === 'ArrowRight' && panel.dataset.navLevel === '1') {
    const block = target.closest('.site-nav-l1');
    if (!block) return;
    event.preventDefault();
    openLevelTwo(menuEl, block);
    return;
  }

  if (key === 'ArrowLeft' || key === 'Escape') {
    event.preventDefault();
    if (panel.dataset.navLevel === '2') {
      const block = target.closest('.site-nav-l1');
      closeLevelTwo(menuEl);
      rowOf(block)?.focus();
    } else {
      closeMenu(menuEl);
      toggle.focus();
    }
  }

  // A row that opens something is a button, so Enter and Space already fire its
  // click. Nothing else to do.
}

function openMenu(menuEl) {
  menuEl.classList.add('is-open');
  const panel = menuEl.querySelector('.site-nav-panel-1');
  panel.hidden = false;
  menuEl.querySelector('[data-nav-toggle]').setAttribute('aria-expanded', 'true');

  // Land on the League the reader is inside when there is one, so the keyboard
  // reading starts where the mouse reading's mark already points.
  const inside = menuEl.querySelector('.site-nav-l1row.is-inside');
  (inside ?? rows(panel)[0])?.focus();
}

function closeMenu(menuEl) {
  if (!menuEl.classList.contains('is-open')) return;
  closeLevelTwo(menuEl);
  menuEl.classList.remove('is-open');
  menuEl.querySelector('.site-nav-panel-1').hidden = true;
  menuEl.querySelector('[data-nav-toggle]').setAttribute('aria-expanded', 'false');
}

// One second level at a time, so the first level never holds two open panels
// on top of each other.
function openLevelTwo(menuEl, block, { focusFirst = true } = {}) {
  closeLevelTwo(menuEl);
  block.classList.add('is-open');
  const panel = block.querySelector('.site-nav-panel-2');
  panel.hidden = false;
  rowOf(block)?.setAttribute('aria-expanded', 'true');
  if (focusFirst) rows(panel)[0]?.focus();
}

function closeLevelTwo(menuEl) {
  for (const block of menuEl.querySelectorAll('.site-nav-l1.is-open')) {
    block.classList.remove('is-open');
    block.querySelector('.site-nav-panel-2').hidden = true;
    rowOf(block)?.setAttribute('aria-expanded', 'false');
  }
}

// What Down and Up walk, which is what the reader sees.
//
// On the wide bar the second level is a panel floating beside the first, so the
// two levels are two columns and the arrows stay inside the one that has focus.
// In the compact overlay the second level sits inline and indented under the
// League that opened it, so what the reader sees is a single column: the
// arrows run down it, through an open League's years and on to the next League,
// and a closed League's years are not there to walk.
function walkable(menuEl, panel) {
  if (!menuEl.classList.contains('site-nav-menu--compact')) return rows(panel);

  const column = menuEl.querySelector('.site-nav-panel-1');

  return [...column.querySelectorAll('[data-nav-row]')].filter((row) => !row.closest('[hidden]'));
}

// The rows of one panel, in document order, skipping the ones a nested panel
// owns: a second level panel sits inside the first level one, so its rows would
// otherwise be counted twice.
function rows(panel) {
  return [...panel.querySelectorAll('[data-nav-row]')].filter(
    (row) => row.closest('[data-nav-level]') === panel,
  );
}

function rowOf(block) {
  return block?.querySelector('[data-nav-row]');
}
