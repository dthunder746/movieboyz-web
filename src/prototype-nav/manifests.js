// PROTOTYPE — throwaway. Faked Manifests for platform#83.
//
// No published artifact carries a second League, so the multi League bar has
// never been seen. These fake the Manifest shape `index.json` really publishes
// (`contract_version`, `leagues[].campaigns[].{year,state}`) with enough
// Leagues, years and Lifecycle states to judge the layout against.
//
// `default_view` is deliberately absent: #81 removes it.

const LIFECYCLE_MIX = [
  { year: 2027, state: 'drafting' },
  { year: 2026, state: 'active' },
  { year: 2025, state: 'final' },
  { year: 2024, state: 'final' },
  { year: 2023, state: 'final' },
];

export const MANIFESTS = {
  // What is published today, plus four invented years, so the flat case is
  // judged at the depth a League that has run five years reaches.
  one: {
    label: '1 League · 5 years',
    manifest: {
      contract_version: 3,
      generated_at: '2026-08-25T02:10:54.421122Z',
      leagues: [
        { slug: 'movieboyz', name: 'MovieBoyz', campaigns: LIFECYCLE_MIX },
      ],
      movie_years: [2026, 2027],
    },
  },

  // The first case nobody has seen. Two Leagues with overlapping active years,
  // and a second League short enough to show an uneven menu.
  two: {
    label: '2 Leagues',
    manifest: {
      contract_version: 3,
      generated_at: '2026-08-25T02:10:54.421122Z',
      leagues: [
        { slug: 'movieboyz', name: 'MovieBoyz', campaigns: LIFECYCLE_MIX },
        {
          slug: 'reel-rivals',
          name: 'Reel Rivals',
          campaigns: [
            { year: 2026, state: 'active' },
            { year: 2025, state: 'final' },
          ],
        },
      ],
      movie_years: [2026, 2027],
    },
  },

  // The stress case: four Leagues, one of them named far longer than any bar
  // entry, and one that has never finished a year.
  four: {
    label: '4 Leagues (stress)',
    manifest: {
      contract_version: 3,
      generated_at: '2026-08-25T02:10:54.421122Z',
      leagues: [
        { slug: 'movieboyz', name: 'MovieBoyz', campaigns: LIFECYCLE_MIX },
        {
          slug: 'reel-rivals',
          name: 'Reel Rivals',
          campaigns: [
            { year: 2026, state: 'active' },
            { year: 2025, state: 'final' },
          ],
        },
        {
          slug: 'popcorn-pretenders',
          name: 'The Popcorn Pretenders Invitational',
          campaigns: [
            { year: 2026, state: 'active' },
            { year: 2025, state: 'final' },
            { year: 2024, state: 'final' },
            { year: 2023, state: 'final' },
            { year: 2022, state: 'final' },
            { year: 2021, state: 'final' },
          ],
        },
        {
          slug: 'cinema-syndicate',
          name: 'Cinema Syndicate',
          campaigns: [{ year: 2027, state: 'drafting' }],
        },
      ],
      movie_years: [2026, 2027],
    },
  },
};

export const MANIFEST_KEYS = Object.keys(MANIFESTS);
