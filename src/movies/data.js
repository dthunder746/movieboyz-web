// What the Movies page asks the network for. The fetch plumbing itself is
// shared (`../shared/artifacts.js`); what lives here is which artifacts this
// page needs and in what order they can be asked for, which is the same split
// `campaign/data.js` sits on the other side of (#59).
//
// This page reads the Movie slices and no League file at all, which is what
// lets it work for a reader who is in no League (#62).
//
// Unlike a Campaign page, nothing here can be requested speculatively: the URL
// names no year, so which slices exist is the Manifest's answer to give. That
// costs one round trip up front and then one wave, rather than the eight in a
// row that reading the years one at a time would cost (#53 measured the load
// cost as round trips rather than bytes).

import { fetchArtifact, loadManifest } from '../shared/artifacts.js';

// Everything the Movies page needs. A slice that fails is not fatal: its year
// is named in `missingYears` so the page can say that year is not published
// yet, and the rest of the table renders (#62).
export async function loadMovies() {
  const manifest = await loadManifest();
  const years = manifest.movie_years || [];

  const settled = await Promise.allSettled(
    years.map((year) => fetchArtifact(`movies/${year}.json`)),
  );

  const slices = [];
  const missingYears = [];
  for (const [index, result] of settled.entries()) {
    if (result.status === 'fulfilled') {
      slices.push(result.value);
    } else {
      missingYears.push(years[index]);
      console.warn(`Movie slice ${years[index]} did not load`, result.reason);
    }
  }

  return { manifest, slices, missingYears };
}
