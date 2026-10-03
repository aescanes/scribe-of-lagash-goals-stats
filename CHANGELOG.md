# Changelog

All notable changes to this project are documented in this file. The format
is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.8.1](https://github.com/aescanes/scribe-of-lagash-goals-stats/releases/tag/0.8.1) - 2026-10-03

### Changed
- Update part of the README documentation to improve clarity and readability on the 
  Obsidian community page.

## [0.8.0](https://github.com/aescanes/scribe-of-lagash-goals-stats/releases/tag/0.8.0) - 2026-09-26

### Added

- "Count spaces in character counts" setting: character counts (file-explorer
  badges, the daily goal, and the goal history) can now include spaces and
  line breaks, matching Obsidian's own word-count status bar, instead of
  always excluding them like before. Existing writing-goal history is
  unaffected — days recorded before this setting shipped keep their original
  count either way, and every day from now on records both conventions so
  switching the setting later never changes how past days read. The daily
  goal and goal history measure "today's" characters-with-spaces from the
  real text actually typed (preserving double spaces, blank lines between new
  paragraphs, and so on), so it agrees with the file-explorer badge's count of
  the same note rather than reading a little low.
- Changing the story folder to a different, already-in-use folder now asks
  for confirmation before applying: switching mid-day otherwise had no way to
  know where that folder's files stood at the start of the day, so their
  entire existing content would be counted as written today. Accepting starts
  today's count over at zero for the new folder; the previous folder's own
  history file is left exactly as it was, ready to resume from later.
- Setting the story folder to a path that isn't an actual folder in the vault
  is now rejected with a notice, instead of being silently accepted and
  taking every note in the vault out of scope until the typo was noticed.
- The story folder field now suggests matching folders as you type on every
  supported Obsidian version (1.10.0+), not just 1.13+.

### Changed

- The story folder setting is no longer applied on every keystroke like every
  other setting — type the path, then click "Set" (or press Enter) to apply
  it. Applying it live meant that briefly clearing the field to type a
  different path was indistinguishable from deliberately emptying it (which
  scans the whole vault), so doing that could rescan everything and create a
  stray goals-history file at the vault root before the new path was even
  finished being typed.

### Fixed

- "(SL) Goals History.json" no longer gets created immediately on installing
  the plugin, before a story folder is even chosen or a single character is
  written. A day with nothing written is indistinguishable from having no
  entry at all, so the file is now only created once there's an actual first
  character to record.

## [0.7.5](https://github.com/aescanes/scribe-of-lagash-goals-stats/releases/tag/0.7.5) - 2026-09-24

### Added
- README **Installation** section: the minimum Obsidian version requirement,
  a link to the community plugins
  page, and a link to the latest release for manually copying `main.js`,
  `manifest.json`, and `styles.css` into the vault's plugins folder.
- README **About the name** section explaining "Scribe of Lagash" — "Scribe"
  for the writer at the center of every plugin in the series, "Lagash" for
  *Nippur de Lagash*, the classic Argentine comic.

### Changed

- All README screenshots and icons now link to `raw.githubusercontent.com`
  instead of relative repo paths, matching the writing-session screenshot,
  so they render correctly wherever the README is displayed off GitHub (e.g.
  the Obsidian community plugins list).

## [0.7.4](https://github.com/aescanes/scribe-of-lagash-goals-stats/releases/tag/0.7.4) - 2026-09-22

### Added

- Screenshots for the writing-goal widget, Goals and Stats tab, writing
  session, and file-explorer counts in the README's "Current features"
  section.

### Changed

- Simplified the "Scribe of Lagash Plugins" section links in the README back
  to plain markdown links, after finding that GitHub strips the `target`
  attribute from raw HTML in READMEs regardless — so a plugin/repository link
  there can never open in a new tab, no matter how it's marked up.

## [0.7.3](https://github.com/aescanes/scribe-of-lagash-goals-stats/releases/tag/0.7.3) - 2026-09-22

### Changed

- Now accross all repository we use `Goals and Stats` instead `Goals & Stats` to match `name` in `manifest`.

## [0.7.2](https://github.com/aescanes/scribe-of-lagash-goals-stats/releases/tag/0.7.2) - 2026-09-19

### Changed

- Change `name` on `manifest.json` file to follow Obsidian rules.

## [0.7.1](https://github.com/aescanes/scribe-of-lagash-goals-stats/releases/tag/0.7.1) - 2026-09-19

### Added

- `styles.css` is now linted with stylelint (`stylelint-config-obsidianmd`),
  alongside the existing ESLint check, in `npm run validate` and CI.

### Changed

- The writing-goal widget's ribbon/tab icon now has a thicker stroke, matching
  the Goals and Stats tab's chart icon.
- CI/release workflows: `actions/checkout` and `actions/setup-node` bumped
  from v4 to v6, and `setup-node` now caches npm's download cache
  (keyed on `package-lock.json`) for faster installs.

## [0.7.0](https://github.com/aescanes/scribe-of-lagash-goals-stats/releases/tag/0.7.0) - 2026-09-19

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
- A few ribbon/command labels and the Goals and Stats tab title are now
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

- The Goals and Stats tab's "Writing goal history" totals now also show This
  year and Last 365 days, next to the existing This month and Last 30 days,
  each with its own daily average.
- Reaching the daily goal now shows a toast notification and lights up a
  status-bar item, so it's visible even when the writing-goal widget isn't
  open. The toast fires again each time the goal is freshly reached — dip
  back under it and cross it again later the same day, and it celebrates
  that too — but only for a crossing that happens while Obsidian is open and
  you're writing, not for reopening Obsidian on a day the goal was already met.

### Changed

- Calendar day cells (sidebar widget and Goals and Stats tab alike) are now
  rounded squares instead of circles.
- The Goals and Stats tab's calendar card: Today's total and the clicked-day
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
  repaints past days' calendar colors to match. Each day's own goal and
  metric are now recorded alongside its `written` total and judged against
  those, not against today's live settings — previously the calendar
  compared *every* day, including weeks-old ones, to whatever the goal
  happens to be set to right now.

## [0.4.0](https://github.com/aescanes/scribe-of-lagash-goals-stats/releases/tag/0.4.0) - 2026-09-16

### Changed

- Reworked the "Writing goal history" section of the Goals and Stats tab into
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

- Main-area "Goals and Stats" tab (ribbon icon or the "Open Goals and Stats"
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
  calendar further down colors each day by whether it met, partly met, or
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