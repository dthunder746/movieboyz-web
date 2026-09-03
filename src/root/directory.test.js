import { describe, expect, it } from 'vitest';

import { buildDirectory } from './directory.js';

const ONE_LEAGUE = {
  leagues: [
    {
      slug: 'movieboyz',
      name: 'MovieBoyz',
      campaigns: [
        { year: 2025, state: 'final' },
        { year: 2026, state: 'active' },
      ],
    },
  ],
};

describe('buildDirectory', () => {
  it('lists each League with its landing page linked', () => {
    const directory = buildDirectory(ONE_LEAGUE, '/');

    expect(directory.leagues.map((league) => [league.name, league.href])).toEqual([
      ['MovieBoyz', '/league/movieboyz/'],
    ]);
  });

  // Every year holds two pages, and the directory is the one place both are
  // listed side by side (#81).
  it('lists each year newest first, linking its standings and its draft', () => {
    const directory = buildDirectory(ONE_LEAGUE, '/');

    expect(
      directory.leagues[0].years.map((year) => [year.label, year.standingsHref, year.draftHref]),
    ).toEqual([
      ['2026', '/league/movieboyz/2026/', '/league/movieboyz/2026/draft/'],
      ['2025', '/league/movieboyz/2025/', '/league/movieboyz/2025/draft/'],
    ]);
  });

  // Each year is badged with its Lifecycle state, as the navigation badges it,
  // so a final year reads differently from an active one before anybody clicks.
  it('carries each year’s Lifecycle state and its label', () => {
    const directory = buildDirectory(ONE_LEAGUE, '/');

    expect(directory.leagues[0].years.map((year) => [year.state, year.stateLabel])).toEqual([
      ['active', 'Active'],
      ['final', 'Final'],
    ]);
  });

  // Tolerant reader: a state this build has never heard of is shown as the
  // artifact wrote it rather than dropping the badge or the year.
  it('shows an unknown Lifecycle state as the artifact wrote it', () => {
    const manifest = {
      leagues: [{ slug: 'movieboyz', name: 'MovieBoyz', campaigns: [{ year: 2026, state: 'settling' }] }],
    };

    expect(buildDirectory(manifest, '/').leagues[0].years[0].stateLabel).toBe('settling');
  });

  // Movies is a section of its own, a peer of the Leagues rather than of the
  // years, because it is the one surface belonging to no League (#81).
  it('lists the Movies lookup as a top-level section', () => {
    expect(buildDirectory(ONE_LEAGUE, '/').movies.href).toBe('/movies/');
  });

  // The same build serves from the domain apex and from a Pages project path
  // that prefixes everything, so the prefix is carried into every link.
  it('carries the Pages project path into every link', () => {
    const directory = buildDirectory(ONE_LEAGUE, '/movieboyz-web/');

    expect(directory.brandHref).toBe('/movieboyz-web/');
    expect(directory.leagues[0].href).toBe('/movieboyz-web/league/movieboyz/');
    expect(directory.leagues[0].years[0].standingsHref).toBe('/movieboyz-web/league/movieboyz/2026/');
    expect(directory.leagues[0].years[0].draftHref).toBe('/movieboyz-web/league/movieboyz/2026/draft/');
    expect(directory.movies.href).toBe('/movieboyz-web/movies/');
  });

  // The file every one of these pages is really at, and it says nothing about
  // where the page sits.
  it('reads the root off the page’s own file the same as off its directory', () => {
    expect(buildDirectory(ONE_LEAGUE, '/movieboyz-web/index.html').brandHref).toBe('/movieboyz-web/');
  });

  // Both halves of a link are somebody else's text: the slug comes off the
  // Manifest. Every other interpolation on the page is escaped and this is no
  // different.
  it('escapes a League slug before it reaches a link', () => {
    const directory = buildDirectory(
      { leagues: [{ slug: 'a"b', name: 'Odd', campaigns: [{ year: 2026, state: 'active' }] }] },
      '/',
    );

    expect(directory.leagues[0].href).toBe('/league/a%22b/');
    expect(directory.leagues[0].years[0].draftHref).toBe('/league/a%22b/2026/draft/');
  });

  it('names a League by its slug when the Manifest carries no name', () => {
    const directory = buildDirectory({ leagues: [{ slug: 'newboyz', campaigns: [] }] }, '/');

    expect(directory.leagues[0].name).toBe('newboyz');
  });

  // Three different silences, and saying which one it is is the point of the
  // page: an unreadable Manifest, a Manifest listing no League, and a League
  // that has run no year yet. None of them takes the Movies lookup with it,
  // which reads no League file and is what stops the root being a dead end.
  describe('when there is nothing to list', () => {
    it('says the Manifest could not be read, and still offers Movies', () => {
      const directory = buildDirectory(null, '/');

      expect(directory.leagues).toEqual([]);
      expect(directory.leaguesNote).toBe('The published leagues could not be read.');
      expect(directory.movies.href).toBe('/movies/');
    });

    it('says no League is published when the Manifest lists none', () => {
      const directory = buildDirectory({ leagues: [] }, '/');

      expect(directory.leagues).toEqual([]);
      expect(directory.leaguesNote).toBe('No league has been published yet.');
      expect(directory.movies.href).toBe('/movies/');
    });

    it('says nothing over a Manifest that lists a League', () => {
      expect(buildDirectory(ONE_LEAGUE, '/').leaguesNote).toBeNull();
    });

    it('lists a League that has run no Campaign yet, and says so under it', () => {
      const directory = buildDirectory({ leagues: [{ slug: 'newboyz', name: 'New Boyz' }] }, '/');

      expect(directory.leagues[0].years).toEqual([]);
      expect(directory.leagues[0].yearsNote).toBe('No year has been published yet.');
      expect(buildDirectory(ONE_LEAGUE, '/').leagues[0].yearsNote).toBeNull();
    });
  });
});
