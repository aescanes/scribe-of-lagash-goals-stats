# AGENTS.md

Guidance for AI agents working on this repository. Read this before making changes.

## Concept

**Scribe of Lagash - Goals & Stats** is an Obsidian plugin that helps writers
set writing goals and see detailed statistics for those goals and for the story
as a whole (word counts, progress toward goals, repeated words, and more). It is
the second plugin in the **"Scribe of Lagash"** series — a set of independent,
single-concern Obsidian plugins for planning and writing stories. The series
shares one per-note frontmatter vocabulary, `scribe-note-*` (date, characters,
places, status, …), so a note's metadata means the same thing to every plugin
and is written once; this plugin's key list is centralized in
[`src/types.ts`](src/types.ts).

Rules:

- The plugin **never edits chapter/scene notes** — body or frontmatter. It only
  *reads* prose to measure it, and stores its own goal/stat data separately
  (plugin data, or its own files).

## Architecture

> The implementation is being built fresh. This project reuses the **structure
> and conventions** of the first series plugin (Scribe of Lagash -
> Visualization) — the same build/test/release tooling, the shared
> `scribe-note-*` frontmatter, and the title / story-folder recognition approach —
> but is **not bound** to its module layout where a different shape fits a
> goals-and-stats plugin better. Update this section as the code lands.

Shape so far (grows as features land):

- Entry point: [`src/main.ts`](src/main.ts) → `ScribeGoalsStatsPlugin` — onload
  wiring only: settings tab, the ribbon icons / commands that open the two
  views — the goal widget (right sidebar) and the Goals & Stats tab (main
  area) — via a shared `activateView(viewType, placement)`, and child
  `Component`s (`ScopeScanner`, `ExplorerDecorator`, `GoalHistoryStore`).
  `saveSettings()` pokes the scanner to rescan, which cascades to the other
  two via `onChange`.
- `src/types.ts` — *not created yet*. When frontmatter or shared domain types
  are needed, this holds `FRONTMATTER_KEYS` (**single source of truth** for key
  names) plus the plugin's own data types (goals, snapshots, stat results).
- [`src/data/`](src/data/) — **pure modules, no Obsidian imports** (importing a
  type-only symbol from `src/settings/` is fine). Everything unit-testable
  lives here: `goalMath` (weekly/monthly targets), `exclusion` (`isExcluded`
  plus the always-on `(SL) ` rule), `scope` (`inStoryFolder`), `textMetrics`
  (`countWords` / `countCharacters` / `stripFrontmatter` / `measure` /
  `measureBoth`), `countTree` (`folderTotals`), `countFormat` (`formatCount`),
  `textDiff` (`insertedWords`: a word-level Myers diff, size-capped — see
  [goal-widget-plan.md](docs/feature-plans/goal-widget-plan.md)), `goalHistory`
  (the history-file model: `parseHistory`, `serializeHistory`,
  `writtenAcrossFiles`, `writtenFor`, `writtenBetween`, `resolveDayGoal` — a
  day's own recorded `dailyGoal`/`metric`, not today's live settings, so
  changing either later never repaints a past day's calendar colour),
  `calendarGrid`
  (`monthGrid`, `buildCalendar`, `dayStatus`), `writingSession`
  (`formatDuration`, `sessionProgress` — a countdown's own math, unrelated to
  the goal history). Later: tokenizing, sentence counting, stop-word
  filtering, repeated-word tallying, pace / projection.
- [`src/views/`](src/views/) — Obsidian-facing, not necessarily DOM: any
  non-trivial computation is a pure function in `src/data/` that these call,
  they don't do math inline.
  - `scopeScanner.ts` — the one place that scans and reads every in-scope
    note (both metrics plus the raw text, from a single `cachedRead` per
    file); everything else that needs "how much has been written" subscribes
    to it instead of scanning the vault itself.
  - `explorerDecorator.ts` — paints counts into the file explorer, re-picking
    the active metric from the scanner's scan.
  - `goalHistoryStore.ts` — records each day's totals (both metrics) from the
    scanner into a plugin-managed vault file, `"(SL) Goals History.json"`
    inside the story folder (or the vault root). A real vault file, not
    plugin data under `.obsidian/`, so it survives an uninstall/reinstall and
    travels with however the vault is already synced. Today's per-file text
    baseline that `writtenAcrossFiles` diffs against *is* kept in plugin data
    (injected as `TodayTextBaselineCache`, backed by `main.ts`'s
    `saveData()`/`loadData()`) — it only matters for the day still in
    progress, so losing it on an uninstall is fine.
  - `calendarWidget.ts` — `renderCalendarWidget`: the month-calendar nav +
    grid DOM, shared by `goalWidgetView.ts` and `goalsStatsTabView.ts` so both
    stay identical without duplicating the DOM building. A day with data gets
    an `aria-label` tooltip (its total, via `formatCount`) and, if `onDayClick`
    is passed, is clickable — a day with none has neither.
  - `progressRing.ts` — `renderProgressRing`: the disc-plus-arc SVG shared by
    the daily-goal ring and the writing-session countdown, so both stay
    visually identical without duplicating the SVG construction.
  - `goalWidgetView.ts` — the right-sidebar `ItemView` (today's ring, a
    week/month summary, the month calendar, and the writing-session card),
    reading `plugin.goalHistoryStore`, `plugin.writingSessionTimer`, and
    `plugin.settings`.
  - `writingSessionTimer.ts` — `WritingSessionTimer`: an
    idle/running/paused countdown, ticking once a second while running.
    Lives at the plugin level (like `goalHistoryStore`), not inside the
    view, so it keeps running if the sidebar is closed and reopened
    mid-session — see
    [writing-session-plan.md](docs/feature-plans/writing-session-plan.md).
    Deliberately unrelated to the daily goal or any calendar day. A session
    in progress *is* persisted — every state change, including each tick, via
    `App.saveLocalStorage()` (synchronous, vault-scoped; deliberately not
    `saveData()`/`loadData()`, which are async and share `data.json` with the
    much larger text baseline) — so it survives closing Obsidian, always
    restored as paused, never running, since there's no wall-clock accounting
    for time passed while closed.
  - `bellSound.ts` — `playBellSound()`: a single high-pitched strike (~2600 Hz)
    like a small hotel reception bell — a slightly detuned fundamental pair
    that audibly beats/shimmers as it rings, plus three inharmonic overtones
    with much shorter decays for the initial "clang" — synthesized with the
    Web Audio API (no bundled audio file), played alongside the completion
    `Notice`. Failures are swallowed silently.
  - `goalCelebration.ts` — announces the daily goal being reached even when
    the widget above isn't open: a `Notice` toast plus a confetti burst
    (`confetti.ts`) each time it's freshly crossed by an actual edit (a
    rising edge, so dipping under and back over again the same day
    celebrates again — but reopening Obsidian on an already-met day doesn't)
    plus a status-bar item (desktop only) that stays lit while the goal
    currently reads met.
  - `confetti.ts` — `playConfettiBurst()`: a first-party, dependency-free
    canvas confetti animation (see the "prefer first-party code" rule
    above) — a considered choice over a small existing npm package, matching
    `bellSound.ts`'s synthesized tone. Skips itself under
    `prefers-reduced-motion`; failures are swallowed silently.
  - `goalsStatsTabView.ts` — a main-area tab `ItemView` (opened via
    `workspace.getLeaf("tab")`, like the Visualization plugin's StoryLines,
    not a sidebar). Two sections: "Writing goal history" (period totals with
    daily averages beside the calendar, which shows Today's total plus, when a
    different day is clicked, that day's) and "Story Stats" (placeholder, not
    built yet).
- [`src/settings/`](src/settings/) — `settings.ts` (interface, defaults,
  `normalizeSettings`) and `settingsTab.ts` (the tab; imperative `display()`).
- [`styles.css`](styles.css) — prefer Obsidian's own CSS variables
  (`var(--text-muted)`, `var(--size-4-2)`, …). Plugin classes are prefixed
  `.scribe-`. The one hardcoded-colour exception is the plugin's magenta brand
  accent: it is defined once as `--scribe-accent` / `--scribe-accent-soft`
  (with a `.theme-dark` override) and everything else references those
  variables. Never introduce another raw hex; never set a colour from
  JavaScript; never override a core Obsidian colour. `npm run lint:css`
  ([`.stylelintrc.json`](.stylelintrc.json), extending
  `stylelint-config-obsidianmd`) enforces most of this automatically — keep it
  green alongside `npm run lint`.

## Conventions (enforced — don't violate)

### Obsidian plugin guidelines — check before every code change

Before adding or changing any code, verify it against the official
[Obsidian plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines).
Obsidian's automated review enforces these and rejects releases that break them.
The rules that bite most often here:

- **Use `this.app`**, never a global `app`.
- **Resource cleanup:** register listeners/intervals with `registerEvent()`,
  `registerDomEvent()`, `registerInterval()`, or `addCommand()` so they're torn
  down automatically. **Do not** `detachLeavesOfType()` in `onunload()` — Obsidian
  removes the plugin's views itself, and detaching also loses the leaf's position.
- **No hardcoded inline styles.** Put styling in [`styles.css`](styles.css) with
  Obsidian CSS variables; from code, toggle classes, or use
  `setCssStyles()` / `el.style.setProperty()` only for values computed at runtime.
- **DOM, not HTML strings.** Build nodes with `createEl()` / `createDiv()` /
  `createSpan()`; never `innerHTML` / `outerHTML` / `insertAdjacentHTML`.
- **Settings tab:** no top-level heading, no word "settings" in section names,
  sentence case, and section headers via `new Setting(el).setName(...).setHeading()`
  — not `<h1>`/`<h2>`.
- **Vault access:** look notes up with `getFileByPath()` / `getAbstractFileByPath()`
  — don't scan every file to match a path (a full scan is only OK for discovery,
  e.g. finding every note under a story folder). `normalizePath()` every
  user-supplied path. Edit the plugin's own files with `Vault.process()` /
  `FileManager.processFrontMatter()`; never `Vault.modify()` a note the user is
  editing — and this plugin does not write to the user's notes at all.
- **Commands:** no default hotkeys; `callback` for unconditional, `checkCallback`
  for conditional, `editorCallback` when it needs the active editor.
- **Workspace:** don't touch `workspace.activeLeaf` or cache view instances — use
  `getActiveViewOfType()` / `getActiveLeavesOfType()`.
- **Async:** `async`/`await` over `.then()` chains; a floating promise gets an
  explicit `void`. `console` output is errors only.
- **Mobile-safe:** no Node/Electron APIs, no regex lookbehind (`isDesktopOnly`
  is `false` in `manifest.json`).

`npm run lint` runs ESLint with `@typescript-eslint`'s **type-checked** rules on
`src/` (the same set Obsidian's review uses); keep it green.

### Other conventions

- **Don't run `git` write commands.** Never run `git add`, `git commit`, or
  `git push` — the maintainer stages, commits, and pushes by hand. Leave your
  changes in the working tree. When asked to supply a commit message, give the
  message text only and do **not** append a `Co-Authored-By:` trailer or any
  other attribution line.
- **Commit messages follow [Conventional Commits
  1.0.0](https://www.conventionalcommits.org/en/v1.0.0-beta.2/):**
  `<type>[optional scope]: <description>`, e.g. `feat: …`, `fix: …`,
  `chore: …`, `docs: …`, `refactor: …`, `test: …`; a breaking change adds `!`
  before the colon or a `BREAKING CHANGE:` footer. This is what the release
  tooling and CHANGELOG expect.
- **Branch names reuse the same type as a prefix:** `<type>/<short-kebab-slug>`,
  e.g. `fix/word-count-off-by-one`, `feat/repeated-words-view`,
  `docs/readme-goals-section`.
- **Never hardcode a frontmatter key string literal.** Reference
  `FRONTMATTER_KEYS` from [`src/types.ts`](src/types.ts).
- **Never modify a chapter/scene note — body or frontmatter.** The plugin only
  reads prose to measure it. Its own goal/stat data is persisted separately
  (plugin data, or its own files); editing prose the user wrote is off-limits.
- **TypeScript with `strictNullChecks`.** Avoid `any` where a real type exists.
- **Comments explain *why*, not *what*.** Match the existing sparse style.
- **Keep diffs focused** — no drive-by formatting or refactoring mixed into a
  feature/fix.
- Every source file starts with the SPDX `MIT` header + copyright line.
- **License is MIT** — don't add dependencies under a copyleft (GPL/LGPL/…) or
  otherwise MIT-incompatible license.

### Supply-chain rules

- All deps pinned to **exact** versions — no `^`, `~`, `latest`
  (`.npmrc` → `save-exact=true`).
- `.npmrc` → `ignore-scripts=true`. Don't rely on dependency lifecycle scripts.
  `esbuild`'s postinstall is opted back in only via `npm run rebuild:esbuild`.
- **Prefer a small amount of first-party code over adding a dependency.**

## Commands

```bash
npm install
npm run prepare  # activate Husky hooks — needed once, since ignore-scripts=true
                 # keeps `npm install` from running `prepare` itself
npm run dev      # esbuild watch → main.js (inline sourcemap)
npm run build    # tsc --noEmit type-check + minified production bundle → main.js
npm test         # esbuild-compile tests/**/*.test.ts → .test-build, run node --test
npm run lint     # eslint src tests — ESLint 9 flat config; src/ gets
                 # @typescript-eslint type-checked rules (needs the TS project)
npm run lint:css # stylelint styles.css, via stylelint-config-obsidianmd
npm run validate # typecheck + test + lint + lint:css — what the pre-commit hook runs
```

A Husky pre-commit hook ([`.husky/pre-commit`](.husky/pre-commit)) runs
`npm run validate` before every commit. `.husky/_/` is generated by
`npm run prepare` and git-ignored.

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs `npm run build`,
`npm test`, eslint, and stylelint on push/PR to `main`, on **Node 24** (matching
`@types/node`). All must pass before a PR.

Tests use Node's built-in `node:test` — **no test framework dependency**. They
live under [`tests/`](tests/), which mirrors `src/`: the spec for a module at
`src/data/<name>.ts` is `tests/data/<name>.test.ts` and imports its subject
from `../../src/data/<name>`. [`esbuild.test.mjs`](esbuild.test.mjs) transpiles
the `tests/**/*.test.ts` files (obsidian and Node builtins left external) into
`.test-build/`. Only pure modules with no Obsidian imports are unit-tested; keep
such logic (tokenizing, counting, stop-word filtering, pace/projection math) in
its own file so it can be imported without pulling in `obsidian`.

## Testing changes in a real vault

Copy or symlink `manifest.json`, `main.js`, and `styles.css` into
`<vault>/.obsidian/plugins/scribe-of-lagash-goals-stats/`, enable in Community
Plugins, and reload after each rebuild. This repo itself lives inside a test
vault's plugin folder, so `npm run dev` already writes `main.js` in place.

## Releasing

Maintainer-only, from a clean `main`; feature PRs never bump the version. Make
sure `CHANGELOG.md`'s `## [Unreleased]` section is complete, then
`npm run version-minor` (or `-patch` / `-major`), then `git push --follow-tags`.
Each wrapper is `npm version <type> --ignore-scripts=false` — the flag is
required, since `.npmrc`'s `ignore-scripts=true` otherwise skips the hooks. The
`version` hook runs [`version-changelog.mjs`](version-changelog.mjs) (promotes
`## [Unreleased]` to `## [<version>] - <date>`) then
[`version-bump.mjs`](version-bump.mjs) (syncs `manifest.json` / `versions.json`);
the `postversion` hook runs [`version-tag.mjs`](version-tag.mjs) (writes that
CHANGELOG section into the tag message). The release workflow then puts the same
CHANGELOG section (via [`release-notes.mjs`](release-notes.mjs)) at the top of
the GitHub Release body, above the auto-generated "What's Changed" notes. Full
steps in [CONTRIBUTING.md](CONTRIBUTING.md).

## Docs to keep in sync

When behavior or schema changes, update: `README.md`, `CHANGELOG.md`
("Unreleased"), the relevant plan doc under
[`docs/feature-plans/`](docs/feature-plans/) (one file per feature), and
`CONTRIBUTING.md` if conventions change.
