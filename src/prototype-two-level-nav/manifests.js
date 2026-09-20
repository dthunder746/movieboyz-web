// PROTOTYPE — throwaway. Faked Manifests for platform#168.
//
// Only one League is published today, so a bar holding a Leagues menu with a
// submenu per League has never been seen against real depth. These fake the
// Manifest shape `index.json` publishes, with enough Leagues, years and
// Lifecycle states to judge a two level cascade against.

const FIVE = [
  { year: 2027, state: 'drafting' },
  { year: 2026, state: 'active' },
  { year: 2025, state: 'final' },
  { year: 2024, state: 'final' },
  { year: 2023, state: 'final' },
];

const THREE = [
  { year: 2026, state: 'active' },
  { year: 2025, state: 'final' },
  { year: 2024, state: 'final' },
];

const ONE_YEAR = [{ year: 2026, state: 'active' }];

function league(slug, name, campaigns) {
  return { slug, name, campaigns };
}

// Ten Leagues, with the name lengths and year counts spread, so the first level
// is judged at the height it actually reaches rather than at three rows.
const TEN = [
  league('movieboyz', 'MovieBoyz', FIVE),
  league('popcorn-crew', 'Popcorn Crew', THREE),
  league('reel-rivals', 'Reel Rivals', ONE_YEAR),
  league('cinema-syndicate', 'Cinema Syndicate', THREE),
  league('the-popcorn-pretenders', 'The Popcorn Pretenders Invitational', FIVE),
  league('box-office-bandits', 'Box Office Bandits', [{ year: 2027, state: 'drafting' }]),
  league('final-cut', 'Final Cut', FIVE),
  league('second-screen', 'Second Screen', ONE_YEAR),
  league('gross-domestic', 'Gross Domestic', THREE),
  league('the-back-row', 'The Back Row', [
    { year: 2026, state: 'active' },
    { year: 2025, state: 'final' },
  ]),
];

function manifest(leagues) {
  return {
    contract_version: 3,
    generated_at: '2026-09-20T02:10:54.421122Z',
    leagues,
    movie_years: [2026, 2027],
  };
}

export const MANIFESTS = {
  // The case the ticket describes: three Leagues, 1/3/5 years, every Lifecycle
  // state present somewhere.
  three: {
    label: '3 Leagues · 5/3/1 years',
    manifest: manifest([
      league('movieboyz', 'MovieBoyz', FIVE),
      league('popcorn-crew', 'Popcorn Crew', THREE),
      league('reel-rivals', 'Reel Rivals', ONE_YEAR),
    ]),
  },

  // What is published today. A Leagues menu whose first level holds one row is
  // a level that earns nothing, and that has to be visible.
  one: {
    label: '1 League · 5 years',
    manifest: manifest([league('movieboyz', 'MovieBoyz', FIVE)]),
  },

  ten: {
    label: '10 Leagues (stress)',
    manifest: manifest(TEN),
  },
};

export const MANIFEST_KEYS = Object.keys(MANIFESTS);
