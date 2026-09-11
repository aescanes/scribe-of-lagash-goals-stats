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
 * Character count of a note's body, including the spaces between words
 * ("characters with spaces"), with only the leading/trailing whitespace of the
 * whole body trimmed off.
 */
export function countCharacters(content: string): number {
	return stripFrontmatter(content).trim().length;
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
	return { words: words ? words.length : 0, characters: body.trim().length };
}
