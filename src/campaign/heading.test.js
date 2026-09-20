import { describe, expect, it } from 'vitest';

import { campaignHeading } from './heading.js';

// The heading names the League and the year, and the artifact may not carry a
// name. It falls back the way the draft page's heading does rather than
// inventing a second answer: the two pages sit beside each other and a
// Campaign with no published name has to read the same on both.
describe('campaignHeading', () => {
  it('names the League and the year', () => {
    expect(campaignHeading({ league_name: 'MovieBoyz', year: 2026 })).toBe(
      'MovieBoyz 2026 Standings',
    );
  });

  it('falls back to the brand when the artifact carries no name', () => {
    expect(campaignHeading({ year: 2026 })).toBe('MovieBoyz 2026 Standings');
  });

  it('falls back for a League named something else too', () => {
    expect(campaignHeading({ league_name: 'Cinephiles', year: 2027 })).toBe(
      'Cinephiles 2027 Standings',
    );
  });
});
