// Fetching the published artifacts. The only module in the site that touches
// the network; everything downstream takes plain objects.
//
// This is the plumbing a page needs whatever it is showing: where the artifacts
// live, how a request is addressed, and how a response is turned into an
// object. Which artifacts to ask for is the page's own business and lives
// beside that page, which is the line the lift drew (#59): this half knows
// nothing about a Campaign, and `campaign/data.js` knows everything about one.

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

export async function fetchArtifact(path) {
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
export function speculate(path) {
  const pending = fetchArtifact(path);
  pending.catch(() => {});
  return pending;
}

// The manifest on its own, for the repo root, which only needs to know which
// Campaign to send the reader to.
export async function loadManifest() {
  return fetchArtifact('index.json');
}
