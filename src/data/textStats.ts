// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

// Pure prose statistics — no Obsidian imports, unit-tested. Syllables and
// sentences are heuristics, good enough to compare scenes, not to grade them.

import type { GoalMetric } from "../settings/settings";
import type { NoteStats } from "../types";
import { countWords, measure, stripFrontmatter } from "./textMetrics";

/**
 * Prose with markdown scaffolding removed, for the measures where syntax would
 * skew the result (syllables, sentences). Word and character counts
 * deliberately do not use this, to stay consistent with the explorer badges.
 */
export function stripMarkdown(content: string): string {
	return stripFrontmatter(content)
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/%%[\s\S]*?%%/g, " ")
		.replace(/<!--[\s\S]*?-->/g, " ")
		.replace(/^\s{0,3}#{1,6}\s+.*$/gm, " ")
		.replace(/^\s*([-*_])(\s*\1){2,}\s*$/gm, " ")
		.replace(/!?\[\[([^\]|]*\|)?([^\]]*)\]\]/g, "$2")
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
		.replace(/^\s*>+\s?/gm, "")
		.replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, "")
		.replace(/[*_~`]+/g, "");
}

/** Vowel groups, with `y` as a vowel and accented Spanish/French vowels included. */
const VOWEL_GROUP_RE = /[aeiouyáéíóúüàèìòùâêîôû]+/g;

/**
 * Estimated syllables in one word: vowel groups, minus a silent final `e`
 * ("make"), `-es`/`-ed` endings that don't add a syllable ("makes", "walked"),
 * but keeping `-le` ("table") — never fewer than one for a word with a vowel.
 */
export function countSyllables(word: string): number {
	const w = word.toLowerCase().replace(/[^a-záéíóúüñàèìòùâêîôû]/g, "");
	if (w === "") return 0;

	// A vowel run counts once, so Spanish hiatus ("poeta") undercounts by one;
	// splitting it would overcount English runs like "beautiful" or "seat".
	let groups = (w.match(VOWEL_GROUP_RE) ?? []).length;
	if (groups === 0) return 1;

	const silentE = /[^aeiouy]e$/.test(w) && !/[^aeiouy]le$/.test(w);
	const silentEnding = /[^aeiouytd](es|ed)$/.test(w);
	if ((silentE || silentEnding) && groups > 1) groups -= 1;
	return Math.max(1, groups);
}

/** Total estimated syllables across a note's prose. */
export function countTextSyllables(content: string): number {
	const words = stripMarkdown(content).match(/\S+/g) ?? [];
	let total = 0;
	for (const word of words) total += countSyllables(word);
	return total;
}

const ABBREVIATIONS = new Set([
	"mr", "mrs", "ms", "dr", "prof", "sr", "sra", "srta", "st", "jr", "vs", "etc", "no", "vol", "fig",
]);

/**
 * Sentences: runs of text ending in `.`, `!`, `?` or `…`, followed by
 * whitespace (optionally after closing quotes/brackets) or the end. Common
 * abbreviations, decimals and ellipses do not end a sentence on their own; a
 * trailing run with no terminator still counts as one.
 */
export function countSentences(content: string): number {
	const text = stripMarkdown(content);
	let count = 0;
	const re = /[.!?…]+["'”’)\]]*(?=\s|$)/g;
	let lastEnd = 0;
	let match: RegExpExecArray | null;
	while ((match = re.exec(text)) !== null) {
		const before = text.slice(lastEnd, match.index);
		const lastWord = /([A-Za-zÀ-ÿ]+)$/.exec(before)?.[1]?.toLowerCase();
		const isAbbreviation = match[0].startsWith(".") && match[0].length === 1 && lastWord !== undefined && ABBREVIATIONS.has(lastWord);
		if (isAbbreviation) continue;
		if (/\S/.test(before) && /[\p{L}\p{N}]/u.test(before)) {
			count++;
			lastEnd = match.index + match[0].length;
		}
	}
	const trailingText = /[\p{L}\p{N}]/u.test(text.slice(lastEnd));
	return trailingText ? count + 1 : count;
}

/** Blank-line-separated blocks of prose; headings, rules and frontmatter don't count. */
export function countParagraphs(content: string): number {
	return stripMarkdown(content)
		.split(/\n\s*\n/)
		.filter((block) => /[\p{L}\p{N}]/u.test(block)).length;
}

/** Average adult silent-reading speed, behind the read-time stat. */
export const WORDS_PER_MINUTE = 245;

/** Words on one manuscript page, behind the pages stat. */
export const WORDS_PER_PAGE = 250;

/** Whole minutes to read `words`, rounded up; 0 for none. */
export function readMinutes(words: number, wordsPerMinute: number): number {
	if (words <= 0 || wordsPerMinute <= 0) return 0;
	return Math.ceil(words / wordsPerMinute);
}

/** Manuscript pages, rounded up to a whole page; 0 only for an empty note. */
export function pageCount(words: number, wordsPerPage: number): number {
	if (words <= 0 || wordsPerPage <= 0) return 0;
	return Math.ceil(words / wordsPerPage);
}

/** The settings a note's stats depend on. */
export interface StatsOptions {
	metric: GoalMetric;
	includeSpaces: boolean;
}

/** Every statistic for one note's raw text. */
export function computeNoteStats(content: string, options: StatsOptions): NoteStats {
	const words = countWords(content);
	return {
		size: measure(content, options.metric, options.includeSpaces),
		words,
		readMinutes: readMinutes(words, WORDS_PER_MINUTE),
		syllables: countTextSyllables(content),
		sentences: countSentences(content),
		paragraphs: countParagraphs(content),
		pages: pageCount(words, WORDS_PER_PAGE),
	};
}
