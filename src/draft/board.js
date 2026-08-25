// The draft page's reading of the Campaign artifact.
//
// The old page read `data.json`, a single file keyed by IMDB id, and hardcoded
// the five Users of the one League that has ever existed. Both are gone: the
// artifact carries the whole Board (ADR 0008), so every Movie the draft page
// needs is in the one fetch the Campaign page already makes, and the roster
// says who the Users are rather than a constant in the source (#52).
//
// The rows are the same shape the Campaign's own Board builds, minus the
// measurements: the draft page shows Profit, Breakeven, ROI and rank, and none
// of those come off a Movie slice. So this reads the Campaign artifact alone,
// and the page is a single fetch beyond the Manifest.
//
// Pure: no fetching, no DOM.

// Where each Season starts, as the Campaign publishes them. The boundaries are
// the Campaign's to set and it freezes them at finalize (#38), so a page that
// re-derived a Season from a release month could disagree with the Campaign
// about which Season a Movie opened in.
const DEFAULT_SEASON_ORDER = ['WINTER', 'SUMMER', 'FALL'];

export const SEASON_ORDER = DEFAULT_SEASON_ORDER;

export const SEASON_LABEL = { WINTER: 'Winter', SUMMER: 'Summer', FALL: 'Fall' };

export function buildDraftBoard(campaign) {
  const usernames = new Map(
    (campaign?.roster || []).map((member) => [member.user_id, member.username]),
  );

  const rows = (campaign?.movies || []).map((movie) => {
    const userId = movie.user_id ?? null;

    return {
      imdbId: movie.imdb_id,
      title: movie.title,
      releaseDate: movie.release_date ?? null,
      season: movie.season ?? null,
      budget: movie.budget ?? null,
      breakeven: movie.breakeven ?? null,
      profitTd: movie.profit_td ?? null,

      // Null together for a Movie nobody holds, which is most of the Board.
      // The old page said the same thing with the string `'none'`; null is what
      // the artifact publishes (ADR 0008).
      userId,
      username: userId === null ? null : (usernames.get(userId) ?? userId),
      pickType: movie.pick_type ?? null,
      draftPick: movie.draft_pick ?? null,
    };
  });

  return {
    leagueSlug: campaign?.league_slug ?? null,
    leagueName: campaign?.league_name ?? null,
    year: campaign?.year ?? null,
    state: campaign?.state ?? null,
    latestDate: campaign?.latest_date ?? null,
    latestProfitDate: campaign?.latest_profit_date ?? null,
    seasonBoundaries: campaign?.ruleset?.season_boundaries ?? null,
    // The whole roster, not the Users who happen to hold a Pick. The
    // leaderboard gives every member a card so an empty Slate reads as an empty
    // Slate rather than as somebody who is not playing.
    users: (campaign?.roster || []).map((member) => ({
      userId: member.user_id,
      username: member.username,
    })),
    rows,
  };
}

// Which Season tab to open on. The Campaign publishes the boundaries, so this
// asks them rather than the calendar: it is the same rule the processor derived
// every `season` on the Board with, read back off the artifact.
//
// The fallback is the old page's month rule, for a Campaign whose Ruleset does
// not carry boundaries. It answers identically for the boundaries every
// published Campaign has so far used (Jan/May/Sep).
export function seasonForDate(isoDate, boundaries) {
  if (!isoDate) return 'WINTER';

  if (boundaries) {
    const starts = SEASON_ORDER
      .filter((season) => boundaries[season])
      .map((season) => ({ season, startsOn: boundaries[season] }));

    if (starts.length) {
      // The last Season whose start the date has reached. Before the first one
      // it is the first Season, which is the date sitting in the run-up to a
      // year that has not opened yet.
      let current = starts[0].season;
      for (const { season, startsOn } of starts) {
        if (isoDate >= startsOn) current = season;
      }
      return current;
    }
  }

  const month = parseInt(isoDate.split('-')[1], 10);
  if (month <= 4) return 'WINTER';
  if (month <= 8) return 'SUMMER';
  return 'FALL';
}

// Which Season tab the page opens on. The reader's last choice wins: the tabs
// are the same three on every draft page, so a choice made on one year is a
// choice about which part of a draft they came to read rather than about that
// Campaign, and it is remembered unscoped for the same reason.
//
// `saved` comes off a cookie, so it is checked against the Seasons that exist
// rather than trusted. Failing that the Board's own date answers, which is the
// first visit and the only time the calendar decides anything here.
export function initialSeason(saved, latestDate, boundaries) {
  if (SEASON_ORDER.includes(saved)) return saved;
  return seasonForDate(latestDate, boundaries);
}
