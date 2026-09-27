import { describe, expect, it } from 'vitest';

import { beforeEach, vi } from 'vitest';

import { campaignHeading, chartHeadingHtml } from './heading.js';

beforeEach(() => {
  vi.stubGlobal('window', { location: { pathname: '/league/movieboyz/2026/' } });
  vi.stubGlobal('document', { querySelector: () => null });
});

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

// The chart's own heading. One or two films selected and it names them, and a
// name is the way into the film's page like every other name on the page
// (#188). Everything else it says is plain text, so the escaping has to be
// done here rather than left to `textContent`.
describe('chartHeadingHtml', () => {
  const byId = new Map([
    ['tt1', { title: 'Heat' }],
    ['tt2', { title: 'Tenet & Co' }],
  ]);
  const usernames = new Map([['u1', 'Marcus']]);

  function heading(activeUsers, activeMovieIds) {
    return chartHeadingHtml({
      activeUsers, activeMovieIds, byId, usernames,
    });
  }

  it('links the one selected film', () => {
    expect(heading([], ['tt1'])).toBe('<a class="movie-title-link" href="/movies/?id=tt1">Heat</a>');
  });

  it('links both of two selected films and escapes their names', () => {
    const html = heading([], ['tt1', 'tt2']);
    expect(html).toContain('href="/movies/?id=tt1">Heat</a>');
    expect(html).toContain('href="/movies/?id=tt2">Tenet &amp; Co</a>');
    expect(html).toContain(' · ');
  });

  it('counts them past two, because a heading is not a list', () => {
    expect(heading([], ['tt1', 'tt2', 'tt3'])).toBe('3 Movies');
  });

  it('names the one selected User, escaped', () => {
    expect(heading(['u1'], [])).toBe('Marcus: Movie Profits');
  });

  it('falls back to what the chart is when nothing is selected', () => {
    expect(heading([], [])).toBe('Profit Over Time');
  });

  it('falls back to the id for a film the Board does not carry', () => {
    expect(heading([], ['tt9'])).toBe('Selected Movie');
  });
});
