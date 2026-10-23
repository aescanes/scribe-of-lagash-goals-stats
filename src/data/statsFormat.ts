// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

// Pure display formatting for the stats table and note popup — no Obsidian
// imports, unit-tested.

import { FRONTMATTER_KEYS, NoteStats } from "../types";
import { KNOWN_STATUSES } from "./statusLabel";
import { WORDS_PER_MINUTE, WORDS_PER_PAGE } from "./textStats";

/** Tooltips for the (?) icons beside "Read time", "Pages" and "Status". */
export const READ_TIME_HELP = `At ${WORDS_PER_MINUTE} words per minute, the average adult silent reading speed.`;
export const PAGES_HELP = `At ${WORDS_PER_PAGE} words per page, the standard manuscript page.`;
export const STATUS_HELP =
	`Set in the Status column of the (SL) Visualization plugin's outline file, or with the ` +
	`${FRONTMATTER_KEYS.status} property (the outline wins). ` +
	`Statuses: ${KNOWN_STATUSES.join(", ")}. Any other text is shown as written.`;

/** "12 min", "1 h 5 min", "2 h"; an em dash for nothing to read. */
export function formatReadTime(minutes: number): string {
	if (minutes <= 0) return "—";
	const hours = Math.floor(minutes / 60);
	const rest = minutes % 60;
	if (hours === 0) return `${rest} min`;
	return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Whole pages, locale-grouped; an em dash for none. */
export function formatPages(pages: number): string {
	if (pages <= 0) return "—";
	return pages.toLocaleString();
}

/** One ratio for the popup's footer line, e.g. `{ value: "7.7", label: "words per sentence" }`. */
export interface NoteRatio {
	value: string;
	label: string;
}

function ratio(numerator: number, denominator: number): string {
	return denominator > 0 ? (numerator / denominator).toFixed(1) : "—";
}

/** Words per sentence, sentences per paragraph and syllables per word — an em dash where the divisor is zero. */
export function noteRatios(stats: NoteStats): NoteRatio[] {
	return [
		{ value: ratio(stats.words, stats.sentences), label: "words per sentence" },
		{ value: ratio(stats.sentences, stats.paragraphs), label: "sentences per paragraph" },
		{ value: ratio(stats.syllables, stats.words), label: "syllables per word" },
	];
}

/** Progress toward a note's target length: whole percent, a 0–1 bar fraction, and what is left. */
export function goalProgress(size: number, target: number): { percent: number; fraction: number; remaining: number } {
	const fraction = target > 0 ? Math.min(1, Math.max(0, size / target)) : 0;
	return {
		percent: target > 0 ? Math.round((size / target) * 100) : 0,
		fraction,
		remaining: Math.max(0, target - size),
	};
}
