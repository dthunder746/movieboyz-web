import { describe, expect, it } from 'vitest';

import { buildYearStandings } from './standings.js';

const CAMPAIGN = {
  league_slug: 'movieboyz',
  year: 2026,
  state: 'active',
  latest_date: '2026-08-21',
  latest_profit_date: '2026-08-20',
  roster: [
    { user_id: 'marcus', username: 'Marcus' },
    { user_id: 'connie', username: 'Connie' },
  ],
  movies: [
    { imdb_id: 'tt1', user_id: 'marcus' },
    { imdb_id: 'tt2', user_id: 'marcus' },
    { imdb_id: 'tt3', user_id: 'connie' },
    // On the Board and picked by nobody, which is most of a Board.
    { imdb_id: 'tt4' },
  ],
  users: [
    {
      user_id: 'connie',
      total: 400,
      slate_roi: 12.5,
      profit: { '2026-08-19': 100, '2026-08-20': 350 },
      bomb_impact: { '2026-08-19': 10, '2026-08-20': 50 },
    },
    {
      user_id: 'marcus',
      total: 900,
      slate_roi: 40,
      profit: { '2026-08-19': 500, '2026-08-20': 800 },
      bomb_impact: { '2026-08-19': 20, '2026-08-20': 100 },
    },
  ],
};

describe('buildYearStandings', () => {
  it('ranks the Users by their published total, highest first', () => {
    const { rows } = buildYearStandings(CAMPAIGN);

    expect(rows.map((row) => [row.rank, row.username, row.total])).toEqual([
      [1, 'Marcus', 900],
      [2, 'Connie', 400],
    ]);
  });

  // The Standings are anchored on the latest scored day rather than the latest
  // gross day. The two part whenever a capture lands gross nothing has been
  // scored against yet, and reading the series at the gross day would show a
  // blank where a figure belongs.
  it('reads each series at the latest scored day', () => {
    const { latestDate, rows } = buildYearStandings(CAMPAIGN);

    expect(latestDate).toBe('2026-08-20');
    expect(rows[0].slateProfit).toBe(800);
    expect(rows[0].bombImpact).toBe(100);
  });

  // Published rather than derived: excluding a bomb's Breakeven from its
  // picker's denominator is a scoring rule and rules live in the processor.
  it('reads the Slate ROI the artifact publishes', () => {
    expect(buildYearStandings(CAMPAIGN).rows[0].roi).toBe(40);
  });

  // The card draws the ranking. Everything the Campaign page puts around its
  // Standings needs the Board joined against the Movie slices, which this page
  // does not fetch, so nothing here is derived from `movies` at all.
  it('reads nothing off the Board', () => {
    const boardless = { ...CAMPAIGN, movies: [] };

    expect(buildYearStandings(boardless)).toEqual(buildYearStandings(CAMPAIGN));
  });

  it('names each User off the Roster', () => {
    expect(buildYearStandings(CAMPAIGN).rows.map((row) => row.userId)).toEqual([
      'marcus',
      'connie',
    ]);
  });

  it('names a User the Roster does not carry by their id', () => {
    const orphaned = { ...CAMPAIGN, roster: [] };

    expect(buildYearStandings(orphaned).rows.map((row) => row.username)).toEqual([
      'marcus',
      'connie',
    ]);
  });

  // Last rather than first, which is where an absent total would otherwise
  // sort. A User with nothing published is not the leader.
  it('sorts a User with no published total last', () => {
    const partial = {
      ...CAMPAIGN,
      users: [{ user_id: 'ghost' }, ...CAMPAIGN.users],
    };
    const { rows } = buildYearStandings(partial);

    expect(rows.map((row) => row.userId)).toEqual(['marcus', 'connie', 'ghost']);
    expect(rows[2].total).toBeNull();
  });

  // A day the series does not reach reads as absent rather than as zero, which
  // is what a Rostered User who has not scored yet looks like.
  it('reads a day a series does not carry as absent', () => {
    const early = { ...CAMPAIGN, latest_profit_date: '2026-08-18' };
    const { rows } = buildYearStandings(early);

    expect(rows[0].slateProfit).toBeNull();
    expect(rows[0].bombImpact).toBeNull();
  });

  it('builds nothing from a Campaign with no Users', () => {
    expect(buildYearStandings({ users: [] }).rows).toEqual([]);
    expect(buildYearStandings({}).rows).toEqual([]);
    expect(buildYearStandings(null).rows).toEqual([]);
  });
});
