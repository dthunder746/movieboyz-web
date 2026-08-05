// Entry point for the MovieBoyz static site.
//
// The site is a pure renderer: every number it shows is pre-computed in the
// published artifacts, and it imports no shared Python code. Phase 1 renders the
// walking skeleton's stub payload trivially, proving the fetch seam end to end;
// the real 2026 campaign page arrives in Phase 5.
//
// The artifacts branch is on this repo, not on the private platform repo that
// generates it. Pages cannot serve from a private repo on the Free plan and raw
// would need a credential, so the site and the data it reads are published
// together here.
const ARTIFACT_BASE =
  import.meta.env.VITE_ARTIFACT_BASE ??
  'https://raw.githubusercontent.com/dthunder746/movieboyz-web/artifacts';

// One timestamp per page load, shared by every fetch in that load (issue #17).
// It defeats the *browser's* HTTP cache: raw.githubusercontent serves
// `cache-control: max-age=300`, and without a distinct URL a reload would be
// answered from local cache without touching the network at all.
//
// It does not defeat raw's edge cache, which keys on path alone and discards the
// query string entirely (measured: a never-used query string is answered from the
// existing cached object). In practice that rarely shows: at this traffic level
// the entry has usually expired, so a load goes to origin and gets the current
// file. The exception is a load within five minutes of an earlier one, which can
// be served the older copy until the entry expires. Harmless for a dataset
// published daily.
const CACHE_BUSTER = Date.now();

function artifactUrl(path) {
  return `${ARTIFACT_BASE}/${path}?t=${CACHE_BUSTER}`;
}

async function fetchArtifact(path) {
  const response = await fetch(artifactUrl(path));
  if (!response.ok) {
    throw new Error(`${path}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function renderCampaign(root, campaign) {
  const names = new Map(
    campaign.roster.map((member) => [member.user_id, member.username]),
  );

  const table = el('table');
  const head = el('tr');
  head.append(el('th', 'User'), el('th', 'Total'));
  table.append(head);
  // Rendered in the order the artifact publishes them. The ranking is part of
  // the pre-computed Standings; consumers render them and never compute them.
  for (const user of campaign.users) {
    const row = el('tr');
    row.append(
      el('td', names.get(user.user_id) ?? user.user_id),
      el('td', user.total.toLocaleString()),
    );
    table.append(row);
  }

  root.replaceChildren(
    el('h1', `${campaign.league_name} ${campaign.year}`),
    el('p', `Lifecycle state: ${campaign.state}`, 'meta'),
    // The timestamp is what the end-to-end smoke gate watches change on reload.
    el(
      'p',
      `Published ${new Date(campaign.generated_at).toLocaleString()}`,
      'meta',
    ),
    el('p', `Contract version ${campaign.contract_version}`, 'meta'),
    el('h2', 'Standings'),
    table,
  );
}

function renderError(root, error) {
  root.replaceChildren(
    el('h1', 'MovieBoyz'),
    el('p', `Could not load the published artifacts: ${error.message}`, 'error'),
  );
}

async function main() {
  const root = document.querySelector('#app');
  try {
    const manifest = await fetchArtifact('index.json');
    const { league_slug: leagueSlug, year } = manifest.default_view;
    const campaign = await fetchArtifact(`leagues/${leagueSlug}/${year}.json`);
    renderCampaign(root, campaign);
  } catch (error) {
    renderError(root, error);
    console.error('Artifact load failed', error);
  }
}

main();
