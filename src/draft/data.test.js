import { afterEach, describe, expect, it, vi } from 'vitest';

import { CampaignUnavailable } from '../shared/campaign-unavailable.js';
import { heldNetwork } from '../shared/testing/held-network.js';

import { loadDraft } from './data.js';

const MANIFEST = {
  leagues: [
    {
      slug: 'movieboyz',
      name: 'MovieBoyz',
      campaigns: [{ year: 2026, state: 'active' }],
    },
  ],
  movie_years: [2026],
  default_view: { league_slug: 'movieboyz', year: 2026 },
};

const CAMPAIGN = {
  league_slug: 'movieboyz',
  league_name: 'MovieBoyz',
  year: 2026,
  roster: [{ user_id: 'u1', username: 'Marcus' }],
  movies: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadDraft', () => {
  // The page's own URL names both the League and the year, so the Campaign
  // artifact has nothing to learn from the Manifest before it can be asked for.
  it('asks for the manifest and the campaign artifact at once', async () => {
    const net = heldNetwork();

    loadDraft({ leagueSlug: 'movieboyz', year: 2026 });
    await net.settle();

    expect(net.requested).toEqual(['index.json', 'leagues/movieboyz/2026.json']);
  });

  it('resolves with the manifest and the campaign', async () => {
    const net = heldNetwork();

    const pending = loadDraft({ leagueSlug: 'movieboyz', year: 2026 });
    await net.settle();
    net.respond('index.json', MANIFEST);
    net.respond('leagues/movieboyz/2026.json', CAMPAIGN);

    const { manifest, campaign } = await pending;
    expect(manifest).toEqual(MANIFEST);
    expect(campaign).toEqual(CAMPAIGN);
  });

  // The claim the whole page rests on. Everything the draft shows (Profit,
  // Breakeven, ROI, rank) is on the Campaign artifact, so unlike the Campaign
  // page this asks for no Movie slice and is one fetch beyond the Manifest.
  it('reads no Movie slice', async () => {
    const net = heldNetwork();

    const pending = loadDraft({ leagueSlug: 'movieboyz', year: 2026 });
    await net.settle();
    net.respond('index.json', MANIFEST);
    net.respond('leagues/movieboyz/2026.json', CAMPAIGN);
    await pending;

    expect(net.requested).toEqual(['index.json', 'leagues/movieboyz/2026.json']);
  });

  describe('when the campaign artifact does not load', () => {
    it('throws with the manifest, so the page is still navigable', async () => {
      const net = heldNetwork();

      const pending = loadDraft({ leagueSlug: 'movieboyz', year: 2026 });
      await net.settle();
      net.respond('index.json', MANIFEST);
      net.missing('leagues/movieboyz/2026.json');

      await expect(pending).rejects.toBeInstanceOf(CampaignUnavailable);
      await pending.catch((error) => {
        expect(error.manifest).toEqual(MANIFEST);
        expect(error.leagueSlug).toBe('movieboyz');
        expect(error.year).toBe(2026);
      });
    });

    // A year the Manifest lists and whose file is missing is a publishing
    // failure; a year it does not list was never played. The page says
    // something different about each.
    it('says whether the Manifest lists the year at all', async () => {
      const net = heldNetwork();

      const pending = loadDraft({ leagueSlug: 'movieboyz', year: 2026 });
      await net.settle();
      net.respond('index.json', MANIFEST);
      net.missing('leagues/movieboyz/2026.json');

      await pending.catch((error) => expect(error.published).toBe(true));
    });

    it('knows a year nobody has published', async () => {
      const net = heldNetwork();

      const pending = loadDraft({ leagueSlug: 'movieboyz', year: 2099 });
      await net.settle();
      net.respond('index.json', MANIFEST);
      net.missing('leagues/movieboyz/2099.json');

      await pending.catch((error) => expect(error.published).toBe(false));
    });

    it('survives the manifest failing too', async () => {
      const net = heldNetwork();

      const pending = loadDraft({ leagueSlug: 'movieboyz', year: 2026 });
      await net.settle();
      net.missing('index.json');
      net.missing('leagues/movieboyz/2026.json');

      await expect(pending).rejects.toBeInstanceOf(CampaignUnavailable);
      await pending.catch((error) => {
        expect(error.manifest).toBeNull();
        expect(error.published).toBe(false);
      });
    });
  });
});
