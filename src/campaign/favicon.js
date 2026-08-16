// The tab icon: a coloured disc carrying the leader's initial.
//
// It is painted twice. The first paint runs before the artifacts have loaded,
// from the leader cached at the end of the last visit, so the tab is not blank
// for the length of three fetches. The second reconciles it against the
// Campaign once the real Standings are known.

import { buildColorMap } from './palettes.js';

const STORAGE_KEY = 'mbLeader';
// Who the roster was last visit. A colour is handed out by position within the
// sorted roster, so the leader's id alone is not enough to paint them in the
// colour they will have once the Campaign lands.
const ROSTER_KEY = 'mbRoster';

function paint(initial, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(16, 16, 14, 0, 2 * Math.PI);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initial.toUpperCase(), 16, 17);

  const link = document.querySelector('link[rel="icon"]') || document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  link.href = canvas.toDataURL('image/png');
  if (!link.parentNode) document.head.appendChild(link);
}

function cachedLeader() {
  return localStorage.getItem(STORAGE_KEY);
}

function cachedRoster() {
  try {
    const stored = JSON.parse(localStorage.getItem(ROSTER_KEY));
    return Array.isArray(stored) ? stored : null;
  } catch {
    return null;
  }
}

// Before the data lands, from what the last visit left behind. A first-ever
// visit paints nothing rather than guessing: a wrong colour that then corrects
// itself reads worse than a tab that fills in once.
export function paintCachedFavicon() {
  const leader = cachedLeader();
  const roster = cachedRoster();
  if (!leader || !roster) return;

  const colorMap = buildColorMap(roster);
  if (colorMap[leader]) paint(leader.charAt(0), colorMap[leader]);
}

// After the data lands. `rows` are the Standings, already ranked.
export function paintLeaderFavicon(rows, colorMap) {
  const [leader] = rows;
  if (!leader || !colorMap[leader.userId]) return;

  if (leader.userId !== cachedLeader()) {
    paint((leader.username || leader.userId).charAt(0), colorMap[leader.userId]);
  }
  localStorage.setItem(STORAGE_KEY, leader.userId);
  localStorage.setItem(ROSTER_KEY, JSON.stringify(rows.map((row) => row.userId)));
}
