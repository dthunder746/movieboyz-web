import { describe, expect, it, vi } from 'vitest';

import { createFilterState } from './filters.js';

// Board rows, trimmed to the fields the filters read. Three held Picks and two
// Movies nobody holds, which is the shape that matters: the Board carries the
// whole year, and the page hides the unheld ones until asked.
function rows() {
  return [
    {
      imdbId: 'tt1', title: 'Winter Hit', releaseDate: '2026-02-01',
      userId: 'marcus', pickType: 'hit', profitTd: 500,
    },
    {
      imdbId: 'tt2', title: 'Summer Bomb', releaseDate: '2026-06-01',
      userId: 'connie', pickType: 'bomb', profitTd: -200,
    },
    {
      imdbId: 'tt3', title: 'Unreleased Pick', releaseDate: '2026-12-01',
      userId: 'marcus', pickType: 'seasonal', profitTd: null,
    },
    {
      imdbId: 'tt4', title: 'Nobody Holds This', releaseDate: '2026-03-01',
      userId: null, pickType: null, profitTd: null,
    },
    {
      imdbId: 'tt5', title: 'Also Unheld', releaseDate: '2026-09-01',
      userId: null, pickType: null, profitTd: null,
    },
  ];
}

const LATEST = '2026-08-11';

function visible(filters) {
  return filters.filter(rows(), LATEST).sort();
}

describe('the default view', () => {
  it('shows every held Pick and hides the Movies nobody holds', () => {
    // The Board is the whole year (ADR 0008), but the page opens on the League:
    // 160-odd unheld Movies would bury the three that are being played for.
    expect(visible(createFilterState({}))).toEqual(['tt1', 'tt2', 'tt3']);
  });

  it('reports itself as default, with nothing counted', () => {
    const snap = createFilterState({}).snapshot();
    expect(snap.isDefault).toBe(true);
    expect(snap.activeCount).toBe(0);
  });
});

describe('showUnowned', () => {
  it('brings the rest of the Board in', () => {
    const filters = createFilterState({});
    filters.setShowUnowned(true);
    expect(visible(filters)).toEqual(['tt1', 'tt2', 'tt3', 'tt4', 'tt5']);
  });

  it('counts as an active filter', () => {
    const filters = createFilterState({});
    filters.setShowUnowned(true);
    expect(filters.snapshot().activeCount).toBe(1);
    expect(filters.snapshot().isDefault).toBe(false);
  });
});

describe('the User filter', () => {
  it('narrows to the Users toggled on', () => {
    const filters = createFilterState({});
    filters.toggleUser('marcus');
    expect(visible(filters)).toEqual(['tt1', 'tt3']);
  });

  it('accumulates as more Users are toggled on', () => {
    const filters = createFilterState({});
    filters.toggleUser('marcus');
    filters.toggleUser('connie');
    expect(visible(filters)).toEqual(['tt1', 'tt2', 'tt3']);
  });

  it('falls back to showing all Users when the last one is toggled off', () => {
    const filters = createFilterState({});
    filters.toggleUser('marcus');
    filters.toggleUser('marcus');
    expect(filters.snapshot().users).toBe(null);
    expect(visible(filters)).toEqual(['tt1', 'tt2', 'tt3']);
  });

  // An explicit User filter is a statement about who to show, so it answers the
  // unheld question on its own rather than deferring to the showUnowned toggle.
  it('overrides showUnowned rather than fighting it', () => {
    const filters = createFilterState({});
    filters.setShowUnowned(true);
    filters.toggleUser('marcus');
    expect(visible(filters)).toEqual(['tt1', 'tt3']);
  });
});

describe('the search box', () => {
  it('matches anywhere in the title, case-insensitively', () => {
    const filters = createFilterState({});
    filters.setSearch('BOMB');
    expect(visible(filters)).toEqual(['tt2']);
  });

  it('searches the held Picks only, unless the rest are showing', () => {
    const filters = createFilterState({});
    filters.setSearch('holds');
    expect(visible(filters)).toEqual([]);
    filters.setShowUnowned(true);
    expect(visible(filters)).toEqual(['tt4']);
  });
});

describe('the Pick type filter', () => {
  it('narrows to the types toggled on', () => {
    const filters = createFilterState({});
    filters.togglePickType('hit');
    expect(visible(filters)).toEqual(['tt1']);
  });

  it('is case-insensitive about the type it is given', () => {
    const filters = createFilterState({});
    filters.togglePickType('BOMB');
    expect(visible(filters)).toEqual(['tt2']);
  });
});

describe('the release date range', () => {
  it('keeps Movies inside the range, inclusive at both ends', () => {
    const filters = createFilterState({});
    filters.setReleaseRange('2026-02-01', '2026-06-01');
    expect(visible(filters)).toEqual(['tt1', 'tt2']);
  });

  it('leaves the far end open when only one bound is given', () => {
    const filters = createFilterState({});
    filters.setReleaseRange('', '2026-02-01');
    expect(visible(filters)).toEqual(['tt1']);
  });

  it('drops a Movie with no announced date', () => {
    const filters = createFilterState({});
    filters.setReleaseRange('2026-01-01', '2026-12-31');
    const undated = [{ imdbId: 'ttX', title: 'Undated', releaseDate: null, userId: 'marcus' }];
    expect(filters.filter(undated, LATEST)).toEqual([]);
  });
});

describe('the released status filter', () => {
  it('shows only what has opened by the latest scored day', () => {
    const filters = createFilterState({});
    filters.setReleasedStatus('released');
    expect(visible(filters)).toEqual(['tt1', 'tt2']);
  });

  it('shows only what has not opened yet', () => {
    const filters = createFilterState({});
    filters.setReleasedStatus('upcoming');
    expect(visible(filters)).toEqual(['tt3']);
  });

  it('counts a Movie with no announced date as upcoming', () => {
    const filters = createFilterState({});
    const undated = [{ imdbId: 'ttX', title: 'Undated', releaseDate: null, userId: 'marcus' }];
    filters.setReleasedStatus('upcoming');
    expect(filters.filter(undated, LATEST)).toEqual(['ttX']);
    filters.setReleasedStatus('released');
    expect(filters.filter(undated, LATEST)).toEqual([]);
  });

  it('ignores an unrecognised status rather than emptying the table', () => {
    const filters = createFilterState({});
    filters.setReleasedStatus('nonsense');
    expect(filters.snapshot().released).toBe('all');
  });
});

describe('the profitability filter', () => {
  it('shows the Picks in the black', () => {
    const filters = createFilterState({});
    filters.setProfitability('profitable');
    expect(visible(filters)).toEqual(['tt1']);
  });

  it('shows the Picks in the red', () => {
    const filters = createFilterState({});
    filters.setProfitability('red');
    expect(visible(filters)).toEqual(['tt2']);
  });

  // A Pick that has not opened has no Profit yet, which is not the same as
  // breaking even. Neither side of the filter should claim it.
  it('drops a Pick with no Profit either way', () => {
    const filters = createFilterState({});
    filters.setProfitability('profitable');
    expect(visible(filters)).not.toContain('tt3');
    filters.setProfitability('red');
    expect(visible(filters)).not.toContain('tt3');
  });
});

describe('clearing', () => {
  it('clearAll returns every dimension to its default', () => {
    const filters = createFilterState({});
    filters.setSearch('bomb');
    filters.toggleUser('marcus');
    filters.setShowUnowned(true);
    filters.clearAll();
    expect(filters.snapshot().isDefault).toBe(true);
    expect(visible(filters)).toEqual(['tt1', 'tt2', 'tt3']);
  });

  it('clearDimension leaves the others alone', () => {
    const filters = createFilterState({});
    filters.setSearch('bomb');
    filters.toggleUser('connie');
    filters.clearDimension('search');
    expect(filters.snapshot().search).toBe('');
    expect(filters.snapshot().users).toEqual(['connie']);
  });

  it('ignores a dimension name it does not know', () => {
    const filters = createFilterState({});
    filters.setSearch('bomb');
    filters.clearDimension('nonsense');
    expect(filters.snapshot().search).toBe('bomb');
  });
});

describe('activeCount', () => {
  it('counts each dimension once, however many values it holds', () => {
    const filters = createFilterState({});
    filters.toggleUser('marcus');
    filters.toggleUser('connie');
    filters.setSearch('a');
    expect(filters.snapshot().activeCount).toBe(2);
  });

  it('counts a release range as one dimension, not two', () => {
    const filters = createFilterState({});
    filters.setReleaseRange('2026-01-01', '2026-12-31');
    expect(filters.snapshot().activeCount).toBe(1);
  });
});

describe('change notification', () => {
  it('hands subscribers a snapshot on every change', () => {
    const onChange = vi.fn();
    const filters = createFilterState({ onChange });
    filters.setSearch('bomb');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].search).toBe('bomb');
  });

  it('hands out a snapshot the caller cannot mutate state through', () => {
    const filters = createFilterState({});
    filters.toggleUser('marcus');
    filters.snapshot().users.push('connie');
    expect(filters.snapshot().users).toEqual(['marcus']);
  });
});
