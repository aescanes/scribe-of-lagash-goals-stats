// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

// Reads the Status column of the Visualization plugin's Outline file — pure, no
// Obsidian imports, unit-tested. The outline is a Markdown table whose rows
// name no note: a row plans "Act I / Chapter 1 / Scene 2", and the note it
// means is the one whose folders and file name carry those same numbers. This
// is a deliberately small re-implementation of that matching (exact structure
// only, no fallbacks), so the two plugins stay independent.

/** One level of a row's or a note's position: "Act I", "Chapter 1 - Title", … */
export interface Segment {
	/** The leading number (digits or roman numeral), if the level has one. */
	number: number | null;
	/** Lowercased text after the label word, for levels that aren't numbered. */
	text: string;
}

export interface OutlineStatusRow {
	segments: Segment[];
	/** Empty for "No Status" or a blank cell. */
	status: string;
}

const ROMAN_VALUES: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
const CANONICAL_ROMAN = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i;
const LEADING_NUMBER = /^\s*(\d+|[ivxlcdm]+)\b/i;

function numberToken(token: string): number | null {
	if (/^\d+$/.test(token)) return Number.parseInt(token, 10);
	const s = token.toLowerCase();
	if (!CANONICAL_ROMAN.test(s)) return null;
	let total = 0;
	for (let i = 0; i < s.length; i++) {
		const current = ROMAN_VALUES[s[i]];
		const next = ROMAN_VALUES[s[i + 1]] ?? 0;
		total += current < next ? -current : current;
	}
	return total;
}

function leadingNumber(value: string): number | null {
	const match = LEADING_NUMBER.exec(value);
	return match ? numberToken(match[1]) : null;
}

function segmentOf(value: string): Segment {
	return { number: leadingNumber(value), text: value.trim().toLowerCase() };
}

/** Splits `| a | b |` into trimmed cells; `\|` stays inside its cell. */
function splitRow(line: string): string[] {
	const cells: string[] = [];
	let current = "";
	let body = line.trim();
	if (body.startsWith("|")) body = body.slice(1);
	if (body.endsWith("|") && !body.endsWith("\\|")) body = body.slice(0, -1);
	for (let i = 0; i < body.length; i++) {
		if (body[i] === "\\" && body[i + 1] === "|") {
			current += "|";
			i++;
		} else if (body[i] === "|") {
			cells.push(current.trim());
			current = "";
		} else {
			current += body[i];
		}
	}
	cells.push(current.trim());
	return cells;
}

const isSeparator = (cells: string[]): boolean => cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));

/** Drops the writer's `[x]`-style bracket shorthand around a cell. */
function unbracket(cell: string): string {
	const match = /^\[(.*)\]$/.exec(cell);
	return (match ? match[1] : cell).trim();
}

/**
 * The first table in an Outline file's body, as position + status per row.
 * Columns are matched by header name, case-insensitively. A row with neither a
 * Chapter nor a Scene plans nothing and is dropped, like the Visualization
 * plugin does. Without a Status column there is nothing to read.
 */
export function parseOutlineStatusRows(body: string): OutlineStatusRow[] {
	const lines = body.split(/\r?\n/);
	let headerAt = -1;
	for (let i = 0; i < lines.length - 1; i++) {
		if (lines[i].includes("|") && isSeparator(splitRow(lines[i + 1]))) {
			headerAt = i;
			break;
		}
	}
	if (headerAt === -1) return [];

	const header = splitRow(lines[headerAt]).map((c) => c.toLowerCase());
	const statusCol = header.indexOf("status");
	if (statusCol === -1) return [];
	const cellAt = (cells: string[], name: string): string => {
		const i = header.indexOf(name);
		return i === -1 || i >= cells.length ? "" : unbracket(cells[i]);
	};

	const rows: OutlineStatusRow[] = [];
	for (let i = headerAt + 2; i < lines.length; i++) {
		if (!lines[i].includes("|")) break;
		const cells = splitRow(lines[i]);
		const chapter = cellAt(cells, "chapter");
		const scene = cellAt(cells, "scene");
		if (leadingNumber(chapter) === null && leadingNumber(scene) === null) continue;

		const segments = [cellAt(cells, "act"), chapter, scene].filter((c) => c !== "").map(segmentOf);
		const raw = cellAt(cells, "status");
		rows.push({ segments, status: raw.toLowerCase() === "no status" ? "" : raw });
	}
	return rows;
}

/**
 * A note's position from its path below the Outline file's folder: every folder
 * name and the file name, each reduced to what follows its label word
 * ("Chapter 1 - Title" → "1 - title"). Label-agnostic, so English, Spanish and
 * any other title language read the same way.
 */
export function noteSegments(relativePath: string): Segment[] {
	return relativePath
		.replace(/\.md$/i, "")
		.split("/")
		.filter((part) => part !== "")
		.map((part) => {
			const match = /^\s*\S+?\.?\s+(.+)$/.exec(part);
			return segmentOf(match ? match[1] : part);
		});
}

function sameSegment(a: Segment, b: Segment): boolean {
	return a.number !== null && b.number !== null ? a.number === b.number : a.text === b.text;
}

/**
 * The status of the row that plans the note at `relativePath` (path below the
 * Outline file's folder), or "" when no row does. The first matching row wins.
 */
export function findOutlineStatus(rows: OutlineStatusRow[], relativePath: string): string {
	const note = noteSegments(relativePath);
	for (const row of rows) {
		if (row.segments.length !== note.length) continue;
		if (row.segments.every((segment, i) => sameSegment(segment, note[i]))) return row.status;
	}
	return "";
}
