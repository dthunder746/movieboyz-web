import { describe, expect, it } from 'vitest';

import { expansionAction } from './accordion.js';

describe('expansionAction', () => {
  it('goes to the network the first time a card is opened', () => {
    expect(expansionAction({ open: true, entry: undefined })).toBe('fetch');
  });

  // The whole point of the accordion: comparing two years costs one fetch each
  // and nothing after, however many times the reader toggles between them.
  it('renders what a reopened card already has', () => {
    expect(expansionAction({ open: true, entry: { status: 'ready', campaign: {} } })).toBe(
      'render',
    );
  });

  // A second click while the first request is still out would put an identical
  // one on the wire and race it back.
  it('waits on a request already in flight', () => {
    expect(expansionAction({ open: true, entry: { status: 'loading' } })).toBe('wait');
  });

  // A failed fetch is not a cached answer. Reopening the card is the reader
  // asking again, and a year whose artifact was briefly unreachable should not
  // stay unreachable for the life of the page.
  it('tries again after a fetch that failed', () => {
    expect(expansionAction({ open: true, entry: { status: 'failed' } })).toBe('fetch');
  });

  it('collapses without touching the network, whatever the card holds', () => {
    expect(expansionAction({ open: false, entry: undefined })).toBe('collapse');
    expect(expansionAction({ open: false, entry: { status: 'loading' } })).toBe('collapse');
    expect(expansionAction({ open: false, entry: { status: 'ready' } })).toBe('collapse');
    expect(expansionAction({ open: false, entry: { status: 'failed' } })).toBe('collapse');
  });
});
