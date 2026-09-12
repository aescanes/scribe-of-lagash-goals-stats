# Changelog

All notable changes to this project are documented in this file. The format
is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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