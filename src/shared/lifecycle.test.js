import { describe, expect, it } from 'vitest';

import { stateLabel, stateTone } from './lifecycle.js';

// The three states the Manifest publishes. Both badges the site draws, the
// navigation's and the Movie page's, read their words from here.
describe('stateLabel', () => {
  it('names every state the platform publishes', () => {
    expect(stateLabel('drafting')).toBe('Drafting');
    expect(stateLabel('active')).toBe('Active');
    expect(stateLabel('final')).toBe('Final');
  });

  // The Manifest is read tolerantly. A Campaign is not worth hiding over a
  // word this deploy predates, so an unknown state is shown as it was written.
  it('shows a state it has not heard of as the artifact wrote it', () => {
    expect(stateLabel('settling')).toBe('settling');
  });

  it('passes a missing state straight back', () => {
    expect(stateLabel(undefined)).toBe(undefined);
    expect(stateLabel(null)).toBe(null);
  });
});

describe('stateTone', () => {
  it('tones each state apart from the others', () => {
    expect(stateTone('drafting')).toBe('text-bg-secondary');
    expect(stateTone('active')).toBe('text-bg-success');
    expect(stateTone('final')).toBe('text-bg-primary');
  });

  // A tone is a Bootstrap class going straight into a badge's markup, so an
  // unknown state falls back to a real one rather than to nothing.
  it('falls back to the neutral tone for a state it has not heard of', () => {
    expect(stateTone('settling')).toBe('text-bg-secondary');
    expect(stateTone(undefined)).toBe('text-bg-secondary');
  });
});
