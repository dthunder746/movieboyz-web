// The review sources a Movie carries, and how each one is read.
//
// Every source is stored on the same 0-100 scale, and no source's own audience
// reads it that way: Letterboxd is out of five, IMDb and TMDB out of ten, the
// two Rotten Tomatoes figures and Trakt are percentages, and Metacritic is the
// only one whose published number is the stored one. `display` is that
// conversion, in one place, because the Campaign table and the Movie page both
// show the same scores and a second copy would drift.
//
// Shared by dependency rather than by vocabulary: this needs nothing from
// either page group. Which sources a surface shows, and in what order, stays
// with that surface. The Campaign table shows Letterboxd and hides the rest
// behind an expander; the Movie page shows everything that has answered.

const FAVICON_BASE = 'https://www.google.com/s2/favicons?domain=';

export const RATING_SOURCES = [
  {
    key: 'letterboxd',
    label: 'Letterboxd',
    icon: `${FAVICON_BASE}letterboxd.com&sz=32`,
    emoji: false,
    display: (value) => (value / 20).toFixed(1),
  },
  {
    key: 'imdb',
    label: 'IMDb',
    icon: `${FAVICON_BASE}imdb.com&sz=32`,
    emoji: false,
    display: (value) => (value / 10).toFixed(1),
  },
  {
    key: 'rt_audience',
    label: 'RT Audience Score',
    icon: '🍿',
    emoji: true,
    display: (value) => `${value}%`,
  },
  {
    key: 'rt_critic',
    label: 'RT Tomatometer',
    icon: `${FAVICON_BASE}rottentomatoes.com&sz=32`,
    emoji: false,
    display: (value) => `${value}%`,
  },
  {
    key: 'tmdb',
    label: 'TMDB',
    icon: `${FAVICON_BASE}themoviedb.org&sz=32`,
    emoji: false,
    display: (value) => (value / 10).toFixed(1),
  },
  {
    key: 'metacritic',
    label: 'Metacritic',
    icon: `${FAVICON_BASE}metacritic.com&sz=32`,
    emoji: false,
    display: (value) => String(value),
  },
  {
    key: 'trakt',
    label: 'Trakt',
    icon: `${FAVICON_BASE}trakt.tv&sz=32`,
    emoji: false,
    display: (value) => `${value}%`,
  },
];

// One Movie's ratings as a list ready to render: every source that has scored
// it, in the catalogue's order, each carrying the figure in its own units.
//
// A source with no score is left out rather than shown empty. Upstream answers
// for all seven whether or not it has read them, so a Movie nobody has reviewed
// yet publishes a full set of nulls, and listing those says nothing at all.
export function displayRatings(ratings) {
  const rows = [];

  for (const source of RATING_SOURCES) {
    const score = ratings?.[source.key]?.score;
    if (score === null || score === undefined) continue;

    rows.push({
      key: source.key,
      label: source.label,
      icon: source.icon,
      emoji: source.emoji,
      score,
      display: source.display(score),
      votes: ratings[source.key].votes ?? null,
    });
  }

  return rows;
}
