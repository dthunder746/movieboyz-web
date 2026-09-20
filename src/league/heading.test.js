import { describe, expect, it } from 'vitest';

import { leagueLede } from './heading.js';

// The lede names the League, so it has the title's problem: the name is the
// artifact's and the artifact may not carry one. It answers it the same way the
// title does rather than inventing a second fallback.
describe('leagueLede', () => {
  it('names the League', () => {
    expect(leagueLede({ league_slug: 'movieboyz', league_name: 'MovieBoyz' })).toBe(
      'Every campaign that MovieBoyz has run, and who is ahead across all of them.',
    );
  });

  it('falls back to the slug when the artifact carries no name', () => {
    expect(leagueLede({ league_slug: 'movieboyz' })).toBe(
      'Every campaign that movieboyz has run, and who is ahead across all of them.',
    );
  });

  it('falls back to the generic word when it carries neither', () => {
    expect(leagueLede({})).toBe(
      'Every campaign that League has run, and who is ahead across all of them.',
    );
  });
});
