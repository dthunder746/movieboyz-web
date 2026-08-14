// Presentation helpers, ported unchanged from the old site so the page reads
// identically. Pure: no DOM, no artifact knowledge.

const BILLION = 1e9;
const MILLION = 1e6;
const THOUSAND = 1e3;

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

export function formatShortDate(isoDate) {
  const [, month, day] = isoDate.split('-');
  return `${MONTHS[parseInt(month, 10) - 1]} ${parseInt(day, 10)}`;
}
