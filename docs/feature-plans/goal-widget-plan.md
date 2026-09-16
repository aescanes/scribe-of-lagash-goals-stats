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
  strand or misinterpret past history) — with these fields per day:
  ```json
  { "2026-09-10": {
      "written":   { "words": 340, "characters": 1820 },
      "dailyGoal": 500,
      "metric":    "words"
  } }
  ```
  `written` is what the ring/calendar show, and it's a real word-level diff
  (see `writtenAcrossFiles` and `src/data/textDiff.ts`) between every in-scope
  file's text right now and its own text at the moment the day started: only
  words genuinely new since then count. An old paragraph disappearing is
  invisible to it — those words were never part of the "inserted" set, in that
  file or any other — while deleting part of what was typed *today* correctly
  drops back out of it. The same distinction `git diff` draws between
  untouched, removed, and inserted lines, drawn at the word level instead.
  An earlier revision also stored a `total` field (the scope's raw
  word/character count as of the last scan) for recovering the day's baseline
  after a restart; once that recovery moved to the text-baseline cache below,
  `total` had nothing left reading it, so it was dropped rather than carried
  along as unused weight in a file meant to travel with the vault.

  `dailyGoal`/`metric` are the goal actually in effect *that day* — recorded
  once, alongside `written`, rather than read live from settings whenever the
  calendar renders. Fixes a real bug: previously the calendar judged every
  day — including ones from weeks ago — against *today's* live daily goal and
  metric, so raising or lowering the goal (or switching between words and
  characters) silently repainted every past day's colour to match, even ones
  recorded under a completely different goal. A day recorded before this was
  tracked has neither field; `resolveDayGoal` falls back to the live settings
  only for that one case (see [`src/data/goalHistory.ts`](../../src/data/goalHistory.ts)
  below), same graceful degradation as everywhere else a field was added
  after some history already existed.

  The day's *starting text* itself — one snapshot per in-scope file, needed
  live for the rest of that day — is **not** stored in this file. It lives in
  plugin data instead (`saveData()`/`loadData()`, under its own
  `todayTextBaseline` key alongside settings — see `TodayTextBaseline` in
  `goalHistoryStore.ts`), which the history file deliberately avoids for
  everything else (see below): duplicating the day's prose into a vault file
  that then gets synced right alongside the actual notes has no upside, and
  the snapshot is only ever needed for *today* — once a day is over, its
  `written` is frozen and the snapshot is worthless. Losing it (an
  uninstall/reinstall, a cleared plugin folder, a fresh device that hasn't
  synced `data.json`) just means the next scan re-establishes the baseline
  from wherever the scope's text stands right now, same as any brand-new day —
  the identical graceful-degradation the numeric version already relied on
  for the same restart case.

  Four earlier, progressively less naive designs were tried and dropped:
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
  3. A single start-of-day *word-count* baseline for the whole scope, diffed
     live. Matched the standard mental model for one file at a time, but broke
     with more than one note in play: deleting old text in one note quietly
     ate into new words typed in another, since only the scope-wide net (which
     can go negative before the floor-at-0 clamp applies) was ever compared.
  4. The same start/floor idea moved to a *per-file* word-count baseline —
     fixed the cross-file cancellation in (3), but a word count alone still
     couldn't tell "deleted an old paragraph in this file" from "deleted part
     of what was typed in this file today": both just lowered that one file's
     count. Since the whole point was to protect against exactly the first of
     those, a real text diff (the current design) was the only way to actually
     get there, not just narrow the blast radius of getting it wrong.
- **Known limitation**: if the story folder is moved or renamed, the history
  file doesn't follow — a new one starts empty at the new location. Not
  solved yet. Renaming a *note* (not the whole folder) looks the same way to
  the day's text baseline — the old path drops out (contributing nothing, same
  as a deletion) and the new path has no baseline text of its own, so the
  note's entire content counts as "written" under its new name for the rest of
  that day.
- **Known limitation**: the diff only runs when a file's combined
  baseline+current word count and its actual edit distance both stay under a
  size limit (`DIFF_WORD_LIMIT` / `MAX_EDIT_DISTANCE` in `textDiff.ts`) —
  Myers' algorithm's memory is proportional to both, and an unbounded worst
  case (a large note rewritten almost entirely) could otherwise spike to
  hundreds of megabytes, a real risk given this plugin also has to run on
  mobile. A file past either limit that day falls back to a plain floored
  word-count difference for just that one file (the same fallback design (4)
  above used everywhere), for the rest of that day.

## Modules

- [`src/views/scopeScanner.ts`](../../src/views/scopeScanner.ts) — scans
  in-scope, non-excluded notes once per change and measures both metrics per
  file from a single `cachedRead`, keeping each file's raw text alongside its
  counts (`getPerFileContent()`) so the goal history's word-level diff doesn't
  need a second read of its own. Both the file-explorer badges and the goal
  history subscribe to this instead of each scanning the vault themselves.
  (`ExplorerDecorator` was refactored to consume it rather than scan on its
  own — see [explorer-word-counts-plan.md](explorer-word-counts-plan.md).)
- [`src/data/textDiff.ts`](../../src/data/textDiff.ts) — pure, unit-tested:
  `insertedWords(baseline, current)`, a word-level diff (Myers' algorithm —
  the same one behind `diff`/`git diff`) returning just the words in `current`
  genuinely new since `baseline`. Diffs at word granularity, not character
  granularity, both because that's what "written" actually measures and
  because it keeps the token count — and so the cost — down. Returns `null`
  instead of running the diff past `DIFF_WORD_LIMIT` (combined word count) or
  `MAX_EDIT_DISTANCE` (how different the two texts actually are) — Myers'
  backtracking keeps one snapshot per edit-distance step, so both its time and
  memory are quadratic in the worst case (a note replaced almost entirely);
  these caps bound that to a momentary, garbage-collected spike rather than
  risking an out-of-memory crash, on mobile in particular.
- [`src/data/goalHistory.ts`](../../src/data/goalHistory.ts) — pure,
  unit-tested: `dateKey`, `parseHistory`/`serializeHistory` (tolerant of a
  hand-edited or partially-synced file — malformed day records are dropped,
  not fatal), `writtenAcrossFiles` (today's `written`, from every file's
  baseline text and current text via `insertedWords`, falling back to a plain
  floored word-count difference for a file `insertedWords` returned `null`
  for), `writtenFor` (a direct lookup), `writtenBetween` (sums `written` over
  an inclusive date range, for the week/month summary), `resolveDayGoal` (the
  written amount and daily goal to judge a specific day by, using that day's
  own recorded `dailyGoal`/`metric` — falling back to the live settings only
  for a day recorded before those were tracked; see the storage section above
  for the bug this fixes).
- [`src/data/calendarGrid.ts`](../../src/data/calendarGrid.ts) — pure,
  unit-tested: `monthGrid` (always 6 Sunday-first weeks, so the calendar's
  height doesn't jump between months), `dayStatus` (met / partial / none, from
  a written amount and a goal — a plain classifier the caller applies, not
  something this module fetches itself), `buildCalendar` (the grid enriched
  with each cell's status *and* its raw `written` amount, via two
  caller-supplied lookups, `writtenForDate` and `statusForDate` — a *separate*
  lookup for status rather than one `dailyGoal` applied to the whole grid, so
  the caller can judge each day against whatever goal actually applied to it;
  this module still doesn't depend on `goalHistory`'s shape, since it just
  calls back for both, never reading `goalHistory` itself).
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
  start-of-day text baseline so the new file's day is re-established fresh),
  recomputes today's `written` via `writtenAcrossFiles` from the scanner's
  latest per-file text against that baseline on every scanner change plus a
  5-minute poll (to catch the day rolling over during a long-running session
  with no edits), and writes with `Vault.process()`/`Vault.create()` —
  debounced, and skipped if the serialized content hasn't actually changed.
  The day's text baseline itself is read from/written to `TodayTextBaselineCache`
  (backed by plugin data, injected from `main.ts`), established once per day
  and recovered as-is after a restart rather than reconstructed. Only ever
  triggered from `scanner.onChange()` (plus the 5-minute poll), deliberately
  *not* also from `workspace.onLayoutReady()` directly — the scanner's own
  first `refresh()` always finishes and notifies this listener before that
  promise resolves, so triggering `recordToday()` a second, earlier way here
  could win the race and run against an empty, not-yet-scanned scope, wrongly
  treating "nothing exists yet" as today's baseline and then crediting the
  entire scope as "written today" the moment the real scan lands.
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
- [`src/views/goalCelebration.ts`](../../src/views/goalCelebration.ts) —
  announces the goal being reached even when the widget above isn't open: a
  `Notice` toast each time `dayStatus` (from `calendarGrid.ts`) newly turns
  "met" — tracked as a rising edge (`wasMet`, in memory), so dipping back
  under the goal (e.g. a same-day edit that deletes more than it adds) and
  crossing it again later fires a fresh toast rather than staying silent for
  the rest of the day — plus a status-bar item (desktop only — mobile has no
  status bar) that stays lit for as long as the goal currently reads "met".
  Both driven by `goalHistoryStore.onChange()`, so "reached" is always the
  same figure the ring and calendar already show, never computed a second
  way. A second flag, `hasRun`, keeps the very first `update()` call from
  counting as a rising edge on its own — it just records whatever `met`
  already is as `wasMet`'s starting point, silently; the toast should only
  ever follow an actual edit crossing the goal, not merely opening the app on
  an already-met day. Getting that first call to actually carry real data
  mattered more than it looks: `update()` is *only* ever triggered from
  `goalHistoryStore.onChange()`, never also called directly from `onload()`
  the way an earlier version of this file did — `GoalHistoryStore` hasn't
  necessarily recorded today's data yet at the moment `onload()` runs (its
  own first `recordToday()` is itself deferred to the scanner's first real
  scan completing), so calling `update()` synchronously there would read an
  empty history and set `hasRun`/`wasMet`'s baseline against "nothing written
  yet" — then the real first update, once actual data arrived, would find
  `hasRun` already `true` and fire the toast for a goal that was met before
  Obsidian even opened. The same class of race `GoalHistoryStore` itself
  already had to avoid (see its own `onload()`).
- [`src/views/goalsStatsTabView.ts`](../../src/views/goalsStatsTabView.ts) —
  the main-area tab, its two top-level sections separated by an `<hr>`
  (`.scribe-stats-divider`). Each section heading carries its own icon
  (`.scribe-stats-section-icon`, via `setIcon`) — "Writing goal history" uses
  `GOAL_WIDGET_ICON` (the same one as the sidebar widget's ribbon/tab icon),
  "Story Stats" uses this view's own `GOALS_STATS_TAB_ICON_ID`. "Writing goal
  history" is two bordered cards side by side (`.scribe-goal-history-columns`,
  wrapping to stacked when the pane is too narrow for both), matching the
  sidebar widget's own card-per-thing styling:
  - **Left** — the same calendar as the sidebar widget via
    `renderCalendarWidget`, plus a side panel top-aligned beside it
    (`.scribe-goal-calendar-columns`/`.scribe-goal-calendar-side`): Today's
    total, always shown (`renderStatCell`, no average — a single day has
    nothing to average), and below it a reserved slot that stays empty unless
    a day *other than today* is clicked, in which case it shows that day's
    total in the same style. Both sit in their own small rounded-corner box
    (`.scribe-goal-calendar-side-box`, one border/radius step down from the
    main card's own) rather than as bare text, and share a fixed
    `min-height` so the two boxes match whether or not a day is selected — a
    filled box and an empty one still read as a matching pair, and selecting
    or deselecting a day never resizes either box or shifts "Story Stats"
    below. Clicking today itself is a no-op beyond clearing any other day's
    detail (today's own total is already shown above); navigating months
    also clears the selection, so a stale selection from a different month
    is never shown.
    Both the calendar's nav+grid wrapper (`.scribe-goal-calendar-block`,
    11rem) and the side panel (`.scribe-goal-calendar-side`, 6.5rem) are
    pinned to a fixed width, and the card itself to `20.5rem`
    (`.scribe-goal-card.mod-calendar`) — without that, a longer month name's
    nav row, or a longer value landing in the reserved slot, could each
    independently widen the wrapper they're in, and the card along with it;
    the calendar title also gets `text-overflow: ellipsis` as a last-resort
    guard.
  - **Right** — plain (no circle, no background) value+label stats via
    `.scribe-stat-plain`, grouped into rows (`.scribe-stat-row`, a thin
    `border-left` between adjacent stats in the same row) separated by
    `<hr class="scribe-stat-row-divider">` between rows, all in one card: This
    week / This month / This year, then Last 7 days / Last 30 days / Last
    365 days. Each stat also carries a "(N per day)" average
    (`.scribe-stat-plain-average`, via `renderStatRow`) — "This
    week"/"This month"/"This year" average over the days elapsed *so far* in
    that period, not its full length, so an in-progress week, month, or year
    doesn't read as an artificially slow pace. Deliberately simpler than
    the ring/summary look and structured to grow — a future stat joins an
    existing row or starts a new one, nothing else about this needs to change.

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
so it reads as the same rounded-square shape as the graded cells instead of a
different mark. Cells are rounded squares (`--radius-s`), not circles — a
squarer shape than the sidebar/tab's other rounded elements, chosen simply
because it reads better at this size.

## Not done yet

- The sidebar widget's calendar still has no way to see a day's exact total —
  only the tab's calendar is clickable. Could be added the same way if wanted.
- No total/deadline goals yet, only the daily one.
- No handling for the story folder moving/renaming, or an individual note
  being renamed mid-day (see the limitations above).
- A note whose same-day changes exceed `DIFF_WORD_LIMIT`/`MAX_EDIT_DISTANCE`
  falls back to the older, plain floored word-count difference for that one
  file for the rest of the day — precise everywhere else, but that one file
  goes back to not being able to tell an old-text deletion from a new-text
  deletion until the next day starts (see the limitation above).
- No migration from either of the two earlier storage shapes (the single
  running-total version, or the brief per-file-numeric-baseline version) —
  `parseHistory` just drops those old-shape entries as malformed, same as any
  other corruption. Nothing shipped to real users before either shape changed,
  so this only affects hand-typed test data from before this revision.
