# Writing-goal widget

Status: initial version landed, in two places — the right-sidebar
`GoalWidgetView` and the "Writing goal history" section of the main-area
`GoalsStatsTabView`, which share their calendar rendering and both read the
same history.

## Goal

Show whether today's writing is on pace, and how recent days have gone,
without opening a separate stats page — a quick glance in the sidebar, or a
fuller record (with per-day totals and click-through) in the main tab.

## Storage decision: a vault file, not plugin data

The history has to survive a plugin uninstall/reinstall and travel with the
vault through whatever the author already syncs it with (Obsidian Sync,
iCloud, Syncthing, Git, …). That rules out `saveData()`/`loadData()` — Obsidian
deletes a plugin's `.obsidian/plugins/<id>/` folder, `data.json` included, when
it's uninstalled — and rules out browser storage (IndexedDB), which never
leaves the device. A real vault file is the only option that satisfies both.

- **File**: `"(SL) Goals History.json"`, inside the story folder — or the
  vault root when no story folder is configured, or the configured one
  doesn't exist yet. Fixed name, not user-configurable: unlike the
  Visualization plugin's Lines/Outline files, nobody is meant to open or
  rename this one by hand.
- **Format**: plain JSON, not markdown — no fenced-code-block parsing needed,
  and `.json` isn't returned by `getMarkdownFiles()`, so it's automatically
  outside the counting/explorer-badge logic without needing the `(SL) ` rule.
- **Shape**: one entry per local calendar day, in both metrics regardless of
  which is active (so switching the words/characters setting later doesn't
  strand or misinterpret past history) — with two fields per day:
  ```json
  { "2026-09-10": {
      "total":   { "words": 43821, "characters": 231400 },
      "written": { "words": 340,   "characters": 1820 }
  } }
  ```
  `written` is what the ring/calendar show: the net change that day — the
  scope's total right now minus its total at the moment the day started —
  clamped at 0, live in both directions, same as any ordinary word-count
  tracker (deleting text lowers it same as any other edit). `total` is the
  scope's raw word/character count as of the last scan that day; it's internal
  bookkeeping, not shown anywhere — its only purpose is letting
  `GoalHistoryStore` recover today's start-of-day baseline (`total − written`)
  after a restart, without losing progress already made earlier that day.

  Two earlier, more elaborate designs were tried and dropped:
  1. A single running total per day, with "written" derived by diffing
     against the *previous day* at display time. Broken two ways: a first run
     against an existing manuscript credited the whole thing as "written
     today" (no prior day to diff against), and any same-day deletion
     elsewhere in the story erased credit for writing already done that day.
  2. Diffing every scan against the last scan and *accumulating* only the
     positive differences, so a later deletion couldn't reduce what was
     already credited. This fixed both problems above, but didn't match how
     every other writing-progress tool works — deleting text is expected to
     lower today's count, not leave it untouched — and real-world testing
     quickly confirmed that mismatch felt like a bug rather than a feature.

  The current design (a fixed start-of-day baseline, diffed live) is simpler
  than either: no accumulation, no need to reach for "the previous day"
  specifically, and it matches the standard mental model for this kind of
  tracker.
- **Known limitation**: if the story folder is moved or renamed, the history
  file doesn't follow — a new one starts empty at the new location. Not
  solved yet.

## Modules

- [`src/views/scopeScanner.ts`](../../src/views/scopeScanner.ts) — scans
  in-scope, non-excluded notes once per change and measures both metrics per
  file from a single `cachedRead`. Both the file-explorer badges and the goal
  history subscribe to this instead of each scanning the vault themselves.
  (`ExplorerDecorator` was refactored to consume it rather than scan on its
  own — see [explorer-word-counts-plan.md](explorer-word-counts-plan.md).)
- [`src/data/goalHistory.ts`](../../src/data/goalHistory.ts) — pure,
  unit-tested: `dateKey`, `parseHistory`/`serializeHistory` (tolerant of a
  hand-edited or partially-synced file — malformed day records are dropped,
  not fatal), `writtenFor` (a direct lookup), `writtenBetween` (sums `written`
  over an inclusive date range, for the week/month summary).
- [`src/data/calendarGrid.ts`](../../src/data/calendarGrid.ts) — pure,
  unit-tested: `monthGrid` (always 6 Sunday-first weeks, so the calendar's
  height doesn't jump between months), `dayStatus` (met / partial / none),
  `buildCalendar` (the grid enriched with each cell's status *and* its raw
  `written` amount, via a caller-supplied `writtenForDate`, so this module
  doesn't depend on `goalHistory`'s shape).
- [`src/views/calendarWidget.ts`](../../src/views/calendarWidget.ts) —
  `renderCalendarWidget`: the nav (prev/next + month title) and the day-cell
  grid, as one DOM-building function shared by `goalWidgetView.ts` and
  `goalsStatsTabView.ts` so both stay identical without duplicating it. Every
  day with data gets an `aria-label` tooltip (`formatCount(cell.written,
  metric, false)`, reusing the same formatting as the file-explorer badges)
  and, when the caller passes `onDayClick`, is clickable — a day with nothing
  written has neither, there's nothing to show.
- [`src/views/goalHistoryStore.ts`](../../src/views/goalHistoryStore.ts) —
  the vault-file I/O: resolves the file's path from the current story-folder
  setting, loads it (reloading if the resolved path changes, discarding its
  start-of-day baseline so the new file's day is re-established fresh),
  recomputes today's `written` from the scanner's latest total against that
  baseline on every scanner change plus a 5-minute poll (to catch the day
  rolling over during a long-running session with no edits), and writes with
  `Vault.process()`/`Vault.create()` — debounced, and skipped if the
  serialized content hasn't actually changed.
- [`src/views/goalWidgetView.ts`](../../src/views/goalWidgetView.ts) — the
  right-sidebar `ItemView`: three bordered cards (`.scribe-goal-card`), same
  background and border on all so they read as one family.
  1. Today's ring (progress clamped at 100%; a pale filled disc with a
     progress arc, becoming a full glowing ring and swapping its label to
     "Goal reached!" once the goal is hit — modelled on Keep the Rhythm's own
     goal card).
  2. A two-up summary — `writtenBetween` summed from the start of the week
     (Sunday, matching the calendar below) and the start of the month, through
     today, each inclusive.
  3. The month calendar, via `renderCalendarWidget` (no `onDayClick` here —
     that interaction lives only in the tab, see below).

  Pure display; `contentEl.empty()` + rebuild on every change rather than
  incremental DOM patching — the view is small enough that this stays simple.
- [`src/views/goalsStatsTabView.ts`](../../src/views/goalsStatsTabView.ts) —
  the main-area tab, its two top-level sections separated by an `<hr>`
  (`.scribe-stats-divider`). Each section heading carries its own icon
  (`.scribe-stats-section-icon`, via `setIcon`) — "Writing goal history" uses
  `GOAL_WIDGET_ICON` (the same one as the sidebar widget's ribbon/tab icon),
  "Story Stats" uses this view's own `GOALS_STATS_TAB_ICON_ID`. "Writing goal
  history" is two bordered cards side by side (`.scribe-goal-history-columns`,
  wrapping to stacked when the pane is too narrow for both), matching the
  sidebar widget's own card-per-thing styling:
  - **Left** — plain (no circle, no background) value+label stats via
    `.scribe-stat-plain`, grouped into rows (`.scribe-stat-row`, a thin
    `border-left` between adjacent stats in the same row) separated by
    `<hr class="scribe-stat-row-divider">` between rows, all in one card: This
    week / This month, then Last 7 days / Last 30 days. Each stat also carries
    a "(N per day)" average (`.scribe-stat-plain-average`, via
    `renderStatRow`) — "This week"/"This month" average over the days elapsed
    *so far* in that period, not its full length, so an in-progress week or
    month doesn't read as an artificially slow pace. Deliberately simpler than
    the ring/summary look and structured to grow — a future stat joins an
    existing row or starts a new one, nothing else about this needs to change.
  - **Right** — the same calendar as the sidebar widget via
    `renderCalendarWidget`, plus a side panel top-aligned beside it
    (`.scribe-goal-calendar-columns`/`.scribe-goal-calendar-side`): Today's
    total, always shown (`renderStatCell`, no average — a single day has
    nothing to average), and below it a reserved slot
    (`.scribe-goal-calendar-day-detail`) that stays empty unless a day *other
    than today* is clicked, in which case it shows that day's total in the
    same style. The slot is *always* present, so filling it in on a click
    never resizes the card or shifts "Story Stats" below it. Clicking today
    itself is a no-op beyond clearing any other day's detail (today's own
    total is already shown above); navigating months also clears the
    selection, so a stale selection from a different month is never shown.
    Both the calendar's nav+grid wrapper (`.scribe-goal-calendar-block`,
    11rem) and the side panel (`.scribe-goal-calendar-side`, 6.5rem) are
    pinned to a fixed width, and the card itself to `20.5rem`
    (`.scribe-goal-card.mod-calendar`) — without that, a longer month name's
    nav row, or a longer value landing in the reserved slot, could each
    independently widen the wrapper they're in, and the card along with it;
    the calendar title also gets `text-overflow: ellipsis` as a last-resort
    guard.

  "Story Stats" section:
  placeholder, not built yet.

## Colour

The ring's fill and the calendar cells use the plugin's brand accent, same as
the file-explorer badges and the ribbon icon, rather than a separate
green/yellow scheme just for this view. A day with nothing written stays
unfilled; a day that met the goal uses the stronger `--scribe-accent` (a
bolder mark for the bigger achievement); a day that fell short uses the
softer `--scribe-accent-soft`. "Today" is still marked with a ring outline
(`--interactive-accent`, an inset box-shadow all the way around the cell)
rather than a fill, so it never gets confused with a graded day even when
today is also met or partial — and a full ring rather than just an underline,
so it reads as a circle like the graded cells instead of a squared-off mark.

## Not done yet

- The sidebar widget's calendar still has no way to see a day's exact total —
  only the tab's calendar is clickable. Could be added the same way if wanted.
- No total/deadline goals yet, only the daily one.
- No handling for the story folder moving/renaming (see the limitation above).
- No migration from the single-running-total shape an earlier version wrote —
  `parseHistory` just drops those old-shape entries as malformed, same as any
  other corruption. Nothing shipped to real users before the shape changed, so
  this only affects hand-typed test data from before this revision.
