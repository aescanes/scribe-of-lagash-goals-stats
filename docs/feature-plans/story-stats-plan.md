# Story stats and note stats

Status: implemented.

## Goal

Fill in the empty "Story Stats" section of the Goals and Stats tab
([`goalsStatsTabView.ts`](../../src/views/goalsStatsTabView.ts)
`renderStoryStatsSection`) and add a per-note version of the same numbers:

1. **Story stats table** — one row per in-scope note, grouped by folder.
2. **Note stats popup** — a note-header icon (same icon as the Goals and Stats
   tab) that opens a centered modal with the active note's stats, one stat per
   little box.

## Stats

Same set in both places, so they come from one pure function.

| Stat | Definition |
|---|---|
| Size | Words, or characters when General → Metric is "characters" (honors "Count spaces in character counts"). Reuses `measure()` / `FileMetrics`. |
| Read time | `words / WORDS_PER_MINUTE` (245, a constant), rounded up to whole minutes (`< 1 min` below 30 s). Always word-based, even if the metric is characters. |
| Syllables | Heuristic vowel-group count per word (English-style), with silent-`e` and `-le`/`-es`/`-ed` adjustments; accented Spanish vowels are recognized, but a vowel run counts once, so Spanish hiatus ("poeta") undercounts by one. Approximate, and the UI says so in a tooltip. |
| Sentences | Runs ending in `.`, `!`, `?`, `…` followed by whitespace/end, ignoring abbreviations (`Mr.`, `Dr.`, `etc.`), decimals and ellipses inside dialogue. Markdown syntax stripped first. |
| Paragraphs | Blank-line-separated blocks of prose; headings, horizontal rules, and frontmatter don't count. |
| Pages | `words / WORDS_PER_PAGE`, rounded up to a whole page (250, a constant, the manuscript-page convention). |
| Status | See below. Table: a text pill; popup: one box. |

Prose is measured after `stripFrontmatter`. Beyond that, a `stripMarkdown`
step (headings markers, emphasis, link/wikilink syntax, code fences, comments)
runs for syllables/sentences/paragraphs only; word/character counts keep their
existing "markdown counts" behavior so numbers stay consistent with the
explorer badges and goal history.

## Status resolution

Per note, first match wins:

1. The Status column of the outline file that plans the note (see below).
2. The note's `scribe-note-status` frontmatter property (via
   `metadataCache.getFileCache(file)?.frontmatter`, key from
   `FRONTMATTER_KEYS.status` in `src/types.ts` — AGENTS.md forbids a string
   literal).
3. Otherwise empty (`—`).

**Outline file (done).** The Visualization plugin's Outline file is
`(SL) <name>.md` in the book folder, marked `scribe-visualization: outline` in
its frontmatter, with a Markdown table (`Act | Chapter | Scene | … | Status |
…`). A row names no note: it plans a position, and the note it means is the one
whose folders and file name carry the same numbers
(`Act I/Chapter 1/Scene 2.md`).

- **Discovery:** by the marker, in `(SL) `-prefixed files, so there is no
  setting to sync (and several books, one outline each, just work). The deepest
  outline folder containing a note wins.
- **Matching** (`src/data/outlineStatus.ts`, pure): a row's non-empty
  Act/Chapter/Scene cells and a note's path segments below the outline's folder
  must line up level by level, comparing leading numbers (digits or roman
  numerals) or, for a non-numeric Act, the text. Label words are ignored, so
  English, Spanish and other title languages all work. Exact structure only:
  unlike the Visualization plugin, there is no same-number fallback for a note
  in an unexpected folder.
- `No Status` or an empty cell means no status from the outline, so the note's
  property is used. When the outline has a status it wins over the property,
  the same precedence the Visualization plugin applies to every shared field.

## Architecture

Follows the repo split: pure logic in `src/data/` (unit-tested), Obsidian glue
in `src/views/`.

### Pure modules (`src/data/`)

- `src/types.ts` (new) — `FRONTMATTER_KEYS` (`status: "scribe-note-status"`) and
  the `NoteStats` type.
- `textStats.ts` — `stripMarkdown`, `countSyllables(word)`, `countSentences`,
  `countParagraphs`, `readMinutes(words, wpm)`, `pageCount(words, wpp)`, and
  `computeNoteStats(content, { metric, includeSpaces }): NoteStats`. Builds on `textMetrics.ts`; does not change
  `measureBoth`.
- `statsTable.ts` — `buildStatsRows(files, stats, statuses)` and
  `groupByFolder(rows, storyFolder)`: returns folders (sorted, nested depth via
  path) each with its notes (sorted by path/name) and a rolled-up subtotal row
  (sums for size/syllables/sentences/paragraphs/pages/read time; status
  summary like "3 draft · 2 done"). Reuses `folderTotals` ideas from
  `countTree.ts` where it fits.
- `outlineStatus.ts` — parser for the outline file's Status column (pending the
  open question above).
- `statusLabel.ts` — normalizes a raw status string for display and a CSS
  modifier (`draft`, `revising`, `done`, unknown → neutral).

### Obsidian glue (`src/views/`)

- **Do not widen `ScopeScanner.measureBoth` per keystroke.** The scanner already
  keeps `perFileContent`. A new `NoteStatsStore` (a `Component`, like
  `GoalHistoryStore`) subscribes to `scanner.onChange`, and computes full
  `NoteStats` lazily, caching by `path → {content, stats}` and recomputing only
  when the content string changed. Syllable counting therefore costs nothing
  for notes that didn't change, and the cheap live count path stays untouched.
  Exposes `getStats(path)`, `getAll()`, `onChange()`.
- `StatusResolver` (inside the store or beside it) — reads frontmatter via
  `metadataCache`, re-resolves on `metadataCache.on("changed")` / `"resolved"`
  and when the outline file is modified. Never writes to any note.
- `storyStatsTable.ts` — `renderStoryStatsTable(containerEl, rows, opts)`:
  DOM only, called from `renderStoryStatsSection`. Columns: Note · Words|Chars ·
  Read time · Syllables · Sentences · Paragraphs · Pages · Status. Folder rows
  are collapsible headers (chevron, collapse state kept in view memory) with
  the subtotal on the same line; a final "Total" row. Header label follows the
  metric. Numeric cells right-aligned, `formatCount`-style locale grouping.
  Clicking a note name opens it (`workspace.getLeaf(false).openFile`). Optional
  later: click a column header to sort within each folder.
- `noteStatsModal.ts` — `NoteStatsModal extends Modal`: centered by default
  (Obsidian modals are). Layout (from the design mockups, light and dark):
  a "Note stats" eyebrow level with the close button; the note's title with
  its status pill (tinted, with a dot, in the status's color) beside it; the
  headline count (words, or characters) in large type; a divided strip of read
  time (?), pages (?), sentences, paragraphs and syllables; and a footer of
  ratios (`noteRatios`: words per sentence, sentences per paragraph, syllables
  per word). Optional `target`: when a note has a length goal, a "93% of
  5,000 / 330 to go" block and a progress bar (`goalProgress`) are added under
  the headline — no goal exists yet, so it is never passed. Colors are all
  Obsidian variables plus `--scribe-accent` (which has a dark-theme value), so
  it follows the theme. Reads from `NoteStatsStore`; re-renders while open if
  the store changes (live typing), unregistered on close.
- `noteStatsStatusBar.ts` — `NoteStatsStatusBar extends Component`: a second
  `addStatusBarItem()` (separate from the goal-reached item in
  `goalCelebration.ts`) showing the `GOALS_STATS_TAB_ICON_ID` icon via
  `setIcon`. Visible only when the active leaf is a markdown note that is
  in scope and not excluded; updated on `active-leaf-change`. Click opens
  `NoteStatsModal` for the active file. `aria-label` "Note stats". Desktop
  only (mobile has no status bar) — also add a command, `Show note stats`
  (`checkCallback`, no default hotkey), so mobile and keyboard users have a way
  in.

### Wiring (`main.ts`)

Create `NoteStatsStore` after `scanner`; add `NoteStatsStatusBar` as a child;
register the command; pass the store to `GoalsStatsTabView` via `plugin`. The
tab view subscribes to `noteStatsStore.onChange` (alongside the existing
`goalHistoryStore.onChange`) and re-renders. Re-rendering the whole tab on each
keystroke-driven change is wasteful for a large table, so the store's
notification is debounced (~300 ms) and the table only re-renders when the tab
is visible.

### Reading constants

No settings: `WORDS_PER_MINUTE` (245) and `WORDS_PER_PAGE` (250) are constants
in `textStats.ts`. A (?) icon (`helpIcon.ts`) beside "Read time" and "Pages", in
both the table header and the note popup, states them in a tooltip
(`READ_TIME_HELP` / `PAGES_HELP` in `statsFormat.ts`).

### Styles (`styles.css`)

`.scribe-stats-table*`, `.scribe-note-stat-grid`, `.scribe-note-stat-box`,
`.scribe-status-pill` (+ `mod-draft` / `mod-done` etc.), the status-bar icon.
Obsidian CSS variables and `--scribe-accent*` only; no new raw hex, no inline
styles, no color set from JS. Table wrapper scrolls horizontally on narrow
widths. Run `npm run lint:css`.

## Edge cases

- Empty story folder → whole vault (existing rule); `(SL) ` files and excluded
  paths never appear (reuse `isExcluded`).
- Empty note: all zeros, read time `—`, no division by zero.
- Notes in the story-folder root go in a "(root)" group at the top.
- Unknown / free-text status shows as-is with the neutral pill.
- Frontmatter status can be a list or non-string — coerce the first string,
  else empty.
- Note deleted/renamed while the modal is open → close the modal.
- Very large vault: first compute of syllables happens lazily in chunks
  (`requestIdleCallback`-style via `window.setTimeout` batches) so opening the
  tab doesn't freeze; rows show `…` until computed.

## Tests (`tests/data/`)

- `textStats.test.ts` — syllable cases (single, silent e, `-le`, `-ed`,
  diphthongs, empty), sentence splitting (abbreviations, ellipses, dialogue,
  decimals), paragraphs (headings/rules/frontmatter ignored), read time and
  page rounding, empty input, markdown stripping.
- `statsTable.test.ts` — grouping, nested folders, subtotal math, root group,
  sorting.
- `outlineStatus.test.ts` — once the format is known.
- `statusLabel.test.ts` — normalization.

## Docs to update

README (Story stats section, the note-header icon), CHANGELOG
"Unreleased", AGENTS.md architecture list (new files, `src/types.ts` now
exists), and this plan's status line.

## Build order

1. `types.ts`, `textStats.ts` + tests.
2. `statsTable.ts`, `statusLabel.ts` + tests.
3. `NoteStatsStore`.
4. Story stats table in the tab (property-based status only).
5. Modal + status-bar icon + command.
6. Outline-file status (after reading the Visualization plugin's format).
7. Styles, lint/validate, docs.

## Not in scope

Editing status from this plugin (it never writes to notes), repeated-words and
other analyses (planned separately), exporting the table.
