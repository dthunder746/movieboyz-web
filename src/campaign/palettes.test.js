import { describe, expect, it } from 'vitest';

import { MOVIE_PALETTE, PALETTE, buildColorMap, buildMoviePalette } from './palettes.js';

// The colour a User's line and card carry is the one the old site gave them, so
// the page reads the same to somebody who has been watching it all season. That
// only holds if the assignment stays index-by-index over a sorted roster.
describe('buildColorMap', () => {
  it('assigns palette colours in sorted id order', () => {
    const map = buildColorMap(['marcus', 'chris', 'connie']);
    expect(map).toEqual({
      chris: PALETTE[0],
      connie: PALETTE[1],
      marcus: PALETTE[2],
    });
  });

  it('gives the league’s five Users the old site’s colours', () => {
    const map = buildColorMap(['chris', 'connie', 'emerson', 'marcus', 'matt']);
    expect(map.chris).toBe('#4e79a7');
    expect(map.connie).toBe('#f28e2b');
    expect(map.emerson).toBe('#e15759');
    expect(map.marcus).toBe('#76b7b2');
    expect(map.matt).toBe('#59a14f');
  });

  it('wraps round rather than running out on a roster larger than the palette', () => {
    const ids = Array.from({ length: PALETTE.length + 2 }, (_, i) => `u${String(i).padStart(2, '0')}`);
    const map = buildColorMap(ids);
    expect(map.u10).toBe(PALETTE[0]);
    expect(map.u11).toBe(PALETTE[1]);
  });

  it('maps an empty roster to an empty map', () => {
    expect(buildColorMap([])).toEqual({});
  });
});

describe('buildMoviePalette', () => {
  it('hands out the vivid palette in order', () => {
    expect(buildMoviePalette(3)).toEqual(MOVIE_PALETTE.slice(0, 3));
  });

  it('wraps round past the end', () => {
    const colors = buildMoviePalette(MOVIE_PALETTE.length + 1);
    expect(colors).toHaveLength(MOVIE_PALETTE.length + 1);
    expect(colors[MOVIE_PALETTE.length]).toBe(MOVIE_PALETTE[0]);
  });

  it('is visibly distinct from the User palette, so the two modes never blur', () => {
    for (const color of MOVIE_PALETTE) expect(PALETTE).not.toContain(color);
  });
});
