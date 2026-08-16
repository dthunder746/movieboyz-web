// Presentation helpers, ported unchanged from the old site so the page reads
// identically. Pure: no DOM, no artifact knowledge.

const BILLION = 1e9;
const MILLION = 1e6;
const THOUSAND = 1e3;
const MS_PER_DAY = 86400000;

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// Money, abbreviated. The sign sits outside the dollar symbol ("-$110.6m"),
// which is what the old site renders.
export function fmt(value) {
  if (value === null || value === undefined) return '—';
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= BILLION) return `${sign}$${(abs / BILLION).toFixed(3)}b`;
  if (abs >= MILLION) return `${sign}$${(abs / MILLION).toFixed(1)}m`;
  if (abs >= THOUSAND) return `${sign}$${Math.round(abs / THOUSAND)}k`;
  return `${sign}$${Math.round(abs)}`;
}

// Percentages carry an explicit plus so a gain reads as one at a glance.
export function fmtPct(value) {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

// Zero is neutral rather than positive: a User who has not scored yet should not
// be painted green.
export function colorClass(value) {
  if (value === null || value === undefined) return 'text-neu';
  if (value > 0) return 'text-pos';
  if (value < 0) return 'text-neg';
  return 'text-neu';
}

// Ratings read the opposite way round to money: there is no sign to go on, so
// the bands are absolute. 70 and up is well received, under 50 is not, and the
// middle is left uncoloured rather than nudged either way.
export function ratingColorClass(score) {
  if (score === null || score === undefined) return 'text-neu';
  if (score >= 70) return 'text-pos';
  if (score < 50) return 'text-neg';
  return 'text-neu';
}

// Every renderer here builds markup as a string, so anything coming off an
// artifact passes through this on its way into the DOM. The ampersand goes
// first: replacing it after the others would escape the escapes.
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatShortDate(isoDate) {
  const [, month, day] = isoDate.split('-');
  return `${MONTHS[parseInt(month, 10) - 1]} ${parseInt(day, 10)}`;
}

export function formatDayMonth(isoDate) {
  const [, month, day] = isoDate.split('-');
  return `${day}/${month}`;
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// Read in UTC on purpose. An ISO date is a calendar day, not an instant, and
// parsing it in local time would move it a day west of Greenwich.
export function getWeekdayAbbr(isoDate) {
  return WEEKDAYS[new Date(`${isoDate}T00:00:00Z`).getUTCDay()];
}

function toIso(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Arithmetic over the bare `YYYY-MM-DD` dates the artifacts publish. Read at
// UTC midnight for the same reason `getWeekdayAbbr` is: a calendar day shifted
// in local time can come back an hour short and land on the day before.
export function shiftIsoDate(isoDate, deltaDays) {
  return toIso(new Date(new Date(`${isoDate}T00:00:00Z`).getTime() + deltaDays * MS_PER_DAY));
}

// Whole days from the first date to the second, negative if it runs backwards.
// A date that will not parse has no answer rather than a NaN, which would
// otherwise reach the page and render itself into a countdown.
export function daysBetween(fromIso, untilIso) {
  const from = new Date(`${fromIso}T00:00:00Z`).getTime();
  const to = new Date(`${untilIso}T00:00:00Z`).getTime();
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / MS_PER_DAY);
}

// ISO 8601 weeks, which is how the processor keys weekly gross. Two rules do
// all the work: a week runs Monday to Sunday, and it belongs to the year that
// holds its Thursday. Week 1 is therefore the week containing January 4th,
// which is the anchor both helpers below pivot on.
export function isoWeekBounds(weekKey) {
  const [yearPart, weekPart] = weekKey.split('-W');
  const year = parseInt(yearPart, 10);
  const week = parseInt(weekPart, 10);

  const jan4 = new Date(Date.UTC(year, 0, 4));
  const weekdayOfJan4 = jan4.getUTCDay() || 7; // Sunday counts as 7, not 0.
  const firstMonday = new Date(jan4.getTime() - (weekdayOfJan4 - 1) * MS_PER_DAY);
  const monday = new Date(firstMonday.getTime() + (week - 1) * 7 * MS_PER_DAY);
  const sunday = new Date(monday.getTime() + 6 * MS_PER_DAY);

  return { start: toIso(monday), end: toIso(sunday) };
}

// A week's label. The month is named once when the week sits inside it and
// twice when it straddles a boundary, so "Aug 10–16" and "Feb 23–Mar 1" both
// read naturally.
export function weekTitle(weekKey) {
  const { start, end } = isoWeekBounds(weekKey);
  const [, startMonth] = start.split('-');
  const [, endMonth, endDay] = end.split('-');
  return startMonth === endMonth
    ? `${formatShortDate(start)}–${parseInt(endDay, 10)}`
    : `${formatShortDate(start)}–${formatShortDate(end)}`;
}

export function dateToIsoWeekKey(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = date.getUTCDay() || 7;

  // The Thursday of this week decides the ISO year, which is why the last days
  // of December can key to week 1 of the next year and the first days of
  // January to week 52 or 53 of the previous one.
  const thursday = new Date(date.getTime() + (4 - weekday) * MS_PER_DAY);
  const isoYear = thursday.getUTCFullYear();

  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const weekdayOfJan4 = jan4.getUTCDay() || 7;
  const firstMonday = new Date(jan4.getTime() - (weekdayOfJan4 - 1) * MS_PER_DAY);
  const monday = new Date(date.getTime() - (weekday - 1) * MS_PER_DAY);

  const week = 1 + Math.round((monday.getTime() - firstMonday.getTime()) / (7 * MS_PER_DAY));
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

// A timestamp string off the artifact is already in the site's time zone, so
// it only needs the century trimmed. A Date has to be rendered, and it is
// rendered in the reader's own zone rather than converted.
export function fmtTimestamp(value) {
  if (typeof value === 'string') return value.substring(2);

  const yy = String(value.getFullYear()).slice(-2);
  const mo = String(value.getMonth() + 1).padStart(2, '0');
  const dd = String(value.getDate()).padStart(2, '0');
  const hh = String(value.getHours()).padStart(2, '0');
  const mi = String(value.getMinutes()).padStart(2, '0');
  const ss = String(value.getSeconds()).padStart(2, '0');
  return `${yy}-${mo}-${dd} ${hh}:${mi}:${ss}`;
}

export function fmtRelativeAgo(from) {
  let then;
  if (from instanceof Date) then = from;
  else if (typeof from === 'string') then = new Date(from.replace(' ', 'T'));
  else return '';
  if (Number.isNaN(then.getTime())) return '';

  // A capture timestamped slightly ahead of the reader's clock is a clock skew,
  // not a prediction, so it reads as "just now" rather than counting backwards.
  const elapsed = Math.max(0, Date.now() - then.getTime());

  const minutes = Math.floor(elapsed / 60000);
  const hours = Math.floor(elapsed / 3600000);
  const days = Math.floor(elapsed / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}mins ago`;
  if (hours < 24) {
    const remainder = minutes - hours * 60;
    return remainder > 0 ? `${hours}hrs ${remainder}mins ago` : `${hours}hrs ago`;
  }
  const remainder = hours - days * 24;
  return remainder > 0 ? `${days}days ${remainder}hrs ago` : `${days}days ago`;
}
