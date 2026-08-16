// Fetching the published artifacts. The only module here that touches the
// network; everything downstream takes plain objects.
//
// ADR 0008 split the old single data.json into a manifest, a per-Campaign file
// and a per-release-year Movie slice. A page load is therefore three round
// trips at minimum: the manifest says what exists, the Campaign says which
// Movies matter, and the slices carry their measurements.

import { sliceYearsToFetch } from './board.js';

const ARTIFACT_BASE =
  import.meta.env.VITE_ARTIFACT_BASE ??
  'https://raw.githubusercontent.com/dthunder746/movieboyz-web/artifacts';

// One timestamp per page load, shared by every fetch in that load (issue #17).
// It defeats the browser's own HTTP cache: raw.githubusercontent serves
// `cache-control: max-age=300`, and without a distinct URL a reload would be
// answered locally without touching the network at all.
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

// The manifest on its own, for the repo root, which only needs to know which
// Campaign to send the reader to.
export async function loadManifest() {
  return fetchArtifact('index.json');
}

// The slices a Campaign needs, fetched together. A slice that fails is not
// fatal: the Board renders from the Campaign artifact alone and simply shows
// the measurement columns empty, which is the same state as a slice that has
// not been generated yet.
async function fetchSlices(campaign, movieYears) {
  const years = sliceYearsToFetch(campaign, movieYears);
  const settled = await Promise.allSettled(
    years.map((year) => fetchArtifact(`movies/${year}.json`)),
  );

  const slices = [];
  for (const [index, result] of settled.entries()) {
    if (result.status === 'fulfilled') slices.push(result.value);
    else console.warn(`Movie slice ${years[index]} did not load`, result.reason);
  }
  return slices;
}

// Everything one Campaign page needs. `leagueSlug` and `year` are optional; the
// manifest's own default view answers for them when the page does not care,
// which is what the repo root's redirect relies on.
export async function loadCampaign({ leagueSlug, year } = {}) {
  const manifest = await loadManifest();
  const slug = leagueSlug ?? manifest.default_view.league_slug;
  const campaignYear = year ?? manifest.default_view.year;

  const campaign = await fetchArtifact(`leagues/${slug}/${campaignYear}.json`);
  const slices = await fetchSlices(campaign, manifest.movie_years || []);

  return { manifest, campaign, slices };
}
