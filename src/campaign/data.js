// Fetching the published artifacts. The only module here that touches the
// network; everything downstream takes plain objects.
//
// ADR 0008 split the old single data.json into a manifest, a per-Campaign file
// and a per-release-year Movie slice. Read one after the other that is three
// round trips before anything can paint, and measurement (#53) put the cost
// squarely in the round trips rather than the bytes: on the 2026 set every
// artifact answers in about the same 0.175s whether it is 242 bytes or 76 KB.
//
// So a Campaign page asks for all three at once. Its own URL already names the
// league and the year, which is everything the Campaign path and its Movie
// slice path need, and the manifest is only consulted afterwards to confirm
// which slices exist. The slice request is therefore speculative: it can turn
// out to be one the manifest does not publish, which costs a request and
// nothing else, since a Board with no slice already renders with the
// measurement columns empty.

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

// A request put in flight before anything has established that it is wanted.
// The `catch` is not error handling: it marks the rejection handled at the
// moment it is made, so a speculative request nobody ends up awaiting cannot
// surface as an unhandled rejection. Whoever does await it still sees it throw.
function speculate(path) {
  const pending = fetchArtifact(path);
  pending.catch(() => {});
  return pending;
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
//
// `inFlight` carries any slice already requested speculatively, keyed by year.
// The manifest still decides what is asked for: a speculative slice for a year
// the manifest does not publish is dropped rather than rendered, so what the
// Board joins against does not depend on how the request was ordered.
async function fetchSlices(campaign, movieYears, inFlight = new Map()) {
  const years = sliceYearsToFetch(campaign, movieYears);
  const settled = await Promise.allSettled(
    years.map(
      (year) => inFlight.get(year) ?? fetchArtifact(`movies/${year}.json`),
    ),
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
// which is what the repo root's redirect relies on. That caller is the one that
// cannot overlap its requests: it does not yet know which Campaign it wants, so
// a guessed path would be a wrong request rather than a speculative one.
export async function loadCampaign({ leagueSlug, year } = {}) {
  const named = Boolean(leagueSlug && year);
  // All three in flight before the first one is awaited. The manifest leads
  // only because it is the one request every caller makes.
  const pendingManifest = loadManifest();
  const pendingCampaign = named
    ? speculate(`leagues/${leagueSlug}/${year}.json`)
    : null;
  const pendingSlices = named
    ? new Map([[year, speculate(`movies/${year}.json`)]])
    : new Map();

  const manifest = await pendingManifest;
  const slug = leagueSlug ?? manifest.default_view.league_slug;
  const campaignYear = year ?? manifest.default_view.year;

  const campaign =
    (await pendingCampaign) ??
    (await fetchArtifact(`leagues/${slug}/${campaignYear}.json`));
  const slices = await fetchSlices(
    campaign,
    manifest.movie_years || [],
    pendingSlices,
  );

  return { manifest, campaign, slices };
}
