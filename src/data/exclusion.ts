// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

// Pure exclusion rules — no Obsidian imports, unit-tested. Decides whether a
// vault-relative note path is left out of the writing goals and (later) the
// statistics.

/**
 * Prefix every Scribe of Lagash plugin puts on the files and folders it
 * generates (e.g. the Visualization plugin's "(SL) StoryLines.md"). Those are
 * planning/scaffolding files, not prose, so this plugin always ignores them.
 */
export const SCRIBE_GENERATED_PREFIX = "(SL)";

/** Path split into non-empty segments; folder names and the file name alike. */
function segments(path: string): string[] {
	return path.split("/").filter(Boolean);
}

/** Trims slashes and surrounding whitespace so entries compare cleanly. */
function normalize(path: string): string {
	return path.trim().replace(/^\/+/, "").replace(/\/+$/, "");
}

/**
 * Whether `path` is excluded from goals and stats. Scribe-generated files and
 * folders (any segment starting with "(SL)") are always excluded; `excluded`
 * adds the user's own vault-relative notes and folders, where naming a folder
 * excludes everything inside it. A folder entry may be given with or without a
 * trailing "/", and a note entry with or without its ".md" extension.
 */
export function isExcluded(path: string, excluded: readonly string[]): boolean {
	const target = normalize(path);
	if (!target) return false;

	if (segments(target).some((segment) => segment.startsWith(SCRIBE_GENERATED_PREFIX))) {
		return true;
	}

	return excluded.some((raw) => {
		const entry = normalize(raw);
		if (!entry) return false;
		return (
			target === entry ||
			target === `${entry}.md` ||
			target.startsWith(`${entry}/`)
		);
	});
}
