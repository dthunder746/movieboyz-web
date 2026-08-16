// Colour palettes, carried over unchanged from the old site so a User keeps the
// colour they have had all season.

// User lines and cards. Muted, Tableau-style, because several are on screen at
// once and none of them should shout.
export const PALETTE = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#edc948', '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac',
];

// Per-Movie lines. Vivid and saturated, deliberately nothing like the User
// palette: the chart swaps between the two modes, and the change of register is
// what tells the reader which one they are looking at.
export const MOVIE_PALETTE = [
  '#ff595e', '#ff924c', '#ffca3a', '#8ac926', '#1982c4',
  '#6a4c93', '#ff70a6', '#70d6ff', '#06d6a0', '#ffd166',
  '#ef476f', '#118ab2', '#ffd60a', '#9d4edd', '#f72585',
  '#b5179e', '#7209b7', '#3a0ca3', '#4361ee', '#4cc9f0',
];

export function buildMoviePalette(count) {
  return Array.from({ length: count }, (_, i) => MOVIE_PALETTE[i % MOVIE_PALETTE.length]);
}

// Sorted, so a User's colour depends only on who is in the League and not on
// the order the roster happens to arrive in.
export function buildColorMap(userIds) {
  const map = {};
  [...userIds].sort().forEach((userId, i) => {
    map[userId] = PALETTE[i % PALETTE.length];
  });
  return map;
}
