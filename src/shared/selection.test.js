import { describe, expect, it, vi } from 'vitest';

import { createSelection } from './selection.js';

// The set of Movies plotted on the chart. Three surfaces can change it (the
// table, the cards and the toolbar's clear button), so it is held in one place
// and they all read back from it rather than keeping their own copies.
describe('createSelection', () => {
  it('starts empty', () => {
    const selection = createSelection(() => {});
    expect(selection.toArray()).toEqual([]);
    expect(selection.size()).toBe(0);
  });

  it('adds and removes', () => {
    const selection = createSelection(() => {});
    selection.add('tt1');
    expect(selection.has('tt1')).toBe(true);
    selection.remove('tt1');
    expect(selection.has('tt1')).toBe(false);
  });

  it('toggles both ways', () => {
    const selection = createSelection(() => {});
    selection.toggle('tt1');
    expect(selection.has('tt1')).toBe(true);
    selection.toggle('tt1');
    expect(selection.has('tt1')).toBe(false);
  });

  it('replaces the whole set at once', () => {
    const selection = createSelection(() => {});
    selection.add('tt1');
    selection.set(['tt2', 'tt3']);
    expect(selection.toArray().sort()).toEqual(['tt2', 'tt3']);
  });

  it('clears', () => {
    const selection = createSelection(() => {});
    selection.set(['tt1', 'tt2']);
    selection.clear();
    expect(selection.toArray()).toEqual([]);
  });
});

// Each notification tears down and rebuilds the chart, so a no-op that still
// fired would rebuild it for nothing every time a row was re-clicked.
describe('change notification', () => {
  it('announces a real change', () => {
    const onChange = vi.fn();
    const selection = createSelection(onChange);
    selection.add('tt1');
    expect(onChange).toHaveBeenCalledWith(['tt1']);
  });

  it('stays quiet when adding something already selected', () => {
    const onChange = vi.fn();
    const selection = createSelection(onChange);
    selection.add('tt1');
    onChange.mockClear();
    selection.add('tt1');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('stays quiet when removing something not selected', () => {
    const onChange = vi.fn();
    const selection = createSelection(onChange);
    selection.remove('tt1');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('stays quiet when clearing an empty selection', () => {
    const onChange = vi.fn();
    const selection = createSelection(onChange);
    selection.clear();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('hands out a copy, not the set it is keeping', () => {
    const onChange = vi.fn();
    const selection = createSelection(onChange);
    selection.add('tt1');
    onChange.mock.calls[0][0].push('tt2');
    expect(selection.toArray()).toEqual(['tt1']);
  });
});
