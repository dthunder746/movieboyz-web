# PROTOTYPE · two level nav · platform#168

Throwaway. Not a build entry in `vite.config.js`, so it exists under `npm run dev`
and ships nowhere. Delete the branch when #168 is settled.

```
npm run dev
http://localhost:5173/prototype/nav/
```

The shape: the bar holds `🎬 MBZ | Leagues ▾ | Movies | ☀` and nothing else, however
many Leagues are published. Opening `Leagues` lists every published League in
Manifest order; opening a League gives a second level holding `Overview` and one row
per year, newest first, each with its Lifecycle badge.

Both readings of the bar are drawn, as `src/shared/nav.js` draws them today, and the
same 992px media query picks between them. Narrow the window under 992px for the
compact overlay.

## Parameters

All five are independent and combinable. The floating yellow bar at the bottom sets
them; every control writes into the URL, so any combination is shareable and survives
a reload.

| Param | Values | What it changes |
|---|---|---|
| `touch` | `tap-row` (default), `split`, `drill` | How the second level opens without a hover |
| `year` | `alone` (default), `trailing`, `two-rows` | What a year's row holds |
| `mark` | `toggle` (default), `rows-only` | What says where the reader is |
| `manifest` | `three` (default), `one`, `ten` | 3 Leagues at 5/3/1 years; 1 League at 5; 10 Leagues |
| `path` | any address the Manifest answers, plus `/` and `/movies/` | Where the reader is |

`touch`:

- `tap-row`: the whole League row is a button that opens the submenu. The League name
  is not a link at that level; Overview inside the submenu is the only way to the
  landing page.
- `split`: the League name links to Overview, and a separate chevron button opens the
  submenu.
- `drill`: on narrow screens the second level replaces the first, with a back row at
  the top. On wide screens it is `tap-row`.

`year`:

- `alone`: the year alone, linking to the Campaign standings page. What #83 settled.
  The draft is reached by the cross link on the Campaign page (the loud pill in the
  stand-in).
- `trailing`: the year links to standings, a smaller `Draft` link on the end of the row.
- `two-rows`: a Standings row and an indented Draft row per year.

Keyboard, in every `touch` mode: Tab reaches the toggle, Enter/Space opens, Arrow
Down/Up moves between rows, Arrow Right opens a League's submenu, Arrow Left/Escape
closes back one level, Tab out closes.

## URLs worth comparing

Touch, wide (make the window wider than 992px):

```
/prototype/nav/?touch=tap-row&path=/league/movieboyz/2026/
/prototype/nav/?touch=split&path=/league/movieboyz/2026/
/prototype/nav/?touch=drill&path=/league/movieboyz/2026/
```

The same three narrowed under 992px (same URLs, resize the window). `drill` is the
only one that reads differently there.

Year row, at the five-year League:

```
/prototype/nav/?year=alone&path=/league/movieboyz/2026/
/prototype/nav/?year=trailing&path=/league/movieboyz/2026/
/prototype/nav/?year=two-rows&path=/league/movieboyz/2026/
```

Marking, on a Campaign page (open `Leagues`, then `MovieBoyz`, and watch the bar):

```
/prototype/nav/?mark=toggle&path=/league/movieboyz/2026/
/prototype/nav/?mark=rows-only&path=/league/movieboyz/2026/
```

Ten Leagues:

```
/prototype/nav/?manifest=ten&path=/league/final-cut/2026/
/prototype/nav/?manifest=ten&touch=drill&path=/league/final-cut/2026/
```

One League, which is what is published today:

```
/prototype/nav/?manifest=one&path=/league/movieboyz/2026/
```

## Observations, after building them

**Touch model.** `split` is the best of the three and the only one that does not lose
something. `tap-row` makes the League name unclickable at the level where the reader
most expects it to be clickable (the name is right there and does nothing but open a
panel), and the fix for that, Overview one level in, is a row the reader has to learn
about. `split` costs a 24px chevron and one extra tab stop and keeps both targets
where they read. Its real risk is thumb width on a phone, which this prototype cannot
answer from a desktop browser; if the chevron turns out to be too small to hit, that
is an argument for `drill` compact rather than for `tap-row`.

`drill` is worth having compact regardless of which mode wins wide, and it is not the
only one that works there. `tap-row` and `split` both collapse to a readable inline
accordion, because a phone-width panel has no room to the right and the second level
simply opens under the row. But the accordion gets tall fast: the `ten` manifest with
a five-year League open is a 20-row overlay that scrolls, and the row that opened it
scrolls out of sight with it. `drill` keeps the overlay at one screen at every
Manifest size. My reading is `split` wide and `drill` compact, which the prototype
does not currently combine. Worth deciding whether the compact reading is allowed to
differ from the wide one, because #165 deliberately made them the same view model.

**Year row.** `alone` holds up, and better here than it did on the flat bar #83 judged
it on. At two levels a year row already sits three clicks deep, and `trailing` puts a
second target in a row that is 2.7rem of year, a badge and then a small word, which
reads as noise at the width the panel wants to be. `two-rows` is the worst of the
three: five years becomes ten rows and the panel scrolls, and every second row is the
page almost nobody is going to. The cost of `alone` is real and visible in the
stand-in (the draft page is four clicks away, and the fourth click is a pill on the
Campaign page), but it is the only mode where a year row is one thing.

**Marking.** `rows-only` is a worse answer than it sounds. Nothing in the bar is
highlighted, so a reader on `/league/movieboyz/2026/` sees a bar identical to the one
on `/movies/`. To find out where they are they have to open a menu, which is exactly
the thing marking exists to avoid. `toggle` has the opposite flaw, that the
highlighted `Leagues` says "you are inside some League" without saying which, which is
weak but is not nothing. Neither is good, and the reason is structural rather than
cosmetic: #168 takes the League out of the bar, so the bar can no longer name it. If
the reader has to be able to see which League they are in without opening anything,
that wants a third answer this prototype does not render: the bar entry reading
`Leagues · MovieBoyz`, or the page title carrying it. Worth raising on the ticket
before picking between these two.

**Narrow bar.** The compact overlay carries the whole cascade without trouble, and it
is the reading where #168 clearly beats what is there today: the current compact menu
flattens every League and the reader's own League's years into one list, which at ten
Leagues is unreadable, while the cascade stays at one League's worth of rows. The
`ten` manifest is where the two-level shape earns itself; at `one` it plainly does
not, since the first level is a single row that exists only to be passed through. If
one League stays the normal case for a long time, the shape is being built for a
future that may not arrive. Worth pricing that against leaving #157's bar alone
until a second League is actually published.

**One unfaithfulness.** The real root page carries no bar (#81, #84). This draws one at
`?path=/` anyway, so the marking modes can be seen on a page inside no League.
