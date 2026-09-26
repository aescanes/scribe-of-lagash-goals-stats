// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

// Pure text measurement — no Obsidian imports, unit-tested. The file explorer
// decoration and (later) the writing goals both measure prose through these.

import type { GoalMetric } from "../settings/settings";

// Matches a leading YAML frontmatter block so it is not counted as prose. Same
// pattern the Visualization plugin uses, for consistent counts across the series.
const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;

/** A note's body with its leading YAML frontmatter block removed. */
export function stripFrontmatter(content: string): string {
	return content.replace(FRONTMATTER_RE, "");
}

/**
 * Word count of a note's body. A "word" is any run of non-whitespace, so
 * markdown syntax and hyphenated words count the way they read on the page —
 * the same rough measure a word processor gives.
 */
export function countWords(content: string): number {
	const words = stripFrontmatter(content).match(/\S+/g);
	return words ? words.length : 0;
}

/**
 * Character count of a note's body, excluding whitespace (spaces, tabs, line
 * breaks) — so two words separated by a space or a blank line don't inflate
 * the count. This is the "characters without spaces" convention.
 */
export function countCharactersWithoutSpaces(content: string): number {
	const matches = stripFrontmatter(content).match(/\S/g);
	return matches ? matches.length : 0;
}

/**
 * Character count of a note's body including internal whitespace (spaces,
 * tabs, line breaks) — only the leading/trailing whitespace of the whole body
 * is trimmed. This is the "characters with spaces" convention, matching what
 * Obsidian's own word-count status bar reports.
 */
export function countCharactersWithSpaces(content: string): number {
	return stripFrontmatter(content).trim().length;
}

/**
 * Measures a note's body in the unit the user picked for goals and stats.
 * `includeSpaces` only matters for the "characters" metric — see
 * `countCharactersWithSpaces`/`countCharactersWithoutSpaces`.
 */
export function measure(content: string, metric: GoalMetric, includeSpaces: boolean): number {
	if (metric === "words") return countWords(content);
	return includeSpaces ? countCharactersWithSpaces(content) : countCharactersWithoutSpaces(content);
}

/**
 * Every count at once, from a single frontmatter-stripped pass. The
 * writing-goal history stores all of these regardless of which metric (and,
 * for characters, which spaces convention) is active, so switching either
 * setting later doesn't strand or misinterpret past history.
 */
export function measureBoth(
	content: string,
): { words: number; charactersWithSpaces: number; charactersWithoutSpaces: number } {
	const body = stripFrontmatter(content);
	const words = body.match(/\S+/g);
	const nonSpace = body.match(/\S/g);
	return {
		words: words ? words.length : 0,
		charactersWithSpaces: body.trim().length,
		charactersWithoutSpaces: nonSpace ? nonSpace.length : 0,
	};
}
