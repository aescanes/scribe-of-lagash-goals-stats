# Settings tab

Status: initial version landed.

## Goal

Give the writer one place to describe what they are writing toward and
which notes count. Everything the goals and stats features need starts from
these values.

## Settings — "General" section

| Setting | Type | Stored as | Notes |
| --- | --- | --- | --- |
| Story folder | text (with folder autocomplete) + "Set" button | `storyFolder: string` | Vault-relative folder holding one story's act/chapter/scene notes. Empty = scan the whole vault. Same wording and role as the Visualization plugin's setting. Not applied as you type, unlike every other setting: typing then clicking "Set" (or pressing Enter — `ScribeGoalsStatsSettingTab.renderStoryFolderField`) is what commits it, so a mid-edit blank field is never mistaken for "deliberately scan the whole vault". The field still type-ahead-suggests matching folders as you type (`FolderSuggest`, in its own file — a small `AbstractInputSuggest` over `Vault.getAllFolders()`), which the built-in declarative "folder" control this replaced provided for free; picking a suggestion only fills the field, same as typing it, so "Set"/Enter is still what applies it. A non-empty value that isn't an actual folder in the vault is rejected outright with a `Notice` — `applyStoryFolder` checks `getAbstractFileByPath()` before anything else, so a typo can't silently drop every note out of scope. Changing it to a genuinely different, already-in-use folder confirms first (`ConfirmModal`) and clears the today-text-baseline cache (`ScribeGoalsStatsPlugin.resetTodayTextBaseline`) — otherwise the new folder's *existing* content would look like it was all written today, since `GoalHistoryStore` has no start-of-day snapshot for files outside the previous scope. The previous folder's own history file is left untouched, ready to resume from if the author switches back to it. |
| Excluded notes and folders | textarea | `excludedPaths: string[]` | One vault-relative path per line. A folder entry excludes everything inside it; a note entry matches with or without `.md`. Applies to the writing goals now and to the stats later. |

Scribe-generated files and folders (the `(SL) ` prefix the series puts on its
own planning files) are **always** excluded and are not stored in
`excludedPaths` — that rule lives in [`src/data/exclusion.ts`](../../src/data/exclusion.ts).

## Settings — "Writing goals" section

| Setting | Type | Stored as | Notes |
| --- | --- | --- | --- |
| Metric | dropdown | `metric: "words" \| "characters"` | What every goal and statistic counts. |
| Count spaces in character counts | toggle | `charactersIncludeSpaces: boolean` | Only meaningful when Metric is Characters: include spaces/line breaks ("characters with spaces", matching Obsidian's own word count) or exclude them ("characters without spaces" — the default, and the plugin's only behavior before this setting existed). See [`src/data/textMetrics.ts`](../../src/data/textMetrics.ts) and [`src/data/goalHistory.ts`](../../src/data/goalHistory.ts)'s `charactersFor` for how this interacts with already-recorded history. |
| Daily writing goal | number | `dailyGoal: number` | Target for one writing day, in the chosen metric. Rounded, floored at 0. |
| Writing days | 7 checkboxes | `writingDays: boolean[]` (length 7) | Monday-first: index 0 = Monday … 6 = Sunday. Default all true. |

Below the picker, two read-only rows restate the derived targets and update live
as the daily goal, days, or metric change:

- **Weekly goal** = `dailyGoal × (checked days)`.
- **Monthly goal** = `dailyGoal × (writing days that fall in the current
  calendar month)`. Counting the real month rather than assuming ~4.33 weeks
  keeps the figure honest — a 31-day month that starts on a writing day has
  more writing days than a 28-day one.

## Modules

- [`src/data/goalMath.ts`](../../src/data/goalMath.ts) — pure, unit-tested:
  `WEEKDAYS`, `writingDaysPerWeek`, `weeklyGoal`, `writingDaysInMonth`,
  `monthlyGoal`.
- [`src/data/exclusion.ts`](../../src/data/exclusion.ts) — pure, unit-tested:
  `isExcluded(path, excludedPaths)` plus the always-on `(SL) ` rule
  (`SCRIBE_GENERATED_PREFIX`).
- [`src/settings/settings.ts`](../../src/settings/settings.ts) — the settings
  interface, defaults, and `normalizeSettings()` (re-validates persisted data).
- [`src/settings/settingsTab.ts`](../../src/settings/settingsTab.ts) — the tab.
  Imperative `display()` only; the computed rows are refreshed in place rather
  than by re-rendering, so text inputs keep focus.

## Not done yet

- The **Stats** section is a stub — one heading and a "coming later" line.
- Nothing consumes these settings yet (no index, view, or ribbon icon) —
  `isExcluded` is written and tested but not yet wired into a scan.
- Deadline / total-manuscript target, per-chapter or per-scene length goals.
