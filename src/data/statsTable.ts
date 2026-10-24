// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

// Pure grouping and roll-up for the story stats table — no Obsidian imports,
// unit-tested.

import type { NoteStats } from "../types";
import { pageCount, readMinutes, WORDS_PER_MINUTE, WORDS_PER_PAGE } from "./textStats";

/** One note's line in the table. */
export interface StatsRow {
	path: string;
	name: string;
	stats: NoteStats;
	/** Target length in the active metric; null when the note has none. */
	target: number | null;
}

/** The notes of one folder, plus that folder's rolled-up numbers. */
export interface FolderGroup {
	/** Folder path relative to the story folder; "" for notes directly in it. */
	folder: string;
	rows: StatsRow[];
	totals: NoteStats;
	/** Sum of the targets the folder's notes have; null when none has one. */
	target: number | null;
}

const ZERO: NoteStats = { size: 0, words: 0, readMinutes: 0, syllables: 0, sentences: 0, paragraphs: 0, pages: 0 };

/**
 * Field-by-field sum of stats — except read time and pages, which are
 * recomputed from the summed words: adding up per-note round-ups would count a
 * hundred 100-word scenes as a hundred pages instead of forty.
 */
export function sumStats(list: NoteStats[]): NoteStats {
	const total = { ...ZERO };
	for (const s of list) {
		total.size += s.size;
		total.words += s.words;
		total.syllables += s.syllables;
		total.sentences += s.sentences;
		total.paragraphs += s.paragraphs;
	}
	total.readMinutes = readMinutes(total.words, WORDS_PER_MINUTE);
	total.pages = pageCount(total.words, WORDS_PER_PAGE);
	return total;
}

/** Sum of the targets that are set; null when none is, so "no targets" never reads as a 0 target. */
export function sumTargets(targets: Array<number | null>): number | null {
	let total: number | null = null;
	for (const target of targets) if (target !== null) total = (total ?? 0) + target;
	return total;
}

/** Path of a note's folder relative to `storyFolder` ("" at its top level). */
function relativeFolder(path: string, storyFolder: string): string {
	const slash = path.lastIndexOf("/");
	const folder = slash === -1 ? "" : path.slice(0, slash);
	const root = storyFolder.replace(/\/+$/, "");
	if (root === "") return folder;
	if (folder === root) return "";
	return folder.startsWith(`${root}/`) ? folder.slice(root.length + 1) : folder;
}

const byName = (a: string, b: string): number => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

/**
 * Groups rows by their folder, relative to the story folder. Notes directly in
 * the story folder come first, then each subfolder in natural order ("Chapter 2"
 * before "Chapter 10"); notes within a group are in natural name order.
 */
export function groupByFolder(rows: StatsRow[], storyFolder: string): FolderGroup[] {
	const groups = new Map<string, StatsRow[]>();
	for (const row of rows) {
		const folder = relativeFolder(row.path, storyFolder);
		const list = groups.get(folder);
		if (list) list.push(row);
		else groups.set(folder, [row]);
	}

	return [...groups.entries()]
		.sort(([a], [b]) => (a === "" ? -1 : b === "" ? 1 : byName(a, b)))
		.map(([folder, list]) => {
			const sorted = [...list].sort((a, b) => byName(a.name, b.name));
			return {
				folder,
				rows: sorted,
				totals: sumStats(sorted.map((row) => row.stats)),
				target: sumTargets(sorted.map((row) => row.target)),
			};
		});
}
