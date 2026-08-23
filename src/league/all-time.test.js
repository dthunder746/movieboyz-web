import { describe, expect, it } from 'vitest';

import { buildAllTimeRows } from './all-time.js';

const LANDING = {
  league_slug: 'movieboyz',
  league_name: 'MovieBoyz',
  all_time: [
    {
      user_id: 'marcus',
      username: 'Marcus',
      profit: 1796490701,
      gross: 3255490700.5,
      breakeven: 1459000000,
      bomb_impact_absorbed: -110568422,
      bomb_impact_dealt: 15723777,
      movies_picked: 11,
      years_competed: 1,
    },
    {
      user_id: 'chris',
      username: 'Chris',
      profit: 476259289,
      gross: 1841759288.75,
      breakeven: 1365500000,
      bomb_impact_absorbed: -106637478,
      bomb_impact_dealt: 0,
      movies_picked: 11,
      years_competed: 1,
    },
  ],
};

describe('buildAllTimeRows', () => {
  it('builds a row per User who has competed', () => {
    expect(buildAllTimeRows(LANDING).map((row) => row.username)).toEqual(['Marcus', 'Chris']);
  });

  it('carries every figure the artifact publishes', () => {
    expect(buildAllTimeRows(LANDING)[0]).toEqual({
      rank: 1,
      userId: 'marcus',
      username: 'Marcus',
      profit: 1796490701,
      gross: 3255490700.5,
      breakeven: 1459000000,
      bombAbsorbed: -110568422,
      bombDealt: 15723777,
      moviesPicked: 11,
      yearsCompeted: 1,
    });
  });

  // The ranking is part of the pre-computed join, as it is for Campaign
  // Standings: the artifact publishes the order and the site renders it. A file
  // that arrives out of order is a bug upstream, and re-sorting here would hide
  // it while making the site compute the one figure the League argues about.
  it('renders the published order rather than re-sorting it', () => {
    const backwards = { all_time: [...LANDING.all_time].reverse() };

    expect(buildAllTimeRows(backwards).map((row) => row.username)).toEqual(['Chris', 'Marcus']);
    expect(buildAllTimeRows(backwards).map((row) => row.rank)).toEqual([1, 2]);
  });

  // Tolerant reader. A figure this build expects and the file does not carry is
  // absent rather than zero, because the money formatter draws a dash for one
  // and "$0" for the other, and they mean different things.
  it('reads an absent figure as absent rather than as zero', () => {
    const sparse = { all_time: [{ user_id: 'nobody', username: 'Nobody' }] };

    expect(buildAllTimeRows(sparse)[0]).toEqual({
      rank: 1,
      userId: 'nobody',
      username: 'Nobody',
      profit: null,
      gross: null,
      breakeven: null,
      bombAbsorbed: null,
      bombDealt: null,
      moviesPicked: null,
      yearsCompeted: null,
    });
  });

  it('names a User the artifact left unnamed by their id', () => {
    expect(buildAllTimeRows({ all_time: [{ user_id: 'ghost' }] })[0].username).toBe('ghost');
  });

  it('builds nothing from a League nobody has competed in', () => {
    expect(buildAllTimeRows({ all_time: [] })).toEqual([]);
    expect(buildAllTimeRows({})).toEqual([]);
    expect(buildAllTimeRows(null)).toEqual([]);
  });
});
