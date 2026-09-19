// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { defineConfig, globalIgnores } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
	globalIgnores(["main.js", ".test-build/**"]),
	// The Obsidian team's own recommended config — the same guideline checks
	// their plugin review runs, kept current by them instead of guessed at here.
	...obsidianmd.configs.recommended,
	{
		// This repo's build/version scripts and eslint.config.mjs itself aren't
		// part of tsconfig.json's project (it only includes **/*.ts), so
		// typescript-eslint's project service needs an explicit allowance for
		// them — the same mechanism eslint-plugin-obsidianmd's own setup docs
		// use for eslint.config.*. tsconfigRootDir is pinned explicitly too, so
		// the right tsconfig.json is found even when ESLint runs from a
		// different cwd (e.g. an editor extension), matching the Obsidian
		// team's own sample-plugin config.
		languageOptions: {
			parserOptions: {
				projectService: { allowDefaultProject: ["*.mjs"] },
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
	{
		// This repo's build/version scripts run directly under Node, outside the
		// shipped plugin bundle — the recommended config only adds Node globals
		// when manifest.json's isDesktopOnly is true, since the bundle itself
		// (this plugin also targets mobile) must not depend on them.
		files: ["*.mjs"],
		languageOptions: { globals: { process: "readonly", console: "readonly" } },
	},
	{
		// Tests and these same build/version scripts never ship in the plugin
		// bundle, so two rules aimed at the shipped code don't apply: Node
		// built-ins are fine here even though the guideline they encode
		// (no-nodejs-modules) is about what the bundle imports, and node:test's
		// `test()` calls trip no-floating-promises because the test runner
		// — not this code — is what awaits them.
		files: ["tests/**/*.ts", "*.mjs"],
		rules: {
			"obsidianmd/no-nodejs-modules": "off",
			"@typescript-eslint/no-floating-promises": "off",
		},
	},
	{
		// The build/version scripts' whole job is printing to the terminal
		// (release notes, version bumps) — "avoid unnecessary console logging"
		// is guidance about the plugin that runs inside Obsidian, not about a
		// local CLI tool that never ships in the bundle.
		files: ["*.mjs"],
		rules: { "obsidianmd/rule-custom-message": "off" },
	},
	{
		// "(SL) G & S:" is this plugin's own command-palette/ribbon prefix (short
		// for "Scribe of Lagash" - "Goals and Stats"), used so its entries group
		// together — sentence-casing it into "(Sl) g & s:" would mangle that
		// on-purpose prefix. `acronyms` is case-insensitive (so "SL" alone is
		// enough), but a bare `acronyms: ["G", "S"]` would also force-uppercase
		// any unrelated lowercase "s"/"g" token elsewhere (e.g. "story's"), so
		// those two go in the case-sensitive `ignoreWords` list instead — it
		// only leaves an already-uppercase "G"/"S" alone, never mangling those
		// lowercase ones. Everything after the prefix still gets sentence-cased
		// normally, same as any other UI string.
		//
		// "Goals" and "Stats" are in `ignoreWords` too, deliberately: the Goals
		// & Stats tab's own `getDisplayText()` is title-cased ("(SL) Goals and
		// Stats") rather than sentence-cased, unlike every other UI string in
		// this plugin — a one-off exception the maintainer chose to keep, even
		// though it's a real deviation from Obsidian's own sentence-case
		// guideline (this rule mirrors that guideline, so a manual reviewer
		// could still flag it at submission time — this only silences the
		// local warning). Being case-sensitive, this doesn't touch the
		// lowercase "goals"/"stats" used correctly everywhere else (command
		// names, the ribbon tooltip, …).
		files: ["src/**/*.ts"],
		rules: {
			"obsidianmd/ui/sentence-case": [
				"warn",
				{ enforceCamelCaseLower: true, acronyms: ["SL"], ignoreWords: ["G", "S", "Goals", "Stats"] },
			],
		},
	},
]);
