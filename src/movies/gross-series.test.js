import { describe, expect, it } from 'vitest';

import { shiftIsoDate as shift } from '../shared/format.js';

import {
  DEFAULT_WINDOW_DAYS,
  WINDOW_OPTIONS,
  blankMessage,
  buildGrossSeries,
  skippedNote,
} from './gross-series.js';

const MILLION = 1e6;

function row(imdbId, fields) {
  return {
    imdbId,
    title: imdbId,
    releaseDate: null,
    grossTd: null,
    gross: {},
    ...fields,
  };
}

// One released Movie, its cumulative series carrying the flat pre-release days
// the slice publishes.
function released() {
  return row('tt-out', {
    title: 'Last Year',
    releaseDate: '2025-07-04',
    grossTd: 90 * MILLION,
    gross: {
      '2025-07-02': 0,
      '2025-07-03': 0,
      '2025-07-04': 40 * MILLION,
      '2025-07-05': 90 * MILLION,
    },
  });
}

describe('buildGrossSeries', () => {
  it('plots gross against days since release, with opening day at zero', () => {
    const { series } = buildGrossSeries([released()], { selectedIds: ['tt-out'] });

    expect(series).toHaveLength(1);
    expect(series[0].label).toBe('Last Year');
    expect(series[0].points).toEqual([
      { x: 0, y: 40 },
      { x: 1, y: 90 },
    ]);
  });

  // The chart says something before the reader has chosen anything, and what it
  // says follows the sort they are looking at, because the rows arrive already
  // sorted.
  it('defaults to the top five rows of the current sort', () => {
    const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) =>
      row(id, { releaseDate: '2025-07-04', gross: { '2025-07-04': 1 * MILLION } }));

    const { series } = buildGrossSeries(rows, {});

    expect(series.map((line) => line.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  // A film's long flat tail after it leaves cinemas squashes the part worth
  // looking at, so the reader gets to say how far out to plot.
  it('drops the days past the window and ends the axis there', () => {
    const gross = {};
    for (let day = 0; day <= 200; day += 1) {
      gross[shift('2025-07-04', day)] = day * MILLION;
    }
    const rows = [row('tt-long', { releaseDate: '2025-07-04', gross })];

    const { series, maxDay } = buildGrossSeries(rows, { windowDays: 90 });

    expect(series[0].points.at(-1)).toEqual({ x: 90, y: 90 });
    expect(maxDay).toBe(90);
  });

  // A window wider than anything plotted is not a claim that the films ran that
  // long, so the axis stops where the data does.
  it('ends the axis at the longest run when it falls inside the window', () => {
    const rows = [released()];

    const { maxDay } = buildGrossSeries(rows, { windowDays: 90 });

    expect(maxDay).toBe(1);
  });

  // Nothing matched the search or the year chips. There is no line to draw and
  // no film to blame it on.
  it('reports a blank chart when no row is in view', () => {
    const { series, blank } = buildGrossSeries([], {});

    expect(series).toEqual([]);
    expect(blank).toBe('no-rows');
  });

  // A slate that has not opened publishes a flat run of zeros. Plotting it
  // would draw every film along the axis and read as a room full of flops, so
  // the chart says so instead (#62).
  it('reports a blank chart when every row in view is unreleased', () => {
    const rows = [
      row('tt-soon', {
        releaseDate: '2026-12-25',
        gross: { '2026-11-01': 0, '2026-11-02': 0 },
      }),
    ];

    const { series, blank } = buildGrossSeries(rows, {});

    expect(series).toEqual([]);
    expect(blank).toBe('unreleased');
  });

  // The deploy window: a slice written before the identity fields cannot be put
  // on this axis at all, because there is no release date to measure from.
  it('leaves out a Movie with no release date', () => {
    const rows = [released(), row('tt-old', { gross: { '2025-07-04': 5 * MILLION } })];

    const { series, blank } = buildGrossSeries(rows, {});

    expect(series.map((line) => line.id)).toEqual(['tt-out']);
    expect(blank).toBe(null);
  });

  // An older Movie's series starts when the platform began capturing it rather
  // than on its opening day, so its whole published run sits thousands of days
  // out on this axis. There is nothing to compare against a film's first
  // months, so it is left off, but it is not unreleased and the page says so.
  it('separates a Movie with no box office inside the window from an unreleased one', () => {
    const rows = [
      row('tt-old', {
        releaseDate: '2019-04-24',
        gross: { '2026-07-31': 2799 * MILLION, '2026-08-20': 2799 * MILLION },
      }),
    ];

    const { series, blank, skipped } = buildGrossSeries(rows, { windowDays: 90 });

    expect(series).toEqual([]);
    expect(blank).toBe('outside-window');
    expect(skipped).toBe(1);
  });

  // The same Movie is not skipped for a reader who never asked about the first
  // 90 days: the count answers for the window that is showing.
  it('counts nothing as skipped when the window reaches the published run', () => {
    const rows = [released()];

    expect(buildGrossSeries(rows, { windowDays: 90 }).skipped).toBe(0);
  });

  // An unreleased Movie is not "outside the window": it has no box office at
  // all, in any window, so counting it would read as data the reader could get
  // back by widening the axis.
  it('does not count an unreleased Movie as skipped', () => {
    const rows = [
      released(),
      row('tt-soon', { releaseDate: '2026-12-25', gross: { '2026-11-01': 0 } }),
    ];

    const { skipped, blank } = buildGrossSeries(rows, { windowDays: 90 });

    expect(skipped).toBe(0);
    expect(blank).toBe(null);
  });

  it('offers a default window, and the options the control lists include it', () => {
    expect(WINDOW_OPTIONS).toContain(DEFAULT_WINDOW_DAYS);
  });

  // Sorted by release date, newest first, the top of the list is a run of films
  // that have not opened. Taking the top five rows literally would blank the
  // chart with released films sitting just below them, so the default is the
  // top five rows the axis can carry.
  it('skips over unreleased rows when it picks the default five', () => {
    const unreleased = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) =>
      row(id, { releaseDate: '2026-12-25', gross: { '2026-11-01': 0 } }));
    const rows = [...unreleased, released()];

    const { series } = buildGrossSeries(rows, {});

    expect(series.map((line) => line.id)).toEqual(['tt-out']);
  });

  // A reader who picks one 2019 film out of the table has not asked about the
  // rest of the list, so the chart answers about their pick. Reading the whole
  // view here says "nothing in view has box office" with plottable 2026 films
  // sitting right there in the table.
  it('reads the blank reason off the selection when there is one', () => {
    const rows = [
      released(),
      row('tt-old', {
        releaseDate: '2019-04-24',
        gross: { '2026-07-31': 2799 * MILLION },
      }),
    ];

    const built = buildGrossSeries(rows, { selectedIds: ['tt-old'], windowDays: 90 });

    expect(built.blank).toBe('outside-window');
    expect(built.scope).toBe('selection');
    expect(blankMessage(built)).toBe(
      'Nothing you selected has box office inside its first 90 days.'
      + ' These Movies were first measured later in their run,'
      + ' so a wider window may reach them.',
    );
  });

  // Filters run on the table, not on the selection, so a filter can carry the
  // selected Movies out of view and leave the chart with nothing to draw.
  it('says the selection is out of view when the filters have hidden it', () => {
    const built = buildGrossSeries([released()], { selectedIds: ['tt-gone'] });

    expect(built.blank).toBe('no-rows');
    expect(blankMessage(built)).toBe('The Movies you selected are not in view.');
  });

  // With a selection the count answers about the selection too, or it would
  // report rows the reader stopped asking about.
  it('counts the skipped rows inside the selection', () => {
    const rows = [
      released(),
      row('tt-old', {
        releaseDate: '2019-04-24',
        gross: { '2026-07-31': 2799 * MILLION },
      }),
    ];

    const built = buildGrossSeries(rows, {
      selectedIds: ['tt-out', 'tt-old'],
      windowDays: 90,
    });

    expect(built.skipped).toBe(1);
    expect(skippedNote(built)).toBe(
      '1 Movie you selected has no box office inside its first 90 days,'
      + ' so it is not plotted.',
    );
  });

  it('plots the selection instead of the default once there is one', () => {
    const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) =>
      row(id, { releaseDate: '2025-07-04', gross: { '2025-07-04': 1 * MILLION } }));

    const { series } = buildGrossSeries(rows, { selectedIds: ['g'] });

    expect(series.map((line) => line.id)).toEqual(['g']);
  });
});

// The page prints one of these instead of an empty canvas. They live here
// rather than in the page because there are three reasons and the page carried
// only two of them, which read an old film as one nobody had released yet.
describe('blankMessage', () => {
  it('says nothing when there is a chart to draw', () => {
    expect(blankMessage(buildGrossSeries([released()], {}))).toBe(null);
  });

  it('blames the filters when no row is in view', () => {
    expect(blankMessage(buildGrossSeries([], {})))
      .toBe('No Movie matches these filters.');
  });

  it('says an unreleased slate has no box office yet', () => {
    const rows = [row('tt-soon', {
      releaseDate: '2026-12-25',
      gross: { '2026-11-01': 0 },
    })];

    expect(blankMessage(buildGrossSeries(rows, {})))
      .toBe('Nothing in view has been released yet, so there is no box office to plot.');
  });

  // The wrong half of this was the bug: a 2019 film measured from 2026 onwards
  // is not unreleased, and telling the reader it is denies the figures they can
  // see in the table two inches below.
  it('names the window when the box office falls outside it, not the release', () => {
    const rows = [row('tt-old', {
      releaseDate: '2019-04-24',
      gross: { '2026-07-31': 2799 * MILLION },
    })];

    expect(blankMessage(buildGrossSeries(rows, { windowDays: 60 })))
      .toBe('Nothing in view has box office inside its first 60 days.'
        + ' These Movies were first measured later in their run,'
        + ' so a wider window may reach them.');
  });
});

// How many rows the reader can see in the table that the chart left out, said
// once under the chart rather than left as a silent gap between the two.
describe('skippedNote', () => {
  it('says nothing when every row in view can be plotted', () => {
    expect(skippedNote(buildGrossSeries([released()], { windowDays: 90 }))).toBe(null);
  });

  // A blank chart already says why in full, so counting the same rows again
  // under it would say it twice.
  it('says nothing when the chart is blank', () => {
    const rows = [row('tt-old', {
      releaseDate: '2019-04-24',
      gross: { '2026-07-31': 2799 * MILLION },
    })];

    expect(skippedNote(buildGrossSeries(rows, { windowDays: 90 }))).toBe(null);
  });

  it('counts the rows left out, in the singular', () => {
    const rows = [released(), row('tt-old', {
      releaseDate: '2019-04-24',
      gross: { '2026-07-31': 2799 * MILLION },
    })];

    expect(skippedNote(buildGrossSeries(rows, { windowDays: 90 })))
      .toBe('1 Movie in view has no box office inside its first 90 days,'
        + ' so it is not plotted.');
  });

  it('counts the rows left out, in the plural', () => {
    const old = ['tt-a', 'tt-b'].map((id) => row(id, {
      releaseDate: '2019-04-24',
      gross: { '2026-07-31': 2799 * MILLION },
    }));

    expect(skippedNote(buildGrossSeries([released(), ...old], { windowDays: 90 })))
      .toBe('2 Movies in view have no box office inside their first 90 days,'
        + ' so they are not plotted.');
  });
});
