// Row builders and comparators for the three table view modes. Pure: each
// takes Board rows and returns plain data, with no Tabulator and no DOM.
//
// The old site built these inside the render functions, which is why the
// sorting rules and the meter geometry were never testable. The column
// definitions and the formatters stay in the DOM layer; what lives here is the
// reshaping the columns read from and the arithmetic behind the card visuals.

import { dateToIsoWeekKey } from './format.js';

// Rating sources the detailed table has a column for, flattened onto each row
// so Tabulator can sort them. The raw ratings object rides along beside them
// for the vote-count tooltips.
export const RATING_KEYS = [
  'letterboxd', 'imdb', 'rt_audience', 'rt_critic', 'tmdb', 'metacritic',
];

function sortedUnion(rows, pick) {
  const keys = new Set();
  for (const row of rows) {
    for (const key of Object.keys(pick(row) || {})) keys.add(key);
  }
  return [...keys].sort();
}

export function collectWeekKeys(rows) {
  return sortedUnion(rows, (row) => row.weeklyGross);
}

export function collectDailyDates(rows) {
  return sortedUnion(rows, (row) => row.dailyChange);
}

export function groupDatesByWeek(dates) {
  const byWeek = {};
  for (const date of dates) {
    const key = dateToIsoWeekKey(date);
    (byWeek[key] ||= []).push(date);
  }
  return byWeek;
}

// A day the source revised downward. It is not money handed back, so the page
// footnotes the column rather than colouring it as a loss.
export function hasNegativeDaily(rows) {
  return rows.some((row) => Object.values(row.dailyChange).some((value) => value < 0));
}

// A day or week the Movie never reported reads null, not zero. Zero is a real
// figure (a day that took nothing) and collapsing the two would sort an
// unreported day alongside genuine flops.
function valueOrNull(series, key) {
  const value = series[key];
  return value === undefined ? null : value;
}

// Fields every mode shows. `releaseDate` falls back to the literal 'TBA' the
// old table sorted on: the column is a string sort, so an undated Movie has to
// carry something sortable rather than a null.
function commonFields(row) {
  return {
    imdbId: row.imdbId,
    title: row.title,
    userId: row.userId,
    username: row.username,
    pickType: row.pickType,
    season: row.season,
    releaseDate: row.releaseDate || 'TBA',
    breakeven: row.breakeven,
    profitTd: row.profitTd,
    roi: row.roi,
  };
}

function withWeeks(flat, row, weekKeys) {
  for (const key of weekKeys) flat[`week_${key}`] = valueOrNull(row.weeklyGross, key);
  return flat;
}

export function detailedRows(board) {
  const rows = board.rows || [];
  const weekKeys = collectWeekKeys(rows);
  const dates = collectDailyDates(rows);

  return rows.map((row) => {
    const flat = {
      ...commonFields(row),
      budget: row.budget,
      daysRunning: row.daysRunning,
      grossTd: row.grossTd,
      ratings: row.ratings,
    };

    for (const key of RATING_KEYS) {
      flat[`rating_${key}`] = row.ratings?.[key]?.score ?? null;
    }
    for (const date of dates) {
      flat[`daily_${date}`] = valueOrNull(row.dailyChange, date);
    }

    return withWeeks(flat, row, weekKeys);
  });
}

export function compactRows(board) {
  const rows = board.rows || [];
  const weekKeys = collectWeekKeys(rows);
  return rows.map((row) => withWeeks(commonFields(row), row, weekKeys));
}

export function cardRows(board) {
  const rows = board.rows || [];
  // Newest first, so the three named weeks are the same three for every card
  // whatever point each Movie is at in its own run.
  const newestFirst = collectWeekKeys(rows).slice().reverse();
  const [thisKey, lastKey, beforeKey] = newestFirst;

  const built = rows.map((row) => ({
    ...commonFields(row),
    grossTd: row.grossTd,
    thisWeek: thisKey ? valueOrNull(row.weeklyGross, thisKey) : null,
    lastWeek: lastKey ? valueOrNull(row.weeklyGross, lastKey) : null,
    weekBefore: beforeKey ? valueOrNull(row.weeklyGross, beforeKey) : null,
    weeklyGross: row.weeklyGross,
    weeks: Object.keys(row.weeklyGross).sort().map((key) => ({
      num: parseInt(key.split('-W')[1], 10),
      gross: row.weeklyGross[key] ?? 0,
    })),
    ratingLetterboxd: row.ratings?.letterboxd?.score ?? null,
    rank: null,
    rankTotal: 0,
  }));

  // Rank runs over the whole Board rather than the filtered view, so a card's
  // "#3 of 40" means the same thing however the toolbar is set. A Movie with no
  // published profit gets no rank: last place would read as a result it has not
  // produced.
  const ranked = built
    .filter((row) => row.profitTd !== null)
    .sort((a, b) => b.profitTd - a.profitTd);
  ranked.forEach((row, index) => {
    row.rank = index + 1;
  });
  for (const row of built) row.rankTotal = ranked.length;

  return built;
}

// The default order the two tables use, reproduced for the cards so switching
// view does not reshuffle the page. Tabulator takes the LAST entry of a
// multi-column sort as the primary key, so the old
// [release_date asc, week_W01 desc, ... week_Wlatest desc] means: newest week's
// gross first, then each earlier week, with release date as the weakest
// tiebreak. Missing weeks sort to the bottom, as Tabulator puts empty last.
function compareByDefault(weekKeys) {
  return (a, b) => {
    for (let i = weekKeys.length - 1; i >= 0; i -= 1) {
      const key = weekKeys[i];
      const av = valueOrNull(a.weeklyGross || {}, key);
      const bv = valueOrNull(b.weeklyGross || {}, key);
      if (av === null && bv === null) continue;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (av !== bv) return bv - av;
    }
    if (a.releaseDate !== b.releaseDate) return a.releaseDate < b.releaseDate ? -1 : 1;
    return 0;
  };
}

export function compareCards(field, dir, weekKeys) {
  if (!field || field === 'default') return compareByDefault(weekKeys || []);

  const multiplier = dir === 'asc' ? 1 : -1;
  return (a, b) => {
    // A missing figure sorts last in both directions. Ascending, it would
    // otherwise lead the view with the Movies nobody has measured yet.
    const av = a[field];
    const bv = b[field];
    if (av === null || av === undefined) return 1;
    if (bv === null || bv === undefined) return -1;
    if (field === 'releaseDate') {
      if (av === bv) return 0;
      return (av < bv ? -1 : 1) * multiplier;
    }
    return (av - bv) * multiplier;
  };
}

// The diverging ROI meter on a card. Break-even sits at the centre tick; a loss
// fills left and is bounded at -100%, since a Pick cannot lose more than it
// staked. Profit fills right and stops at the +100% mark, which is the cap.
//
// Past +100% the bar does not keep filling. A separate breakout lane runs from
// the cap to the end, and its length is logarithmic: a linear scale against the
// +12500% end would leave every realistic ROI as an invisible sliver.
const ROI_CENTER = 50; // break-even, as a percentage of the bar's width
const ROI_CAP = 85; // where the +100% mark sits
const ROI_BREAK = 100; // the ROI at the cap
const ROI_MAX = 12500; // the ROI whose lane reaches the bar's end

export function roiMeter(roi) {
  if (roi === null || roi === undefined) return null;

  const positive = roi >= 0;
  const fillPct = positive
    ? (Math.min(roi, ROI_BREAK) / ROI_BREAK) * (ROI_CAP - ROI_CENTER)
    : (Math.min(Math.abs(roi), 100) / 100) * ROI_CENTER;

  let breakoutPct = null;
  if (roi > ROI_BREAK) {
    const fraction = Math.min(
      1,
      (Math.log(roi) - Math.log(ROI_BREAK)) / (Math.log(ROI_MAX) - Math.log(ROI_BREAK)),
    );
    breakoutPct = fraction * (100 - ROI_CAP);
  }

  return { positive, fillPct, breakoutPct };
}

// Which sparkline bars get an axis label. The first and the latest always do,
// with a few evenly spaced between, scaled to the run so a long season does not
// end up with the labels overprinting each other.
export function weekAxisIndexes(n) {
  if (n <= 0) return [];
  let count;
  if (n <= 4) count = n;
  else if (n <= 8) count = 4;
  else if (n <= 12) count = 5;
  else count = 6;

  // Every branch above leaves count no greater than n, so the step between
  // labels is never less than one bar and no two labels can land together.
  const indexes = [];
  for (let j = 0; j < count; j += 1) {
    indexes.push(Math.round((j * (n - 1)) / (count - 1 || 1)));
  }
  return indexes;
}

// Week-on-week change for the card's expanded table. The divisor is the size of
// the previous week rather than its signed value: a revised-down week reads
// negative, and dividing by it would flip the sign and show a recovery as a
// collapse.
export function weekDeltas(weeks) {
  return weeks.map((week, i) => {
    const previous = i > 0 ? weeks[i - 1].gross : null;
    const deltaPct = (previous === null || previous === 0)
      ? null
      : Math.round(((week.gross - previous) / Math.abs(previous)) * 100);
    return { ...week, deltaPct };
  });
}
