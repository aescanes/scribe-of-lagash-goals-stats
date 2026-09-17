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
 * the count the way "characters with spaces" would.
 */
export function countCharacters(content: string): number {
	const matches = stripFrontmatter(content).match(/\S/g);
	return matches ? matches.length : 0;
}

/** Measures a note's body in the unit the user picked for goals and stats. */
export function measure(content: string, metric: GoalMetric): number {
	return metric === "characters" ? countCharacters(content) : countWords(content);
}

/**
 * Both counts at once, from a single frontmatter-stripped pass. The writing-goal
 * history stores both regardless of the active metric, so switching the metric
 * setting later doesn't strand or misinterpret past history.
 */
export function measureBoth(content: string): { words: number; characters: number } {
	const body = stripFrontmatter(content);
	const words = body.match(/\S+/g);
	const characters = body.match(/\S/g);
	return { words: words ? words.length : 0, characters: characters ? characters.length : 0 };
}
