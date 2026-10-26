# Import stats from other plugins

Status: implemented.

## Goal

Let a writer who already tracked their writing in another plugin bring that
history into `(SL) Goals History.json`, so the calendar, streaks and
week/month totals cover the days before they installed this plugin. The first
(and, for now, only) source is **Keep the Rhythm**.

The imported numbers should match what the source plugin itself shows for
each day, so each source's counting logic is mirrored in its own file.

## Settings — "Import stats" section

A new section in the settings tab (after "Writing goals", before the series
links), mirrored in the declarative `getSettingDefinitions()` list.

| Control | Notes |
| --- | --- |
| Source | Dropdown of supported plugins. Only "Keep the Rhythm" today; the list comes from the `IMPORT_SOURCES` registry so adding a source is one new file plus one registry entry. |
| File | "Choose file…" button that opens the OS file picker (`<input type="file" accept=".json">`, desktop and mobile) and shows the chosen file's name. The file is read with `File.text()`; it is never copied into the vault. |
| Import | Button, disabled until a file is chosen. Parses, previews, then asks `confirm()` ("N days will be added, M skipped because they already have data", plus the estimated-characters note below) before writing. After writing, a `Notice` reports the same counts. |

No new persisted setting: the chosen file is transient UI state.

## Merge rules

Applied per day, by `YYYY-MM-DD` key:

1. **Never overwrite real data.** If the history already has an entry for that
   date with anything written, the imported day is skipped. A missing day, or
   one whose entry is all zeros, takes the imported data — **today included**.
   Because the live count rewrites today's entry on every scan, today's
   imported share is kept in the today-baseline cache (`TodayTextBaseline.imported`)
   and added on top of the live diff, so it survives rescans and restarts.
   A story folder with no `(SL) Goals History.json` yet gets the file created
   by the import; the file always lives in the story folder (or the vault root
   when none is set), exactly where `GoalHistoryStore` records.
2. **Characters.** Sources usually give one character count. See
   "Characters" below: the real value goes into the field matching the
   source's convention and the other field is estimated, so both split fields
   are always present (`parseHistory` rejects a half-written split).
3. **Goal and metric are ours.** Each imported day gets the *current*
   `dailyGoal` and `metric` from settings, not the source's goal, so the
   calendar colors the imported days against the goal the writer has now.
   (Recorded into the day like any other, so later settings changes don't
   repaint them — see `DayRecord`.)

## Characters

A source can declare `charactersConvention`:
`"withSpaces" | "withoutSpaces" | "unknown"`. For a source that gives a single
character count:

- **Known convention:** the real value is stored in the matching field
  (`charactersWithSpaces` or `charactersWithoutSpaces`). The other field is
  *estimated*: `round(value × ratio)` going to without-spaces, or
  `round(value ÷ ratio)` going to with-spaces, where `ratio` is
  without-spaces ÷ with-spaces.
- **`ratio`** is computed from the writer's own existing history — total
  without-spaces ÷ total with-spaces over days that have both counts and
  words written — once at least 5 such days exist; otherwise the constant
  `DEFAULT_SPACES_RATIO` (0.85, typical for prose; in the sample history
  863 ÷ 1004 ≈ 0.86).
- **`"unknown"`:** the same number goes into both fields (no basis to
  estimate).
- A source that provides both counts uses them as-is; nothing is estimated.
- The confirm dialog and the final `Notice` say which field was estimated,
  because only the matching field is exact. In practice the calendar and
  totals read just the field for the current "Count spaces in character
  counts" setting, so an estimate only surfaces if that toggle is flipped.

## Keep the Rhythm (from `backup-2026-10-24-0.2.json` and its `main.js`)

```
{ schema: "0.2", settings: {…, dailyWritingGoal, preferredUnit},
  stats: { dailyActivity: [ { date, filePath, wordCountStart, charCountStart,
                              changes: [ { timeKey, w, c } ], id } ] } }
```

What the plugin's code does, which the importer mirrors:

- `dailyActivity` is **one row per (date, file)**, so several rows share a
  `date` and must be aggregated.
- **A day's total is the net sum of every row's `changes`** (`w` for words,
  `c` for characters), ignoring `wordCountStart`/`charCountStart` — KTR's
  own `On(entry, unit, skipStart = true)` does exactly this for its heatmap
  and day totals. Deletions are negative and *do* subtract; deleting a file
  adds a negative entry unless "Ignore deleted files" is on.
- **Characters are with spaces:** `charCountStart` is the raw
  `text.length` of the note (spaces, line breaks and frontmatter included),
  so `c` is KTR's "characters with spaces" and the source declares
  `charactersConvention = "withSpaces"`. (Its word count uses its own
  language-aware counter, so words can differ slightly from this plugin's —
  we import KTR's numbers as recorded.)
- Because KTR's net can be negative for a day (heavy deleting — 2026-10-23 in
  the sample nets about −90 words), the imported total is **floored at 0**:
  this plugin's history has no negative days. A day that nets to 0 in both
  units is not imported at all (no data to add).
- Reject a file whose `schema` isn't a known version (`0.2` today) or that has
  no `stats.dailyActivity` array, with a `Notice` — nothing is written.

## Implementation

Architecture rule: each source's logic lives in **its own file**; everything
else is shared and source-agnostic.

**Pure, unit-tested (`src/data/`, no Obsidian imports):**

- `importSources/importSource.ts` — the reusable parent:
  - `ImportedDay { date; words; charactersWithSpaces?; charactersWithoutSpaces? }`
    — the source-neutral shape.
  - `abstract class ImportSource { id; label; charactersConvention }` with a
    template method `parse(raw: string): ImportResult` that does the shared
    steps — `JSON.parse` with a friendly error, calls the subclass hooks,
    drops invalid dates (`/^\d{4}-\d{2}-\d{2}$/`), clamps negatives to 0,
    skips all-zero days, rounds, and sorts by date. Subclasses implement only
    `validate(json): string | null` (the schema check) and
    `extractDays(json): RawDay[]` (their own counting logic, e.g. KTR's
    net-of-changes), plus the `charactersConvention`.
  - `ImportResult = { days: ImportedDay[] } | { error: string }`.
- `importSources/keepTheRhythm.ts` — `KeepTheRhythmSource extends ImportSource`.
- `importSources/index.ts` — `IMPORT_SOURCES` registry (`id → source`).
- `importStats.ts` — shared, source-agnostic:
  - `estimateSpacesRatio(history): number`.
  - `resolveCharacters(day, convention, ratio)` — fills in the missing field
    and reports which one was estimated.
  - `mergeImportedDays(history, days, { dailyGoal, metric }): { history; added: string[]; skipped: string[]; estimated: "charactersWithSpaces" | "charactersWithoutSpaces" | null }`
    — applies the merge rules; returns a new `GoalHistory` (no mutation).

**Obsidian-facing:**

- `GoalHistoryStore.importDays(days, convention)` — `ensureLoaded()`, runs
  `mergeImportedDays` against the in-memory history with the live config,
  notifies listeners (calendar/widgets refresh), and `save()`s. Going through
  the store (not writing the file directly) avoids racing its debounced
  writes and the `lastSavedContent` check. Note `save()` only creates the file
  once `hasWrittenAnything` is true — an import of real data satisfies that.
  A preview variant (`previewImport`) runs the same merge without committing,
  for the confirm dialog's counts.
- `settingsTab.ts` — `renderImportStats()` (imperative) plus its definition
  entries; the file picker lives in a small helper so the tab stays readable.

## Tests

`tests/data/importStats.test.ts` (shared) and
`tests/data/importSources/keepTheRhythm.test.ts` (source-specific):

- KTR: aggregates several files on one date; net sum of `changes` ignoring
  the `*Start` fields; empty `changes`; a net-negative day floors at 0 and an
  all-zero day is dropped; characters come from `c` with convention
  `withSpaces`.
- KTR: malformed JSON, wrong schema, missing `dailyActivity` → error, no
  changes; invalid date strings ignored.
- Shared: `estimateSpacesRatio` uses history when ≥ 5 qualifying days, else
  the default; `resolveCharacters` fills the missing field both directions and
  copies the same number for `"unknown"`.
- Merge: existing non-zero date skipped; existing all-zero date replaced; new
  date added; today filled only when empty; imported day carries current `dailyGoal`/`metric`.
- Round trip: `serializeHistory` → `parseHistory` keeps imported days (guards
  the half-written-split rule).
- Base class: a tiny fake subclass proves the shared template steps (sorting,
  clamping, date filtering) apply to any source.

## Docs

README "Import stats" section, CHANGELOG entry, and AGENTS.md architecture
bullets for `importStats.ts`, `importSources/`, and the
`GoalHistoryStore.importDays` method.

## Out of scope

Other sources (the registry makes them cheap later), importing per-note or
per-time-of-day data, undoing an import (the confirm dialog is the safeguard;
the history file is a normal vault file, so sync/version history covers
recovery), and importing KTR's own goal/streak settings.
