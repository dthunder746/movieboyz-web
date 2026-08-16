import { describe, expect, it } from 'vitest';

import { buildProfitSeries } from './profit-series.js';

const MILLION = 1e6;

// Marcus is scored from the first day, Connie only from the second, so the
// padding of a shorter series is visible. Marcus's Slate holds one Pick with a
// gappy Profit series and one that has not released.
function campaign() {
  return {
    latest_profit_date: '2026-03-04',
    roster: [
      { user_id: 'marcus', username: 'Marcus' },
      { user_id: 'connie', username: 'Connie' },
    ],
    users: [
      {
        user_id: 'marcus',
        profit: { '2026-03-01': 0, '2026-03-02': 2 * MILLION, '2026-03-03': 2 * MILLION, '2026-03-04': 5 * MILLION },
        bomb_impact: { '2026-03-01': 0, '2026-03-02': 0, '2026-03-03': 0, '2026-03-04': -MILLION },
        total: 4 * MILLION,
      },
      {
        user_id: 'connie',
        profit: { '2026-03-02': MILLION, '2026-03-03': MILLION, '2026-03-04': MILLION },
        bomb_impact: { '2026-03-02': 0, '2026-03-03': 0, '2026-03-04': 0 },
        total: MILLION,
      },
    ],
    movies: [
      {
        imdb_id: 'tt1',
        title: 'The Gappy One',
        user_id: 'marcus',
        pick_type: 'hit',
        release_date: '2026-03-02',
        profit: { '2026-03-02': 2 * MILLION, '2026-03-04': 5 * MILLION },
      },
      {
        imdb_id: 'tt2',
        title: 'Not Out Yet',
        user_id: 'marcus',
        pick_type: 'seasonal',
        release_date: '2026-04-01',
        profit: {},
      },
      {
        imdb_id: 'tt3',
        title: "Connie's Pick",
        user_id: 'connie',
        pick_type: 'hit',
        release_date: '2026-03-02',
        profit: { '2026-03-02': MILLION, '2026-03-03': MILLION, '2026-03-04': MILLION },
      },
    ],
  };
}

function seriesFor(result, label) {
  return result.series.find((entry) => entry.label === label);
}

describe('buildProfitSeries with no User selected', () => {
  it('plots every User as a total line', () => {
    const result = buildProfitSeries(campaign(), []);
    expect(result.mode).toBe('users');
    expect(result.series.map((entry) => entry.label)).toEqual(['Marcus', 'Connie']);
  });

  it('plots the total in millions, Slate Profit plus Bomb Impact', () => {
    const result = buildProfitSeries(campaign(), []);
    expect(seriesFor(result, 'Marcus').points.map((point) => point.y)).toEqual([0, 2, 2, 4]);
  });

  it('spans every date, leaving a null where a User has no figure yet', () => {
    const result = buildProfitSeries(campaign(), []);
    expect(result.dates).toEqual(['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04']);
    expect(seriesFor(result, 'Connie').points.map((point) => point.y)).toEqual([null, 1, 1, 1]);
  });

  it('marks the date each Pick released against the User who holds it', () => {
    const result = buildProfitSeries(campaign(), []);
    // Index 1 is 2026-03-02. The unreleased Pick contributes no marker.
    expect(seriesFor(result, 'Marcus').releaseMarkers).toEqual({ 1: 'The Gappy One' });
    expect(seriesFor(result, 'Connie').releaseMarkers).toEqual({ 1: "Connie's Pick" });
  });
});

describe('buildProfitSeries with one User selected', () => {
  it('plots that User\'s Slate a Pick at a time', () => {
    const result = buildProfitSeries(campaign(), ['marcus']);
    expect(result.mode).toBe('slate');
    expect(result.series.map((entry) => entry.label)).toEqual(['The Gappy One']);
  });

  it('carries the last published Profit forward across a gap', () => {
    const result = buildProfitSeries(campaign(), ['marcus']);
    // Null before release, then 2m held through the missing 03-03, then 5m.
    expect(seriesFor(result, 'The Gappy One').points.map((point) => point.y)).toEqual([null, 2, 2, 5]);
  });

  it('drops a Pick with no published Profit rather than drawing an empty line', () => {
    const result = buildProfitSeries(campaign(), ['marcus']);
    expect(seriesFor(result, 'Not Out Yet')).toBeUndefined();
  });

  it('puts no release markers on Slate lines', () => {
    const result = buildProfitSeries(campaign(), ['marcus']);
    expect(seriesFor(result, 'The Gappy One').releaseMarkers).toEqual({});
  });
});

describe('buildProfitSeries with several Users selected', () => {
  it('plots total lines for exactly those Users', () => {
    const result = buildProfitSeries(campaign(), ['connie', 'marcus']);
    expect(result.mode).toBe('users');
    expect(result.series.map((entry) => entry.label)).toEqual(['Marcus', 'Connie']);
  });

  it('ignores a selected User who is not in the Campaign', () => {
    const result = buildProfitSeries(campaign(), ['connie', 'nobody']);
    expect(result.series.map((entry) => entry.label)).toEqual(['Connie']);
  });

  it('stays on the Slate view when the one selected User is unrecognised', () => {
    // Rather than falling back to plotting everybody, which would read as a
    // deselection the viewer did not make.
    const result = buildProfitSeries(campaign(), ['nobody']);
    expect(result.mode).toBe('slate');
    expect(result.series).toEqual([]);
  });
});

// Selecting rows in the table plots exactly those Movies, whoever holds them.
// It is the only mode that can put two Users' Picks on the same chart, so it
// takes priority over the User selection rather than intersecting with it.
describe('buildProfitSeries with Movies selected', () => {
  it('plots exactly the Movies selected', () => {
    const result = buildProfitSeries(campaign(), [], ['tt3', 'tt1']);
    expect(result.mode).toBe('movies');
    expect(result.series.map((entry) => entry.label)).toEqual(["Connie's Pick", 'The Gappy One']);
  });

  it('keeps the order they were selected in, so the colours hold still', () => {
    const result = buildProfitSeries(campaign(), [], ['tt1', 'tt3']);
    expect(result.series.map((entry) => entry.id)).toEqual(['tt1', 'tt3']);
  });

  it('overrides a User selection rather than narrowing it', () => {
    const result = buildProfitSeries(campaign(), ['marcus'], ['tt3']);
    expect(result.mode).toBe('movies');
    expect(result.series.map((entry) => entry.label)).toEqual(["Connie's Pick"]);
  });

  it('carries the last published Profit forward across a gap', () => {
    const result = buildProfitSeries(campaign(), [], ['tt1']);
    expect(seriesFor(result, 'The Gappy One').points.map((point) => point.y)).toEqual([null, 2, 2, 5]);
  });

  it('drops a selected Pick with no published Profit', () => {
    const result = buildProfitSeries(campaign(), [], ['tt1', 'tt2']);
    expect(result.series.map((entry) => entry.id)).toEqual(['tt1']);
  });

  it('ignores a selected id the Board does not carry', () => {
    const result = buildProfitSeries(campaign(), [], ['tt1', 'tt404']);
    expect(result.series.map((entry) => entry.id)).toEqual(['tt1']);
  });

  it('puts no release markers on Movie lines', () => {
    const result = buildProfitSeries(campaign(), [], ['tt1']);
    expect(seriesFor(result, 'The Gappy One').releaseMarkers).toEqual({});
  });

  it('falls back to the User modes when nothing is selected', () => {
    expect(buildProfitSeries(campaign(), [], []).mode).toBe('users');
    expect(buildProfitSeries(campaign(), ['marcus'], []).mode).toBe('slate');
  });

  it('stays on the Movie view when every selected id is unrecognised', () => {
    // The alternative would silently switch back to plotting Users, which reads
    // as a deselection the viewer did not make.
    const result = buildProfitSeries(campaign(), [], ['tt404']);
    expect(result.mode).toBe('movies');
    expect(result.series).toEqual([]);
  });
});

describe('buildProfitSeries trim', () => {
  it('opens the view a day before the first figure that is not zero', () => {
    // Marcus sits at zero on 03-01, so the opening view starts at 03-01 rather
    // than showing a flat lead-in.
    expect(buildProfitSeries(campaign(), []).trim.initialMin).toBe('2026-03-01');
  });

  it('bounds panning a day either side of the plotted range', () => {
    const { trim } = buildProfitSeries(campaign(), []);
    expect(trim.limitMin).toBe('2026-02-28');
    expect(trim.limitMax).toBe('2026-03-04');
  });

  it('leaves the trim unset when there is nothing to plot', () => {
    const empty = { ...campaign(), users: [], movies: [] };
    const { trim, dates } = buildProfitSeries(empty, []);
    expect(dates).toEqual([]);
    expect(trim).toEqual({ initialMin: null, limitMin: null, limitMax: null });
  });
});
