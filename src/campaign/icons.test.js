import { describe, expect, it } from 'vitest';

import { pickIcon, pickOrSeasonIcon, userBadge } from './icons.js';

describe('pickIcon', () => {
  it('gives a hit its own icon regardless of season', () => {
    expect(pickIcon('hit', 'SUMMER')).toContain('polygon');
  });

  it('gives a bomb its own icon regardless of season', () => {
    const icon = pickIcon('bomb', 'WINTER');
    expect(icon).toContain('circle');
    expect(icon).toContain('m22 2-1.5 1.5');
  });

  // A seasonal Pick is the one type whose icon depends on when it opened, so it
  // reads off the Season the processor published rather than the release month.
  // Re-deriving here would let the page disagree with the Campaign's own
  // boundaries (CONTEXT.md: Season).
  it('resolves a seasonal Pick through the published Season', () => {
    expect(pickIcon('seasonal', 'WINTER')).toContain('m20 16-4-4 4-4');
    expect(pickIcon('seasonal', 'SUMMER')).toContain('cx="12" cy="12" r="4"');
    expect(pickIcon('seasonal', 'FALL')).toContain('M11 20A7 7 0');
  });

  it('accepts a Season in any case', () => {
    expect(pickIcon('seasonal', 'summer')).toBe(pickIcon('seasonal', 'SUMMER'));
    expect(pickIcon('HIT', 'WINTER')).toBe(pickIcon('hit', 'WINTER'));
  });

  it('renders nothing for a Movie nobody picked', () => {
    expect(pickIcon(null, 'SUMMER')).toBe('');
  });

  it('renders nothing for a seasonal Pick with no Season to resolve', () => {
    expect(pickIcon('seasonal', null)).toBe('');
  });

  it('wraps the glyph so the page can size it', () => {
    expect(pickIcon('hit', 'SUMMER')).toContain('class="scorecard-pick-icon"');
  });
});

// Every Movie on the Board gets a symbol, held or not: a Pick shows its type,
// and a Movie nobody holds falls back to the Season it opens in.
describe('pickOrSeasonIcon', () => {
  it('shows the Pick’s type when there is one', () => {
    expect(pickOrSeasonIcon('bomb', 'FALL')).toBe(pickIcon('bomb', 'FALL'));
  });

  it('falls back to the Season for an unheld Movie', () => {
    expect(pickOrSeasonIcon(null, 'FALL')).toBe(pickIcon('seasonal', 'FALL'));
  });

  it('renders nothing when there is neither a Pick nor a Season', () => {
    expect(pickOrSeasonIcon(null, null)).toBe('');
  });
});

describe('userBadge', () => {
  const colors = { marcus: '#76b7b2' };

  it('paints the badge in the User’s own colour', () => {
    expect(userBadge('marcus', 'Marcus', colors)).toContain('background:#76b7b2');
  });

  // The league's Users share first initials, so a single letter would not tell
  // Chris from Connie. The pairs are display detail the artifact does not carry.
  it('uses both initials where the roster is known to collide', () => {
    expect(userBadge('chris', 'Chris', colors)).toContain('>CM<');
    expect(userBadge('connie', 'Connie', colors)).toContain('>CL<');
  });

  it('falls back to the username’s first letter for an unknown User', () => {
    expect(userBadge('sam', 'Sam', colors)).toContain('>S<');
  });

  it('gives an unheld Movie a grey dash', () => {
    const badge = userBadge(null, null, colors);
    expect(badge).toContain('#6c757d');
    expect(badge).toContain('>–<');
  });
});
