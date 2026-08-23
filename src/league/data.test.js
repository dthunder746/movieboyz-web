import { afterEach, describe, expect, it, vi } from 'vitest';

import { heldNetwork } from '../shared/testing/held-network.js';

import { LeagueUnavailable, loadCampaignYear, loadLeague } from './data.js';

const MANIFEST = {
  leagues: [
    {
      slug: 'movieboyz',
      name: 'MovieBoyz',
      campaigns: [{ year: 2026, state: 'active' }],
    },
  ],
  default_view: { league_slug: 'movieboyz', year: 2026 },
};

const LANDING = {
  league_slug: 'movieboyz',
  league_name: 'MovieBoyz',
  all_time: [],
  campaigns: [{ year: 2026, state: 'active', leader: [] }],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadLeague', () => {
  // The page's own URL names the League, so the landing artifact has nothing to
  // learn from the Manifest before it can be asked for. Both go at once, which
  // is the load shape #53 settled on for the Campaign page.
  it('asks for the manifest and the landing artifact at once', async () => {
    const net = heldNetwork();

    loadLeague({ leagueSlug: 'movieboyz' });
    await net.settle();

    expect(net.requested).toEqual(['index.json', 'leagues/movieboyz/index.json']);
  });

  it('resolves with the manifest and the landing artifact', async () => {
    const net = heldNetwork();

    const pending = loadLeague({ leagueSlug: 'movieboyz' });
    await net.settle();
    net.respond('index.json', MANIFEST);
    net.respond('leagues/movieboyz/index.json', LANDING);

    const { manifest, landing } = await pending;
    expect(manifest).toEqual(MANIFEST);
    expect(landing).toEqual(LANDING);
  });

  // The whole page is one fetch, which is what the landing artifact is for: no
  // Campaign artifact and no Movie slice is read until a card is expanded.
  it('asks for nothing else', async () => {
    const net = heldNetwork();

    const pending = loadLeague({ leagueSlug: 'movieboyz' });
    await net.settle();
    net.respond('index.json', MANIFEST);
    net.respond('leagues/movieboyz/index.json', LANDING);
    await pending;

    expect(net.requested).toHaveLength(2);
  });

  // An unpublished landing artifact has to leave the page legible rather than
  // broken, and the Manifest is what makes it legible: the navigation still
  // renders, so a reader who landed here is not stuck.
  describe('when the landing artifact does not load', () => {
    it('throws with the manifest, so the page is still navigable', async () => {
      const net = heldNetwork();

      const pending = loadLeague({ leagueSlug: 'movieboyz' });
      await net.settle();
      net.respond('index.json', MANIFEST);
      net.missing('leagues/movieboyz/index.json');

      await expect(pending).rejects.toBeInstanceOf(LeagueUnavailable);
      await pending.catch((error) => {
        expect(error.manifest).toEqual(MANIFEST);
        expect(error.leagueSlug).toBe('movieboyz');
      });
    });

    // A League the Manifest lists and whose file is missing is a publishing
    // failure; a League it does not list was never published. The page says
    // something different about each.
    it('says whether the Manifest lists the League at all', async () => {
      const net = heldNetwork();

      const pending = loadLeague({ leagueSlug: 'movieboyz' });
      await net.settle();
      net.respond('index.json', MANIFEST);
      net.missing('leagues/movieboyz/index.json');

      await pending.catch((error) => expect(error.published).toBe(true));
    });

    it('knows a League nobody has published', async () => {
      const net = heldNetwork();

      const pending = loadLeague({ leagueSlug: 'filmfellas' });
      await net.settle();
      net.respond('index.json', MANIFEST);
      net.missing('leagues/filmfellas/index.json');

      await pending.catch((error) => expect(error.published).toBe(false));
    });

    // The Manifest is the second thing that can fail, and the page still has to
    // render something. It reports the League it could not load either way.
    it('survives the manifest failing too', async () => {
      const net = heldNetwork();

      const pending = loadLeague({ leagueSlug: 'movieboyz' });
      await net.settle();
      net.missing('index.json');
      net.missing('leagues/movieboyz/index.json');

      await expect(pending).rejects.toBeInstanceOf(LeagueUnavailable);
      await pending.catch((error) => {
        expect(error.manifest).toBeNull();
        expect(error.published).toBe(false);
      });
    });
  });
});

// The accordion's own fetch, made when a reader expands a card rather than on
// the way to first paint.
describe('loadCampaignYear', () => {
  it('asks for that year’s Campaign artifact and nothing else', async () => {
    const net = heldNetwork();

    const pending = loadCampaignYear('movieboyz', 2025);
    await net.settle();

    expect(net.requested).toEqual(['leagues/movieboyz/2025.json']);

    net.respond('leagues/movieboyz/2025.json', { year: 2025 });
    expect(await pending).toEqual({ year: 2025 });
  });

  // No Movie slice. The card draws the ranking, and the Board it would need the
  // slices for is a click away on the card's own link.
  it('reads no Movie slice', async () => {
    const net = heldNetwork();

    const pending = loadCampaignYear('movieboyz', 2025);
    await net.settle();
    net.respond('leagues/movieboyz/2025.json', { year: 2025 });
    await pending;

    expect(net.requested).toEqual(['leagues/movieboyz/2025.json']);
  });
});
