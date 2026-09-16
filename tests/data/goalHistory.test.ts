// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import assert from "node:assert/strict";
import { test } from "node:test";
import {
	dateKey,
	FileText,
	GoalHistory,
	parseHistory,
	serializeHistory,
	writtenAcrossFiles,
	writtenBetween,
	writtenFor,
} from "../../src/data/goalHistory";
import { DIFF_WORD_LIMIT } from "../../src/data/textDiff";

test("dateKey is the local YYYY-MM-DD, zero-padded", () => {
	assert.equal(dateKey(new Date(2026, 0, 5)), "2026-01-05");
	assert.equal(dateKey(new Date(2026, 10, 30)), "2026-11-30");
});

test("parseHistory keeps only well-formed date-keyed day records", () => {
	const raw = JSON.stringify({
		"2026-09-10": { written: { words: 100, characters: 500 } },
		"not-a-date": { written: { words: 1, characters: 1 } },
		"2026-09-11": { written: { words: "oops" } },
		"2026-09-12": { written: { words: 200, characters: 400 } },
	});
	assert.deepEqual(parseHistory(raw), {
		"2026-09-10": { written: { words: 100, characters: 500 } },
		"2026-09-12": { written: { words: 200, characters: 400 } },
	});
});

test("parseHistory tolerates invalid JSON and non-object input", () => {
	assert.deepEqual(parseHistory("{not json"), {});
	assert.deepEqual(parseHistory("42"), {});
	assert.deepEqual(parseHistory("null"), {});
});

test("serializeHistory sorts keys chronologically", () => {
	const history: GoalHistory = {
		"2026-09-12": { written: { words: 3, characters: 3 } },
		"2026-09-10": { written: { words: 1, characters: 1 } },
		"2026-09-11": { written: { words: 2, characters: 2 } },
	};
	const keys = Object.keys(JSON.parse(serializeHistory(history)) as object);
	assert.deepEqual(keys, ["2026-09-10", "2026-09-11", "2026-09-12"]);
});

test("writtenFor reads the requested metric, 0 when the day is missing", () => {
	const history: GoalHistory = {
		"2026-09-10": { written: { words: 100, characters: 550 } },
	};
	assert.equal(writtenFor(history, "2026-09-10", "words"), 100);
	assert.equal(writtenFor(history, "2026-09-10", "characters"), 550);
	assert.equal(writtenFor(history, "2026-09-11", "words"), 0);
});

test("writtenBetween sums written amounts over an inclusive date range", () => {
	const history: GoalHistory = {
		"2026-09-07": { written: { words: 100, characters: 500 } }, // outside the range
		"2026-09-08": { written: { words: 200, characters: 900 } },
		"2026-09-09": { written: { words: 50, characters: 250 } },
		"2026-09-10": { written: { words: 300, characters: 1200 } }, // outside the range
	};
	assert.equal(writtenBetween(history, "2026-09-08", "2026-09-09", "words"), 250);
	assert.equal(writtenBetween(history, "2026-09-08", "2026-09-09", "characters"), 1150);
});

test("writtenAcrossFiles: a deletion in one file never offsets a new count in another", () => {
	const baselineText: FileText = {
		"doc1.md": "a b c d e f g h i j",
		"doc2.md": "x y",
	};
	// doc1 lost most of its old sentence; doc2 gained two genuinely new words.
	const current: FileText = {
		"doc1.md": "a b c",
		"doc2.md": "x y new1 new2",
	};
	assert.deepEqual(writtenAcrossFiles(baselineText, current), { words: 2, characters: 9 });
});

test("writtenAcrossFiles: deleting an old paragraph never lowers today's count, even within the same file", () => {
	const baselineText: FileText = { "doc.md": "old1 old2 old3 old4 old5" };
	// The whole old paragraph is gone; two new words were typed in its place.
	const current: FileText = { "doc.md": "new1 new2" };
	assert.deepEqual(writtenAcrossFiles(baselineText, current), { words: 2, characters: 9 });
});

test("writtenAcrossFiles: deleting part of what was typed today still lowers that file's own count", () => {
	const baselineText: FileText = { "doc.md": "a b c" };
	// "x y" was typed in, then "x" was deleted before this scan ran.
	const current: FileText = { "doc.md": "a b c y" };
	assert.deepEqual(writtenAcrossFiles(baselineText, current), { words: 1, characters: 1 });
});

test("writtenAcrossFiles: a brand-new file counts in full; a deleted file contributes 0, not a negative", () => {
	const baselineText: FileText = { "old.md": "a b c d e" };
	const current: FileText = { "new.md": "x y" };
	// old.md dropped out of scope entirely (deleted or moved out) — no negative
	// carry-over; new.md had no baseline, so all of it counts.
	assert.deepEqual(writtenAcrossFiles(baselineText, current), { words: 2, characters: 3 });
});

test("writtenAcrossFiles: falls back to a plain floored difference for a file too large/different to diff", () => {
	const bigOld = Array.from({ length: 5000 }, (_, i) => `old${i}`).join(" ");
	const bigNew = Array.from({ length: 5500 }, (_, i) => `new${i}`).join(" ");
	// bigOld + bigNew's combined word count exceeds DIFF_WORD_LIMIT, so
	// insertedWords() returns null for this file; the fallback still measures
	// a plain floored word-count difference for it (500), and other files
	// still get the precise diff (+1 for small.md).
	assert.ok(5000 + 5500 > DIFF_WORD_LIMIT);
	const baselineText: FileText = { "big.md": bigOld, "small.md": "a b" };
	const current: FileText = { "big.md": bigNew, "small.md": "a b c" };
	const result = writtenAcrossFiles(baselineText, current);
	assert.equal(result.words, 501);
});

test("writtenBetween is inclusive of a single-day range and 0 for an empty one", () => {
	const history: GoalHistory = {
		"2026-09-08": { written: { words: 200, characters: 900 } },
	};
	assert.equal(writtenBetween(history, "2026-09-08", "2026-09-08", "words"), 200);
	assert.equal(writtenBetween(history, "2026-09-01", "2026-09-07", "words"), 0);
	assert.equal(writtenBetween({}, "2026-09-01", "2026-09-30", "words"), 0);
});
