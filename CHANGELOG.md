# Changelog

All notable changes to this project are documented in this file. The format
is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Reaching the daily goal now also triggers a brief confetti burst across the
  window, alongside the existing toast notification and status-bar item.
- Settings now appear in Obsidian's built-in settings search (1.13.0 or
  later) — a "Scope" heading now sits above Story folder and Excluded notes
  and folders, and on 1.13+ the Story folder field is a folder picker with
  vault suggestions instead of plain text. Older versions keep working exactly
  as before.

### Changed

- Word and character counts now update live while typing in the active note,
  instead of lagging about a second behind until Obsidian saves the file to
  disk.
- A few ribbon/command labels and the Goals & Stats tab title are now
  lowercase after the "(SL)"/"G & S" prefix, matching Obsidian's sentence-case
  convention for UI text.

### Fixed

- Character counts no longer include the spaces and line breaks between
  words — "hello world" now counts as 10 characters, not 11.
- The daily-goal confetti burst now animates correctly in a popped-out
  window (it was using `document.createElement` and the bare
  `requestAnimationFrame`, which don't follow Obsidian into a separate
  window).

## [0.6.0](https://github.com/aescanes/scribe-of-lagash-goals-stats/releases/tag/0.6.0) - 2026-09-17

### Added

- Writing session: a plain countdown timer in the writing-goal widget, below
  the daily-goal ring/summary/calendar — 15-, 30-, or 60-minute presets, or a
  custom length, with the same ring styling as the daily-goal progress ring
  (filling as time elapses instead of as words accumulate), a toast
  notification plus a short bell sound once time's up, a reset button, and a
  single play/pause button that doubles as "start": typing a custom length
  and pressing it always begins that
  length fresh, no matter what the timer was already doing, and typing one
  while a session is running pauses it immediately. Deliberately unrelated to
  the daily goal or any particular calendar day — nothing about it is
  recorded in the goal history. A session in progress does survive closing
  Obsidian, restored as paused (never running — there's no accounting for
  real time passed while closed) so a click resumes it exactly where it was
  left. Keeps running if the sidebar is closed and reopened mid-session,
  since it lives at the plugin level rather than inside the widget itself.

## [0.5.0](https://github.com/aescanes/scribe-of-lagash-goals-stats/releases/tag/0.5.0) - 2026-09-16

### Added

- The Goals & Stats tab's "Writing goal history" totals now also show This
  year and Last 365 days, next to the existing This month and Last 30 days,
  each with its own daily average.
- Reaching the daily goal now shows a toast notification and lights up a
  status-bar item, so it's visible even when the writing-goal widget isn't
  open. The toast fires again each time the goal is freshly reached — dip
  back under it and cross it again later the same day, and it celebrates
  that too — but only for a crossing that happens while Obsidian is open and
  you're writing, not for reopening Obsidian on a day the goal was already met.

### Changed

- Calendar day cells (sidebar widget and Goals & Stats tab alike) are now
  rounded squares instead of circles.
- The Goals & Stats tab's calendar card: Today's total and the clicked-day
  total each sit in their own small rounded-corner box instead of as plain
  text with a divider between them; the clicked-day box stays invisible
  (rather than showing an empty outline) until a day other than today is
  clicked, though its space is still reserved so nothing shifts when it
  appears.

### Fixed

- A divider line between two rows of stats (`.scribe-stat-row-divider`) was
  rendering at zero width and never actually showing, in every card that uses
  it — its flex container centers children by their own content width, which
  collapsed an empty `<hr>` down to nothing.
- Changing the daily goal (or the words/characters metric) no longer
  repaints past days' calendar colours to match. Each day's own goal and
  metric are now recorded alongside its `written` total and judged against
  those, not against today's live settings — previously the calendar
  compared *every* day, including weeks-old ones, to whatever the goal
  happens to be set to right now.

## [0.4.0](https://github.com/aescanes/scribe-of-lagash-goals-stats/releases/tag/0.4.0) - 2026-09-16

### Changed

- Reworked the "Writing goal history" section of the Goals & Stats tab into
  two side-by-side cards:
  - Left: This week / This month, then Last 7 days / Last 30 days, each as a
    plain value-over-label pair with a "(N per day)" average below it.
  - Right: the month calendar, with a side panel beside it (top-aligned) that
    always shows Today's total, plus — when a day other than today is
    clicked — that day's total in a slot reserved below it, so showing or
    hiding it never resizes the card or shifts "Story Stats" below.
- "Written today" (and the history built from it) is now a real word-level
  diff between each file's text right now and its own text at the moment the
  day started, instead of a plain word-count comparison: deleting old,
  already-existing text — anywhere, even elsewhere in the same note — never
  counts against today, while deleting part of what was typed *today* still
  correctly lowers it. The day's starting text is cached in plugin data so it
  survives an Obsidian restart mid-day; a note whose same-day changes are
  unusually large or extensive falls back to the previous word-count-based
  measure for just that one file, for the rest of that day.
- The goal-history JSON no longer stores each day's raw `total` word/character
  count alongside `written` — it was only ever used internally to recover the
  day's starting point after a restart, a job the new text-baseline cache now
  does directly, so it had nothing left reading it.

## [0.3.0](https://github.com/aescanes/scribe-of-lagash-goals-stats/releases/tag/0.3.0) - 2026-09-12

### Added

- Main-area "Goals & Stats" tab (ribbon icon or the "Open Goals & Stats"
  command). Opens as a tab (like the Visualization plugin's StoryLines) rather
  than a sidebar, since this is meant to be worked in rather than glanced at.
  Two sections:
  - **Writing goal history** — today/week/month totals as plain circles (no
    progress arc, unlike the right-sidebar ring — this is a record, not a
    goal being tracked live), and the same month calendar as the right-sidebar
    widget, plus clicking any day with data to see that day's total.
  - **Story Stats** — a placeholder; not built yet.

## [0.2.0](https://github.com/aescanes/scribe-of-lagash-goals-stats/releases/tag/0.2.0) - 2026-09-11

### Added

- Writing-goal widget: open it from the ribbon icon or the "Open writing goal
  widget" command. A ring shows today's progress toward the daily goal, a
  summary card below it totals the current week and month, and a month
  calendar further down colours each day by whether it met, partly met, or
  missed the goal (navigate with the arrows either side of the month name).
  Progress is tracked in `"(SL) Goals History.json"`, a plugin-managed file
  inside the story folder (or the vault root, when none is set) — a real vault
  file, so history survives a plugin uninstall/reinstall and travels with the
  vault through whatever the author already syncs it with. Each day's "amount
  written" is live in both directions against a start-of-day baseline, so
  deleting text lowers it same as any other writing-progress tracker.

### Changed

- File-explorer counts now show a small leading icon marking the row type — a
  document icon for a note's own count, a folder icon for a folder's rolled-up
  total — instead of a word/character metric icon.

## [0.1.2](https://github.com/aescanes/scribe-of-lagash-goals-stats/releases/tag/0.1.2) - 2026-09-11

### Changed
- Skip artifact attestations until the repo is public.

## [0.1.1](https://github.com/aescanes/scribe-of-lagash-goals-stats/releases/tag/0.1.1) - 2026-09-11

### Added
- Include package-lock.json to the project

## [0.1.0](https://github.com/aescanes/scribe-of-lagash-goals-stats/releases/tag/0.1.0) - 2026-09-11

### Added

- Word/character counts in the file explorer. Every note inside the story
  folder shows its own count next to its name; every folder shows the total of
  the notes beneath it. The unit follows the words/characters metric, excluded
  and `(SL) ` paths are skipped, and the counts update as you write. With no
  story folder set, the whole vault is counted.
- Settings tab. A **General** section holds the story folder and a list of
  notes and folders to exclude from goals and stats (one path per line; a
  folder excludes everything inside it). Anything the Scribe of Lagash plugins
  generate — the `(SL) ` prefix — is always excluded.
- **Writing goals** section: words/characters metric, a daily writing goal, and
  a Monday-first writing-days picker. The weekly and monthly goals are
  calculated from those and shown below the picker (the monthly figure counts
  the writing days that actually fall in the current calendar month). A
  placeholder **Stats** section is stubbed for later work.