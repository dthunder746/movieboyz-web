// Inline SVG glyphs and badges, ported from the foot of the old site's
// utils.js. Pure string builders: they take view-model values and return markup
// for the DOM layer to insert. Nothing here reads the artifact or the document.

// Lucide glyphs at 11x11, one per Pick type plus one per Season for the
// seasonal Picks that resolve into them.
const PICK_ICONS = {
  hit: '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  winter: '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/><path d="m20 16-4-4 4-4"/><path d="m4 8 4 4-4 4"/><path d="m16 4-4 4-4-4"/><path d="m8 20 4-4 4 4"/></svg>',
  summer: '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
  fall: '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>',
  bomb: '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="13" r="9"/><path d="m19.5 9.5 1.8-1.8a2.4 2.4 0 0 0 0-3.4l-1.6-1.6a2.4 2.4 0 0 0-3.4 0l-1.8 1.8"/><path d="m22 2-1.5 1.5"/></svg>',
};

// The icon for a Pick. A seasonal Pick is the only type whose glyph depends on
// when it opened, and it takes the Season the processor published rather than
// re-deriving one from the release month: the boundaries are the Campaign's to
// set, and a page that guessed them could disagree with the Campaign itself.
export function pickIcon(pickType, season) {
  if (!pickType) return '';
  let key = pickType.toLowerCase();
  if (key === 'seasonal') key = (season || '').toLowerCase();
  const glyph = PICK_ICONS[key];
  return glyph ? `<span class="scorecard-pick-icon">${glyph}</span>` : '';
}

// Every Movie on the Board carries a symbol, whether or not anybody holds it.
// An unheld Movie borrows the seasonal glyph for the Season it opens in, which
// is what puts it on the same visual footing as the Picks around it.
export function pickOrSeasonIcon(pickType, season) {
  return pickIcon(pickType || (season ? 'seasonal' : null), season);
}

// Display detail the artifact does not carry: this League's Users share first
// initials, so a single letter would not tell Chris from Connie. Anyone not
// listed falls back to one letter, which is correct for a roster that does not
// collide.
const USER_INITIALS = {
  chris: 'CM', connie: 'CL', emerson: 'EB', marcus: 'MH', matt: 'MW',
};

const UNHELD_COLOR = '#6c757d';

// A coloured circle carrying the holder's initials. A Movie nobody holds gets a
// grey circle and a dash, so an unheld row still lines up with the held ones.
export function userBadge(userId, username, colorMap) {
  if (!userId) {
    return `<span class="owner-badge" style="background:${UNHELD_COLOR}">–</span>`;
  }
  const color = (colorMap && colorMap[userId]) || '#888';
  const glyph = USER_INITIALS[userId] || (username || userId).charAt(0).toUpperCase();
  return `<span class="owner-badge" style="background:${color}">${glyph}</span>`;
}
