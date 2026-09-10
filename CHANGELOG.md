# Changelog

All notable changes to this project are documented in this file. The format
is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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