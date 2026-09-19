import { describe, expect, it } from 'vitest';

import {
  RELEASED_OPTIONS, dateSection, releasedSection, searchSection, segmentedSection,
} from './filter-sections.js';

// The suite runs without a DOM, so what is checked here is the markup each
// section renders. The three sections are shared between the Campaign and the
// Movies lookup (#161), and the ids in them are the contract the bind and sync
// helpers answer to, so a rename that breaks one page breaks a test first.

describe('searchSection', () => {
  it('carries the search box and the current query', () => {
    const html = searchSection({ search: 'marty' });

    expect(html).toContain('id="filter-search"');
    expect(html).toContain('value="marty"');
  });

  it('escapes a query that would otherwise close the attribute', () => {
    const html = searchSection({ search: '" onfocus="x' });

    expect(html).toContain('value="&quot; onfocus=&quot;x"');
  });
});

describe('dateSection', () => {
  it('carries both bounds', () => {
    const html = dateSection({ releaseFrom: '2026-01-01', releaseTo: '2026-06-30' });

    expect(html).toContain('id="filter-date-from"');
    expect(html).toContain('value="2026-01-01"');
    expect(html).toContain('id="filter-date-to"');
    expect(html).toContain('value="2026-06-30"');
  });

  // Either bound may be empty: a range with one open end is a real filter, not
  // a half-written one.
  it('leaves an absent bound empty', () => {
    const html = dateSection({ releaseFrom: '', releaseTo: null });

    expect(html).toContain('id="filter-date-from" class="form-control form-control-sm" style="width:auto" value=""');
    expect(html.match(/value=""/g)).toHaveLength(2);
  });
});

describe('segmentedSection', () => {
  it('marks only the current option on', () => {
    const html = segmentedSection('Released', RELEASED_OPTIONS, 'released-status', 'upcoming');

    expect(html).toContain('data-released-status="all"');
    expect(html).toContain('filter-segmented-btn on" data-released-status="upcoming"');
    expect(html).not.toContain('filter-segmented-btn on" data-released-status="all"');
  });
});

describe('releasedSection', () => {
  it('offers all three states under the Released label', () => {
    const html = releasedSection({ released: 'all' });

    expect(html).toContain('>Released<');
    expect(html).toContain('>All<');
    expect(html).toContain('>Released only<');
    expect(html).toContain('>Upcoming only<');
  });
});
