# Scribe of Lagash - Goals & Stats

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Minimum Obsidian version](https://img.shields.io/badge/obsidian-%E2%89%A51.10.0-8b6cef)

An [Obsidian](https://obsidian.md) plugin that helps storytellers set **writing
goals** and see **detailed statistics** for those goals and for the story as a
whole. It is the second plugin in the **Scribe of Lagash** series, a set of
independent, focused tools for planning and writing stories in Obsidian.

## Features

Working now:

- **Writing-goal widget** — a right-sidebar view (ribbon icon or the "Open
  writing goal widget" command) with a ring for today's progress toward the
  daily goal, a week/month summary, and a month calendar colouring each day by
  whether it met, partly met, or missed the goal. History is kept in a
  plugin-managed file in the vault, so it survives a plugin uninstall/reinstall
  and travels with the vault through whatever the author already syncs it
  with.
- **File-explorer counts** — every note inside the story folder shows its word
  (or character) count next to its name in the file explorer, and every folder
  shows the total of the notes beneath it. Counts update as you write.
- **Writing-goal settings** — a story folder, a words/characters metric, a
  daily goal, and the days of the week you write; the weekly and monthly
  targets are worked out from those. Plus a list of notes and folders to
  exclude from everything the plugin measures.

Planned:

- **Goal targets** — total word count and a deadline, per-chapter or per-scene
  length targets, and a projected completion date.
- **Goal stats** — writing streaks and how each day compares to the target pace.
- **Story stats** — total and per-chapter/scene word, sentence, and paragraph
  counts; average scene and chapter length; reading-time estimate.
- **Repeated-word analysis** — most-frequent words and phrases across the
  whole story or a single chapter, with common stop-words filtered out, to
  surface overused crutch words.
- **Per-story scoping** — every statistic can be computed for one story folder
  or the whole vault.

See [`docs/feature-plans/`](docs/feature-plans/) for the detailed plan of each
feature (one file per feature).

## Development

```bash
npm install
npm run dev    # watch build, outputs main.js
npm run build  # type-check + production build
npm test       # unit tests (Node's built-in runner; no test framework dependency)
```

### Supply-chain safety

- Every dependency in `package.json` is pinned to an exact version — no `^`/`~`
  ranges and no `latest`. `.npmrc` sets `save-exact=true` so future
  `npm install <pkg>` additions stay pinned by default.
- `.npmrc` also sets `ignore-scripts=true`, so `npm install`/`npm ci` never
  runs a dependency's `preinstall`/`install`/`postinstall` script
  automatically. The only dependency that ships one is `esbuild`, and its
  script just optimizes linking its already-installed platform binary — the
  build works fine without it. On the rare platform where it doesn't (e.g. an
  environment without a matching prebuilt `@esbuild/*` package), run
  `npm run rebuild:esbuild` to explicitly and visibly opt that one script back
  in for that single command.

To try the plugin in a vault, copy (or symlink) `manifest.json`, `main.js`,
and `styles.css` into `<vault>/.obsidian/plugins/scribe-of-lagash-goals-stats/`,
then enable it from Obsidian's Community Plugins settings.

## Contributing

Found a bug, or have a feature request? Open one on the
[GitHub Issues page](https://github.com/aescanes/scribe-of-lagash-goals-stats/issues) —
there's a template for each.

Contributions are welcome — see [CONTRIBUTING.md](CONTRIBUTING.md) for dev setup, code conventions, and the PR
process. This project follows a [Code of Conduct](CODE_OF_CONDUCT.md).

Found a security issue? See [SECURITY.md](SECURITY.md) instead of opening a public
issue.

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

[MIT](LICENSE).
