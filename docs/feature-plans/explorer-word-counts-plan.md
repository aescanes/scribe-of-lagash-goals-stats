# File-explorer word counts

Status: initial version landed.

## Goal

Show progress at a glance without opening a view: next to every note in the
file explorer, its word (or character) count; next to every folder, the sum of
the notes beneath it.

## Behaviour

- **Scope** — notes inside the story folder. When the story folder is empty the
  whole vault is counted (matching the plugin's "empty = whole vault" rule).
- **Unit** — follows the General → Metric setting: `word`/`words` or
  `char`/`chars`, singular below two. No tooltip. The text itself no longer
  distinguishes folder from note (`formatCount`'s `isFolder` is currently
  unused) — that distinction is carried entirely by placement/style below.
- **Placement / style** — the span is inserted after the name element
  (`.tree-item-inner`); CSS then places it. Both are a small pill (tinted
  background, rounded corners) sized via `--font-ui-small`, with a leading type
  icon — `file-text` for a note, `folder` for a folder. A note's own count sits
  just after the title, coloured with the softer `--scribe-accent-soft`
  (`.mod-note`). A folder's rolled-up total is pushed to the right edge of the
  row (`margin-left: auto`) and coloured with the stronger `--scribe-accent`
  (`.mod-folder`).
- **Exclusions** — `isExcluded` is applied, so `(SL) ` files/folders and the
  user's excluded paths are neither counted nor shown. A folder's total does
  not include excluded notes.
- **Live** — the shared scanner recomputes (debounced) on `vault`
  create/modify/delete/rename and on `metadataCache` "resolved", and on
  `saveSettings()`; the explorer repaints on every scan.
- **Always on** — no toggle.

## Modules

- [`src/data/textMetrics.ts`](../../src/data/textMetrics.ts) —
  `stripFrontmatter`, `countWords`, `countCharacters`, and `measure(content,
  metric)` which dispatches on the words/characters metric. A "word" is a run
  of non-whitespace; characters are counted with inner spaces, ends trimmed.
  Pure, unit-tested. Shared with the (later) writing-goal work.
- [`src/data/countTree.ts`](../../src/data/countTree.ts) — `folderTotals`: rolls
  per-file counts up into every ancestor folder. Pure, unit-tested.
- [`src/data/countFormat.ts`](../../src/data/countFormat.ts) — `formatCount`:
  the badge string (e.g. `1,234 words`). Pure, unit-tested.
- [`src/data/scope.ts`](../../src/data/scope.ts) — `inStoryFolder`. Pure,
  unit-tested.
- [`src/views/scopeScanner.ts`](../../src/views/scopeScanner.ts) — scans
  in-scope, non-excluded notes and measures both metrics per file from one
  `cachedRead`; shared with the writing-goal history (see
  [goal-widget-plan.md](goal-widget-plan.md)) so neither reads the vault
  twice. `ExplorerDecorator` re-picks the active metric from its scan on every
  `onChange` rather than scanning itself.
- [`src/views/explorerDecorator.ts`](../../src/views/explorerDecorator.ts) — the
  Obsidian glue: a `Component` that caches counts and paints a
  `.scribe-explorer-count` span just after the name in each
  explorer row (`fileItems[path].selfEl` → its `.tree-item-inner`). A
  `MutationObserver` on `.nav-files-container`
  (disconnected during each paint to avoid a feedback loop) repaints when
  folders expand or the explorer is rebuilt. `teardown()` removes every span on
  unload — it never detaches the explorer leaf.

## Notes / limitations

- The file explorer view is not part of Obsidian's public API. The decorator
  depends only on `leaf.view.fileItems[path].selfEl`; if a future Obsidian
  release changes that shape the counts silently stop appearing (no crash —
  `fileItems` is guarded).
- Counts are the same rough measure a word processor gives; markdown syntax
  (`#`, `*`, `[[ ]]`) is counted, not stripped.

## Not done yet

- No per-file caching by mtime — every relevant event triggers a full rescan
  (fine for a few hundred notes via `cachedRead`; revisit if it drags).
