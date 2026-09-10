# Writing-goals settings

Status: initial version landed.

## Goal

Give the author one place to describe what they are writing toward. Everything
the goals and stats features need starts from these values.

## Settings — "Writing goals" section

| Setting | Type | Stored as | Notes |
| --- | --- | --- | --- |
| Story folder | text | `storyFolder: string` | Vault-relative folder holding one story's act/chapter/scene notes. Empty = scan the whole vault. Same wording and role as the Visualization plugin's setting. |
| Metric | dropdown | `metric: "words" \| "characters"` | What every goal and statistic counts. |
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
- [`src/settings/settings.ts`](../../src/settings/settings.ts) — the settings
  interface, defaults, and `normalizeSettings()` (re-validates persisted data).
- [`src/settings/settingsTab.ts`](../../src/settings/settingsTab.ts) — the tab.
  Imperative `display()` only; the computed rows are refreshed in place rather
  than by re-rendering, so text inputs keep focus.

## Not done yet

- The **Stats** section is a stub — one heading and a "coming later" line.
- Nothing consumes these settings yet (no index, view, or ribbon icon).
- Deadline / total-manuscript target, per-chapter or per-scene length goals.
