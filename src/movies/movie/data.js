// What the Movie page asks the network for. The fetch plumbing is shared
// (`../../shared/artifacts.js`); what lives here is which artifacts this page
// needs and in what order they can be asked for, the same split
// `../data.js` and `campaign/data.js` sit on either side of (#59).
//
// This page reads everything, and it is worth saying why rather than leaving it
// to be discovered. An imdb id does not say which release year's slice carries
// the Movie, and a Pick can be from any release year, so every slice and every
// Campaign has to be looked in. On today's set that is around 2.3 MB, most of
// it `movies/2026.json` at 1.45 MB and the Campaign at 784 KB. Accepted: the
// lookup page already fetches every slice, and #53 measured the load cost as
// round trips rather than bytes, so the shape that matters is the one below.
// One request for the Manifest, because nothing can be named until it answers,
// and then everything else in a single wave.

import { fetchArtifact, loadManifest } from '../../shared/artifacts.js';

// Every published Campaign, as a path apiece. Read off the Manifest's own
// League list, which is the only place that says which ones exist.
function campaignPaths(manifest) {
  return (manifest?.leagues ?? []).flatMap((league) =>
    (league.campaigns ?? []).map((campaign) => ({
      path: `leagues/${league.slug}/${campaign.year}.json`,
      leagueSlug: league.slug,
      year: campaign.year,
    })),
  );
}

export async function loadMovie() {
  const manifest = await loadManifest();
  const years = manifest.movie_years || [];
  const campaignRefs = campaignPaths(manifest);

  const settled = await Promise.allSettled([
    ...years.map((year) => fetchArtifact(`movies/${year}.json`)),
    ...campaignRefs.map((ref) => fetchArtifact(ref.path)),
  ]);

  // A slice that did not load could be the one carrying the Movie, so its year
  // is named rather than swallowed: "not found" and "not looked in" are
  // different answers and the page says so.
  const slices = [];
  const missingYears = [];
  for (const [index, year] of years.entries()) {
    const result = settled[index];
    if (result.status === 'fulfilled') {
      slices.push(result.value);
    } else {
      missingYears.push(year);
      console.warn(`Movie slice ${year} did not load`, result.reason);
    }
  }

  // A Campaign that did not load costs one link back to a contest. The Movie
  // is the page, so it renders without it.
  const campaigns = [];
  for (const [index, ref] of campaignRefs.entries()) {
    const result = settled[years.length + index];
    if (result.status === 'fulfilled') campaigns.push(result.value);
    else console.warn(`Campaign ${ref.leagueSlug} ${ref.year} did not load`, result.reason);
  }

  return { manifest, slices, campaigns, missingYears };
}
