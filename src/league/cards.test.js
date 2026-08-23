import { describe, expect, it } from 'vitest';

import { buildCampaignCards } from './cards.js';

const MARCUS = { user_id: 'marcus', username: 'Marcus' };
const CONNIE = { user_id: 'connie', username: 'Connie' };

function landing(campaigns) {
  return { league_slug: 'movieboyz', league_name: 'MovieBoyz', campaigns };
}

describe('buildCampaignCards', () => {
  // Newest first is the artifact's own order, for the reason the all-time
  // ranking is: the file states it and the site renders it.
  it('builds a card per Campaign in the published order', () => {
    const cards = buildCampaignCards(
      landing([
        { year: 2027, state: 'drafting' },
        { year: 2026, state: 'active', leader: [MARCUS] },
        { year: 2025, state: 'final', leader: [CONNIE] },
      ]),
    );

    expect(cards.map((card) => card.year)).toEqual([2027, 2026, 2025]);
  });

  it('carries each year’s Lifecycle state and its label', () => {
    const cards = buildCampaignCards(
      landing([
        { year: 2026, state: 'active', leader: [MARCUS] },
        { year: 2025, state: 'final', leader: [CONNIE] },
      ]),
    );

    expect(cards.map((card) => [card.state, card.stateLabel])).toEqual([
      ['active', 'Active'],
      ['final', 'Final'],
    ]);
  });

  // The link into the full Campaign page, which is what keeps the landing page
  // a hub rather than a replacement. It is a path and not an href: the site
  // root is a fact about where the page is being served and this module is pure.
  it('links each card at its own Campaign path', () => {
    const cards = buildCampaignCards(landing([{ year: 2026, state: 'active', leader: [MARCUS] }]));

    expect(cards[0].path).toBe('league/movieboyz/2026/');
  });

  describe('an active year', () => {
    it('names the current leader', () => {
      const [card] = buildCampaignCards(
        landing([{ year: 2026, state: 'active', leader: [MARCUS] }]),
      );

      expect(card.leaderLabel).toBe('Leader');
      expect(card.leaders).toEqual([{ userId: 'marcus', username: 'Marcus' }]);
      expect(card.empty).toBeNull();
    });

    it('names two Users level at the top as co-leaders', () => {
      const [card] = buildCampaignCards(
        landing([{ year: 2026, state: 'active', leader: [MARCUS, CONNIE] }]),
      );

      expect(card.leaderLabel).toBe('Co-leaders');
      expect(card.leaders.map((leader) => leader.username)).toEqual(['Marcus', 'Connie']);
    });
  });

  // A finished year reads as finished: the recorded winner rather than whoever
  // happens to be on top.
  describe('a final year', () => {
    it('names the winner', () => {
      const [card] = buildCampaignCards(
        landing([{ year: 2025, state: 'final', leader: [CONNIE] }]),
      );

      expect(card.leaderLabel).toBe('Winner');
      expect(card.leaders).toEqual([{ userId: 'connie', username: 'Connie' }]);
    });

    // The league has no tie-break rule, so a tie records co-winners and settles
    // nothing between them.
    it('names co-winners on a tie', () => {
      const [card] = buildCampaignCards(
        landing([{ year: 2025, state: 'final', leader: [MARCUS, CONNIE] }]),
      );

      expect(card.leaderLabel).toBe('Co-winners');
      expect(card.leaders.map((leader) => leader.username)).toEqual(['Marcus', 'Connie']);
    });

    // Distinct from a Campaign that is simply not finished: this one was closed
    // with nobody eligible, which is a real if degenerate result.
    it('says so when a closed year recorded no winner at all', () => {
      const [card] = buildCampaignCards(landing([{ year: 2025, state: 'final', leader: [] }]));

      expect(card.leaderLabel).toBeNull();
      expect(card.leaders).toEqual([]);
      expect(card.empty).toBe('No winner recorded.');
    });
  });

  // The whole point of the empty state: a year nobody has picked in must not
  // look like a year everybody scored nothing in.
  describe('a drafting year', () => {
    it('shows an empty state rather than a leader', () => {
      const [card] = buildCampaignCards(landing([{ year: 2027, state: 'drafting' }]));

      expect(card.leaderLabel).toBeNull();
      expect(card.leaders).toEqual([]);
      expect(card.empty).toBe('No picks entered yet.');
    });

    // And nothing to expand into. Its Standings would be a Roster of zeroes,
    // which is exactly the reading the empty state exists to prevent.
    it('cannot be expanded', () => {
      expect(buildCampaignCards(landing([{ year: 2027, state: 'drafting' }]))[0].expandable).toBe(
        false,
      );
    });
  });

  it('lets a scored year be expanded', () => {
    const cards = buildCampaignCards(
      landing([
        { year: 2026, state: 'active', leader: [MARCUS] },
        { year: 2025, state: 'final', leader: [CONNIE] },
      ]),
    );

    expect(cards.map((card) => card.expandable)).toEqual([true, true]);
  });

  // Two live contests is the normal case for this League and needs no special
  // explanation: both are ordinary cards.
  it('builds two active years as ordinary cards', () => {
    const cards = buildCampaignCards(
      landing([
        { year: 2026, state: 'active', leader: [MARCUS] },
        { year: 2025, state: 'active', leader: [CONNIE] },
      ]),
    );

    expect(cards.map((card) => card.leaderLabel)).toEqual(['Leader', 'Leader']);
    expect(cards.map((card) => card.expandable)).toEqual([true, true]);
  });

  // Tolerant reader, as the navigation is: a Lifecycle state this build has
  // never heard of is shown as the artifact wrote it, and is scored rather than
  // drafting, because `drafting` is the one state that names an empty year.
  it('shows an unknown Lifecycle state as the artifact wrote it', () => {
    const [card] = buildCampaignCards(
      landing([{ year: 2026, state: 'settling', leader: [MARCUS] }]),
    );

    expect(card.stateLabel).toBe('settling');
    expect(card.leaderLabel).toBe('Leader');
    expect(card.expandable).toBe(true);
  });

  // The artifact holds a scored year to naming its leader, so this cannot
  // arrive from a healthy export. It reads as the degenerate result rather than
  // as a crash, because a card that throws takes the whole column with it.
  it('reads a scored year with no leader field as one with nobody in it', () => {
    const [card] = buildCampaignCards(landing([{ year: 2026, state: 'active' }]));

    expect(card.leaders).toEqual([]);
    expect(card.empty).toBe('Nobody has scored yet.');
  });

  it('names a leader the artifact left unnamed by their id', () => {
    const [card] = buildCampaignCards(
      landing([{ year: 2026, state: 'active', leader: [{ user_id: 'ghost' }] }]),
    );

    expect(card.leaders).toEqual([{ userId: 'ghost', username: 'ghost' }]);
  });

  it('builds nothing from a League that has run no Campaign', () => {
    expect(buildCampaignCards(landing([]))).toEqual([]);
    expect(buildCampaignCards({})).toEqual([]);
    expect(buildCampaignCards(null)).toEqual([]);
  });
});
