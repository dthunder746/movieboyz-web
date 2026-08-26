// The error a page raises when a Campaign artifact did not load.
//
// It lives in `shared` because two page groups now raise it: the Campaign page
// and the draft page, which reads the same artifact for the same Campaign and
// fails the same way when it is missing. `shared/artifacts.js` is not its home
// even though it is the module that fetches: that half deliberately knows
// nothing about a Campaign (#59), and this error's whole job is to say which
// Campaign was asked for.
//
// Naming a Campaign is not what keeps a module out of `shared`; needing a page
// group is, and this needs none. `route.js` reads a Campaign off the URL from
// here for the same reason.

// A Campaign artifact that did not load, carrying enough for the page to be
// legible about it: which Campaign was asked for, whether the Manifest lists it
// at all, and the Manifest itself so the navigation still renders (#64). The
// catch-all page renders any Campaign path, so a path for a year the platform
// has never published is an ordinary outcome rather than a fault.
export class CampaignUnavailable extends Error {
  constructor({ manifest, leagueSlug, year, cause }) {
    super(`The ${year} campaign for ${leagueSlug} could not be loaded`, { cause });
    this.name = 'CampaignUnavailable';
    this.manifest = manifest;
    this.leagueSlug = leagueSlug;
    this.year = year;
    this.published = isListed(manifest, leagueSlug, year);
  }
}

// Whether the Manifest names this Campaign. It lists every published one, so it
// is what separates a year nobody has published from an artifact that should
// have been there and was not.
function isListed(manifest, leagueSlug, year) {
  const league = (manifest?.leagues ?? []).find((entry) => entry.slug === leagueSlug);
  return (league?.campaigns ?? []).some((campaign) => campaign.year === year);
}
