// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import assert from "node:assert/strict";
import { test } from "node:test";
import {
	charactersFor,
	dateKey,
	FileText,
	GoalHistory,
	parseHistory,
	resolveDayGoal,
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

test("charactersFor prefers the matching split field, falls back to the legacy field", () => {
	assert.equal(charactersFor({ words: 1, charactersWithSpaces: 12, charactersWithoutSpaces: 10 }, true), 12);
	assert.equal(charactersFor({ words: 1, charactersWithSpaces: 12, charactersWithoutSpaces: 10 }, false), 10);
	// Legacy day, recorded before the split: same legacy number either way.
	assert.equal(charactersFor({ words: 1, characters: 10 }, true), 10);
	assert.equal(charactersFor({ words: 1, characters: 10 }, false), 10);
	// No data at all.
	assert.equal(charactersFor({ words: 1 }, true), 0);
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

test("parseHistory keeps a legacy day (single 'characters' field) exactly as a real user's history has it", () => {
	const raw = JSON.stringify({
		"2026-09-10": { written: { words: 100, characters: 500 }, dailyGoal: 500, metric: "words" },
	});
	assert.deepEqual(parseHistory(raw), {
		"2026-09-10": { written: { words: 100, characters: 500 }, dailyGoal: 500, metric: "words" },
	});
});

test("parseHistory keeps a split-format day (from this version on) with both characters fields, no legacy one", () => {
	const raw = JSON.stringify({
		"2026-09-10": { written: { words: 100, charactersWithSpaces: 600, charactersWithoutSpaces: 500 } },
	});
	assert.deepEqual(parseHistory(raw), {
		"2026-09-10": { written: { words: 100, charactersWithSpaces: 600, charactersWithoutSpaces: 500 } },
	});
});

test("parseHistory drops a day with neither the legacy nor a complete split characters field", () => {
	const raw = JSON.stringify({
		// Only one half of the split — as unusable as having neither.
		"2026-09-10": { written: { words: 100, charactersWithSpaces: 600 } },
		"2026-09-11": { written: { words: 100 } },
	});
	assert.deepEqual(parseHistory(raw), {});
});

test("parseHistory keeps dailyGoal/metric when well-formed, drops just that field (not the whole day) when malformed", () => {
	const raw = JSON.stringify({
		"2026-09-10": { written: { words: 100, characters: 500 }, dailyGoal: 500, metric: "words" },
		"2026-09-11": { written: { words: 40, characters: 200 }, dailyGoal: "oops", metric: "sentences" },
	});
	const parsed = parseHistory(raw);
	assert.deepEqual(parsed["2026-09-10"], {
		written: { words: 100, characters: 500 },
		dailyGoal: 500,
		metric: "words",
	});
	// written survives even though dailyGoal/metric were malformed.
	assert.deepEqual(parsed["2026-09-11"], { written: { words: 40, characters: 200 } });
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
		"2026-09-10": { written: { words: 100, charactersWithSpaces: 600, charactersWithoutSpaces: 550 } },
	};
	assert.equal(writtenFor(history, "2026-09-10", "words", false), 100);
	assert.equal(writtenFor(history, "2026-09-10", "characters", false), 550);
	assert.equal(writtenFor(history, "2026-09-10", "characters", true), 600);
	assert.equal(writtenFor(history, "2026-09-11", "words", false), 0);
});

test("writtenFor falls back to a legacy day's single characters field regardless of the spaces setting", () => {
	const history: GoalHistory = {
		"2026-09-10": { written: { words: 100, characters: 550 } },
	};
	assert.equal(writtenFor(history, "2026-09-10", "characters", false), 550);
	assert.equal(writtenFor(history, "2026-09-10", "characters", true), 550);
});

test("resolveDayGoal uses the day's own recorded goal and metric, not the live/fallback ones", () => {
	const history: GoalHistory = {
		// Recorded when the goal was 500 words — later changing the setting to
		// 50 must not turn this into a "met" day.
		"2026-09-10": { written: { words: 55, characters: 300 }, dailyGoal: 500, metric: "words" },
	};
	const result = resolveDayGoal(history, "2026-09-10", { dailyGoal: 50, metric: "words" }, false);
	assert.deepEqual(result, { written: 55, dailyGoal: 500 });
});

test("resolveDayGoal falls back to the given goal/metric for a day with no recorded one, or no entry at all", () => {
	const history: GoalHistory = {
		"2026-09-10": { written: { words: 55, characters: 300 } }, // recorded before this was tracked
	};
	assert.deepEqual(resolveDayGoal(history, "2026-09-10", { dailyGoal: 50, metric: "words" }, false), {
		written: 55,
		dailyGoal: 50,
	});
	assert.deepEqual(resolveDayGoal(history, "2026-09-11", { dailyGoal: 50, metric: "words" }, false), {
		written: 0,
		dailyGoal: 50,
	});
});

test("resolveDayGoal reads the written amount in the day's own recorded metric", () => {
	const history: GoalHistory = {
		"2026-09-10": {
			written: { words: 55, charactersWithSpaces: 350, charactersWithoutSpaces: 300 },
			dailyGoal: 250,
			metric: "characters",
		},
	};
	// Even though the fallback metric is "words", this day was tracked in
	// characters, so its own metric wins for both the written amount and the goal.
	const result = resolveDayGoal(history, "2026-09-10", { dailyGoal: 50, metric: "words" }, false);
	assert.deepEqual(result, { written: 300, dailyGoal: 250 });
	// includeSpaces is always the live setting, not day-specific.
	const withSpaces = resolveDayGoal(history, "2026-09-10", { dailyGoal: 50, metric: "words" }, true);
	assert.deepEqual(withSpaces, { written: 350, dailyGoal: 250 });
});

test("writtenBetween sums written amounts over an inclusive date range", () => {
	const history: GoalHistory = {
		"2026-09-07": { written: { words: 100, characters: 500 } }, // outside the range
		"2026-09-08": { written: { words: 200, charactersWithSpaces: 950, charactersWithoutSpaces: 900 } },
		"2026-09-09": { written: { words: 50, characters: 250 } },
		"2026-09-10": { written: { words: 300, characters: 1200 } }, // outside the range
	};
	assert.equal(writtenBetween(history, "2026-09-08", "2026-09-09", "words", false), 250);
	assert.equal(writtenBetween(history, "2026-09-08", "2026-09-09", "characters", false), 1150);
	// The split day contributes its "with spaces" number; the legacy day falls back to its one number either way.
	assert.equal(writtenBetween(history, "2026-09-08", "2026-09-09", "characters", true), 1200);
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
	assert.deepEqual(writtenAcrossFiles(baselineText, current), {
		words: 2,
		// 10, not 9: the run reaches back to claim the space after "y" too.
		charactersWithSpaces: 10,
		charactersWithoutSpaces: 8,
	});
});

test("writtenAcrossFiles: deleting an old paragraph never lowers today's count, even within the same file", () => {
	const baselineText: FileText = { "doc.md": "old1 old2 old3 old4 old5" };
	// The whole old paragraph is gone; two new words were typed in its place.
	const current: FileText = { "doc.md": "new1 new2" };
	assert.deepEqual(writtenAcrossFiles(baselineText, current), {
		words: 2,
		charactersWithSpaces: 9,
		charactersWithoutSpaces: 8,
	});
});

test("writtenAcrossFiles: charactersWithSpaces reflects the real whitespace actually typed, not one space per word", () => {
	// A brand-new note: two spaces after the first sentence, a blank line
	// before the second paragraph — a naive "rejoin the inserted words with a
	// single space" reconstruction would undercount this against the file's
	// real total; the run-based measurement must not.
	const baselineText: FileText = {};
	const current: FileText = { "doc.md": "This is a new text.  Second sentence.\n\nNew paragraph." };
	const result = writtenAcrossFiles(baselineText, current);
	assert.equal(result.charactersWithSpaces, current["doc.md"].length);
});

test("writtenAcrossFiles: appending a new word to the end of existing text counts the connecting space too", () => {
	const baselineText: FileText = { "doc.md": "This is a new text." };
	const current: FileText = { "doc.md": "This is a new text. this" };
	const result = writtenAcrossFiles(baselineText, current);
	assert.equal(result.words, 1);
	assert.equal(result.charactersWithoutSpaces, 4); // "this"
	// Exact: baseline is current's unchanged prefix, so growth is precisely the tail appended to it.
	assert.equal(result.charactersWithSpaces, current["doc.md"].length - baselineText["doc.md"].length);
});

test("writtenAcrossFiles: deleting part of what was typed today still lowers that file's own count", () => {
	const baselineText: FileText = { "doc.md": "a b c" };
	// "x y" was typed in, then "x" was deleted before this scan ran.
	const current: FileText = { "doc.md": "a b c y" };
	assert.deepEqual(writtenAcrossFiles(baselineText, current), {
		words: 1,
		// 2, not 1: the run reaches back to claim the space after "c" too.
		charactersWithSpaces: 2,
		charactersWithoutSpaces: 1,
	});
});

test("writtenAcrossFiles: a brand-new file counts in full; a deleted file contributes 0, not a negative", () => {
	const baselineText: FileText = { "old.md": "a b c d e" };
	const current: FileText = { "new.md": "x y" };
	// old.md dropped out of scope entirely (deleted or moved out) — no negative
	// carry-over; new.md had no baseline, so all of it counts.
	assert.deepEqual(writtenAcrossFiles(baselineText, current), {
		words: 2,
		charactersWithSpaces: 3,
		charactersWithoutSpaces: 2,
	});
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
	assert.equal(writtenBetween(history, "2026-09-08", "2026-09-08", "words", false), 200);
	assert.equal(writtenBetween(history, "2026-09-01", "2026-09-07", "words", false), 0);
	assert.equal(writtenBetween({}, "2026-09-01", "2026-09-30", "words", false), 0);
});
