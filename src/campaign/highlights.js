// The view models behind the six info-card tabs. Pure: every tab is a filter,
// a sort and at most a ratio over Board rows, and none of it touches the DOM.
//
// Ported from the old site's `js/info-cards.js`, which mixed these queries in
// with the markup that renders them. Splitting them out is what makes the
// comparison rules testable, and they are the part worth testing: the tabs are
// mostly about which Movies to leave out.

import { dateToIsoWeekKey, getWeekdayAbbr, isoWeekBounds, weekTitle } from './format.js';

const MS_PER_DAY = 86400000;

function shiftIsoDate(iso, deltaDays) {
  const shifted = new Date(new Date(`${iso}T00:00:00Z`).getTime() + deltaDays * MS_PER_DAY);
  return shifted.toISOString().split('T')[0];
}

function daysBetween(fromIso, toIso) {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${toIso}T00:00:00Z`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / MS_PER_DAY);
}

function releaseYear(row) {
  if (!row.releaseDate || row.releaseDate === 'TBA') return null;
  return parseInt(row.releaseDate.slice(0, 4), 10);
}

// Percentage change against a baseline. A missing baseline has nothing to
// compare against and a zero one would divide by nothing, so both read as no
// comparison rather than as an infinite gain.
function pctChange(current, baseline) {
  if (baseline === null || baseline === undefined || baseline === 0) return null;
  return ((current - baseline) / baseline) * 100;
}

// Not yet open. Days running is the measurement that says a Movie has been
// seen at all, so a future date on its own is not enough: a Movie already
// running with a date ahead of it is a bad date, not an upcoming release.
function upcomingReleases(rows, today) {
  return rows
    .filter((row) => row.daysRunning === null && row.releaseDate && row.releaseDate > today)
    .sort((a, b) => (a.releaseDate < b.releaseDate ? -1 : 1));
}

// A Movie sitting exactly on break-even belongs in neither list. It has made
// nothing and lost nothing, and putting it at the tail of either would read as
// a result it has not produced.
function inProfit(rows) {
  return rows
    .filter((row) => row.profitTd !== null && row.profitTd > 0)
    .sort((a, b) => b.profitTd - a.profitTd);
}

function inTheRed(rows) {
  return rows
    .filter((row) => row.profitTd !== null && row.profitTd < 0)
    .sort((a, b) => a.profitTd - b.profitTd);
}

// Which digital releases are worth announcing. A held Pick always is: somebody
// in the League is watching it whatever year it opened in. An unheld Movie has
// to look like a genuine release of this Campaign's year, because the Board
// carries every 2026 release and upstream digital dates on the long tail are
// unreliable enough that a date before the theatrical one is noise.
function isStreamingCandidate(row, campaignYear) {
  if (!row.releasedDigital) return false;
  if (row.userId !== null) return true;
  if (!row.releaseDate || row.releaseDate === 'TBA') return false;
  if (releaseYear(row) !== campaignYear) return false;
  if (row.releasedDigital < row.releaseDate) return false;
  return true;
}

function withDigitalWindow(row) {
  const theatrical = row.releaseDate && row.releaseDate !== 'TBA' ? row.releaseDate : null;
  return {
    ...row,
    digitalWindowDays: theatrical ? daysBetween(theatrical, row.releasedDigital) : null,
  };
}

function streaming(rows, campaignYear, today) {
  const candidates = rows
    .filter((row) => isStreamingCandidate(row, campaignYear))
    .map(withDigitalWindow);

  return {
    all: candidates,
    upcomingDigital: candidates
      .filter((row) => row.releasedDigital > today)
      .sort((a, b) => (a.releasedDigital < b.releasedDigital ? -1 : 1)),
    availableNow: candidates
      .filter((row) => row.releasedDigital <= today)
      .sort((a, b) => (a.releasedDigital > b.releasedDigital ? -1 : 1)),
  };
}

// The day's earners. This reads `dailyChange`, the gross taken on the day
// itself, rather than gross to date. A zero is excluded: it means the source
// published no update for that Movie, not that nobody bought a ticket, and
// ranking it against real figures would put a stale row in the table.
function daily(rows, latestDate) {
  if (!latestDate) return { date: null, rows: [], label: 'Top Daily' };

  const yesterday = shiftIsoDate(latestDate, -1);
  const sameDayLastWeek = shiftIsoDate(latestDate, -7);

  const ranked = rows
    .filter((row) => {
      const today = row.dailyChange[latestDate];
      return today !== null && today !== undefined && today !== 0;
    })
    .map((row) => {
      const today = row.dailyChange[latestDate];
      return {
        movie: row,
        gross: today,
        pctYd: pctChange(today, row.dailyChange[yesterday]),
        pctLw: pctChange(today, row.dailyChange[sameDayLastWeek]),
      };
    })
    .sort((a, b) => b.gross - a.gross);

  // The old label's day is zero padded and its month is not, which is what the
  // tab has always read. Kept rather than tidied, so the port stays 1:1.
  const [, month, day] = latestDate.split('-');
  const abbr = getWeekdayAbbr(latestDate);
  const weekday = abbr[0] + abbr.slice(1).toLowerCase();

  return {
    date: latestDate,
    rows: ranked,
    label: `Top Daily (${weekday} ${day}/${parseInt(month, 10)})`,
  };
}

function sumDailyChangeInRange(row, startIso, endIso) {
  let sum = 0;
  for (const [date, value] of Object.entries(row.dailyChange)) {
    if (date >= startIso && date <= endIso && typeof value === 'number') sum += value;
  }
  return sum;
}

// The week's earners. The current week is almost always a part week, so
// comparing its running total against last week's finished total would show
// every Movie collapsing. Last week is therefore summed only as far as the same
// weekday, which makes the two halves of the ratio cover the same days.
function weekly(rows, latestDate) {
  if (!latestDate) return { weekKey: null, rows: [], label: 'Top Weekly' };

  const weekKey = dateToIsoWeekKey(latestDate);
  const sameDayLastWeek = shiftIsoDate(latestDate, -7);
  const lastWeek = isoWeekBounds(dateToIsoWeekKey(sameDayLastWeek));

  const ranked = rows
    .filter((row) => {
      const thisWeek = row.weeklyGross[weekKey];
      return thisWeek !== null && thisWeek !== undefined && thisWeek !== 0;
    })
    .map((row) => ({
      movie: row,
      gross: row.weeklyGross[weekKey],
      pctLw: pctChange(
        row.weeklyGross[weekKey],
        sumDailyChangeInRange(row, lastWeek.start, sameDayLastWeek),
      ),
    }))
    .sort((a, b) => b.gross - a.gross);

  return { weekKey, rows: ranked, label: `Top Weekly (${weekTitle(weekKey)})` };
}

export function buildHighlights(board) {
  const rows = board.rows || [];
  const today = board.latestDate || null;

  // The two gross tabs index figures that came off the Movie slice, so they are
  // anchored where the slice is (ADR 0008), not where the Campaign is. The other
  // four compare release dates against the Campaign's own reading of today.
  const measured = board.measurementDate || today;

  return {
    upcoming: today ? upcomingReleases(rows, today) : [],
    profitable: inProfit(rows),
    worst: inTheRed(rows),
    streaming: today
      ? streaming(rows, board.year, today)
      : { all: [], upcomingDigital: [], availableNow: [] },
    daily: daily(rows, measured),
    weekly: weekly(rows, measured),
  };
}
