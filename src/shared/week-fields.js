// The week and day fields a row carries, and where they are derived.
//
// `shared/table-columns.js` and `shared/cards.js` each document the row fields
// they read (`week_<key>`, `daily_<date>`, `weeks`, `thisWeek`). This is the
// one place those fields are worked out, so the Campaign's Board rows and the
// Movies page's lookup rows cannot derive them differently (#162). Pure: no
// Tabulator, no DOM.
//
// Every function takes rows that carry `weeklyGross` and `dailyChange`, both
// keyed maps: ISO week key to what the Movie took that week, ISO date to what
// it took that day.

import { dateToIsoWeekKey } from './format.js';

function sortedUnion(rows, pick) {
  const keys = new Set();
  for (const row of rows) {
    for (const key of Object.keys(pick(row) || {})) keys.add(key);
  }
  return [...keys].sort();
}

// Every week any row reported, oldest first. The union rather than one row's
// own keys, because a column has to exist for every Movie or none.
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

// A day the source revised downward. It is not money handed back, so a page
// footnotes the column rather than colouring it as a loss.
export function hasNegativeDaily(rows) {
  return rows.some((row) => Object.values(row.dailyChange || {}).some((value) => value < 0));
}

// A day or week the Movie never reported reads null, not zero. Zero is a real
// figure (a day that took nothing) and collapsing the two would sort an
// unreported day alongside genuine flops.
export function valueOrNull(series, key) {
  const value = (series || {})[key];
  return value === undefined ? null : value;
}

// The sparkline's bars: the weeks this Movie itself reported, oldest first,
// each labelled by its ISO week number.
export function weeksFromWeekly(weeklyGross) {
  const series = weeklyGross || {};
  return Object.keys(series).sort().map((key) => ({
    num: parseInt(key.split('-W')[1], 10),
    gross: series[key] ?? 0,
  }));
}
