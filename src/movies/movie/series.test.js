import { describe, expect, it } from 'vitest';

import { blankMessage, buildMovieSeries, measurementNote } from './series.js';

const MILLION = 1e6;

function view(fields = {}) {
  return {
    imdbId: 'tt0427340',
    title: 'Masters of the Universe',
    releaseDate: '2026-06-05',
    measuredOn: '2026-06-21',
    gross: {},
    weeklyGross: {},
    ...fields,
  };
}

describe('buildMovieSeries cumulative', () => {
  // The slice publishes a flat run of zeros from before a Movie opened. They
  // are not box office and they push the curve's whole shape into the right
  // half of the canvas, so the line starts where the Movie did.
  it('starts the curve at the release date, not at the published zeros', () => {
    const built = buildMovieSeries(view({
      gross: {
        '2026-06-03': 0,
        '2026-06-04': 0,
        '2026-06-05': 40 * MILLION,
        '2026-06-06': 90 * MILLION,
      },
    }));

    expect(built.cumulative).toEqual([
      { x: '2026-06-05', y: 40 },
      { x: '2026-06-06', y: 90 },
    ]);
  });

  it('keeps a zero that falls on or after the release date', () => {
    const built = buildMovieSeries(view({
      gross: { '2026-06-04': 0, '2026-06-05': 0, '2026-06-06': 12 * MILLION },
    }));

    expect(built.cumulative.map((point) => point.x)).toEqual(['2026-06-05', '2026-06-06']);
  });

  // A slice written before the identity fields carries no release date (#60),
  // so there is no day to cut at and the first real figure has to stand in.
  it('starts at the first figure when there is no release date', () => {
    const built = buildMovieSeries(view({
      releaseDate: null,
      gross: { '2026-06-03': 0, '2026-06-04': 0, '2026-06-05': 40 * MILLION },
    }));

    expect(built.cumulative).toEqual([{ x: '2026-06-05', y: 40 }]);
  });

  it('reads the days in whatever order the artifact wrote them', () => {
    const built = buildMovieSeries(view({
      gross: { '2026-06-07': 120 * MILLION, '2026-06-05': 40 * MILLION },
    }));

    expect(built.cumulative.map((point) => point.x)).toEqual(['2026-06-05', '2026-06-07']);
  });
});

describe('buildMovieSeries weekly', () => {
  // A week is a span and a bar sits at a point, so it is centred on the week's
  // Thursday. Anchoring on the Monday would draw the week's takings three days
  // before half of them happened.
  it('centres each week on its own Thursday', () => {
    const built = buildMovieSeries(view({
      weeklyGross: { '2026-W23': 54 * MILLION },
    }));

    expect(built.weekly).toEqual([
      { x: '2026-06-04', y: 54, week: '2026-W23', label: 'Jun 1–7' },
    ]);
  });

  it('puts the weeks in order whatever order they were published in', () => {
    const built = buildMovieSeries(view({
      weeklyGross: {
        '2026-W25': 12 * MILLION,
        '2026-W23': 54 * MILLION,
        '2026-W24': 30 * MILLION,
      },
    }));

    expect(built.weekly.map((bar) => bar.week)).toEqual(['2026-W23', '2026-W24', '2026-W25']);
  });

  it('drops the weeks before the one the Movie opened in', () => {
    const built = buildMovieSeries(view({
      weeklyGross: { '2026-W21': 0, '2026-W22': 0, '2026-W23': 54 * MILLION },
    }));

    expect(built.weekly.map((bar) => bar.week)).toEqual(['2026-W23']);
  });

  // A week of nothing partway through a run is a real answer: the Movie left
  // the cinemas. Only the leading zeros are the artifact padding its series.
  it('keeps a nothing week that falls inside the run', () => {
    const built = buildMovieSeries(view({
      weeklyGross: { '2026-W23': 54 * MILLION, '2026-W24': 0, '2026-W25': 2 * MILLION },
    }));

    expect(built.weekly.map((bar) => bar.y)).toEqual([54, 0, 2]);
  });

  it('drops the leading nothing weeks when there is no release date to cut at', () => {
    const built = buildMovieSeries(view({
      releaseDate: null,
      weeklyGross: { '2026-W21': 0, '2026-W23': 54 * MILLION },
    }));

    expect(built.weekly.map((bar) => bar.week)).toEqual(['2026-W23']);
  });
});

// Every Movie released before the platform started capturing daily figures has
// a curve that begins thousands of dollars and some number of days into its
// run. Saying so is the difference between a plot that looks wrong and one the
// reader can trust.
describe('buildMovieSeries measurement start', () => {
  it('says how many days in the measuring started', () => {
    const built = buildMovieSeries(view({
      releaseDate: '2026-06-05',
      gross: { '2026-06-15': 100 * MILLION },
    }));

    expect(built.measurementBeganOn).toBe('2026-06-15');
    expect(built.measurementBeganDay).toBe(10);
  });

  it('says nothing when the curve starts on the opening day', () => {
    const built = buildMovieSeries(view({
      gross: { '2026-06-05': 40 * MILLION },
    }));

    expect(built.measurementBeganDay).toBe(null);
  });

  it('says nothing when there is no release date to count from', () => {
    const built = buildMovieSeries(view({
      releaseDate: null,
      gross: { '2026-06-15': 100 * MILLION },
    }));

    expect(built.measurementBeganDay).toBe(null);
  });

  it('writes the note as a sentence, or not at all', () => {
    const late = buildMovieSeries(view({ gross: { '2026-06-15': 100 * MILLION } }));
    const onTime = buildMovieSeries(view({ gross: { '2026-06-05': 40 * MILLION } }));

    expect(measurementNote(late)).toBe(
      'Daily figures for this Movie begin 10 days into its run, on 2026-06-15,'
      + ' so the curve starts partway up.',
    );
    expect(measurementNote(onTime)).toBe(null);
  });

  it('counts a single day in the singular', () => {
    const built = buildMovieSeries(view({ gross: { '2026-06-06': 40 * MILLION } }));

    expect(measurementNote(built)).toContain('begin 1 day into its run');
  });
});

// Two different facts, and a flat line at zero says neither of them.
describe('buildMovieSeries with nothing to plot', () => {
  it('is not out yet when its release falls after the day it was measured', () => {
    const built = buildMovieSeries(view({ releaseDate: '2026-12-25', measuredOn: '2026-06-21' }));

    expect(built.blank).toBe('unreleased');
    expect(blankMessage(built)).toBe(
      'Masters of the Universe opens on 2026-12-25, so there is no box office to plot yet.',
    );
  });

  it('has no figures when it is out and none have been published', () => {
    const built = buildMovieSeries(view({ releaseDate: '2026-06-05', measuredOn: '2026-06-21' }));

    expect(built.blank).toBe('no-figures');
    expect(blankMessage(built)).toBe('No box office has been published for this Movie yet.');
  });

  // A release year nothing in has been measured yet publishes a slice with no
  // measured day at all, which is the whole of 2027 today. The newest day any
  // slice was measured stands in, so a film a year out still says so rather
  // than reading as one nobody has published a figure for.
  it('falls back to the newest day anything was measured on', () => {
    const built = buildMovieSeries(
      view({ releaseDate: '2027-06-18', measuredOn: null }),
      { asOf: '2026-08-21' },
    );

    expect(built.blank).toBe('unreleased');
  });

  it('prefers the Movie\'s own measured day to the fallback', () => {
    const built = buildMovieSeries(
      view({ releaseDate: '2026-06-05', measuredOn: '2026-06-21' }),
      { asOf: '2026-01-01' },
    );

    expect(built.blank).toBe('no-figures');
  });

  it('has no figures when nothing says whether it is out', () => {
    const built = buildMovieSeries(view({ releaseDate: null, measuredOn: null }));

    expect(built.blank).toBe('no-figures');
  });

  // A Movie with a Weekly gross and no daily curve still has something to
  // draw, so the page shows the bars rather than a sentence.
  it('is not blank when only one of the two series has figures', () => {
    const built = buildMovieSeries(view({ weeklyGross: { '2026-W23': 54 * MILLION } }));

    expect(built.blank).toBe(null);
    expect(blankMessage(built)).toBe(null);
  });

  it('is not blank for a Movie that has opened to nothing', () => {
    const built = buildMovieSeries(view({ gross: { '2026-06-05': 0 } }));

    expect(built.blank).toBe(null);
  });
});
