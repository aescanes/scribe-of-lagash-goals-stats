// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import assert from "node:assert/strict";
import { test } from "node:test";
import { ImportResult } from "../../../src/data/importSources/importSource";
import { KeepTheRhythmSource } from "../../../src/data/importSources/keepTheRhythm";

const source = new KeepTheRhythmSource();

function backup(dailyActivity: unknown[], schema = "0.2"): string {
	return JSON.stringify({ schema, settings: {}, stats: { dailyActivity } });
}

function days(result: ImportResult) {
	assert.ok("days" in result, "expected days, got " + JSON.stringify(result));
	return result.days;
}

test("a day is the net sum of every file's changes, ignoring the *Start fields", () => {
	const result = source.parse(
		backup([
			{ date: "2026-10-20", wordCountStart: 900, charCountStart: 5000, changes: [{ timeKey: "10:00", w: 30, c: 180 }, { timeKey: "11:00", w: -5, c: -30 }] },
			{ date: "2026-10-20", wordCountStart: 10, charCountStart: 60, changes: [{ timeKey: "12:00", w: 20, c: 120 }] },
		]),
	);
	assert.deepEqual(days(result), [{ date: "2026-10-20", words: 45, charactersWithSpaces: 270 }]);
});

test("a day that nets negative floors at 0 and, with nothing else, is dropped", () => {
	const result = source.parse(
		backup([
			{ date: "2026-10-23", changes: [{ timeKey: "21:00", w: -104, c: -985 }] },
			{ date: "2026-10-24", changes: [{ timeKey: "21:00", w: -10, c: 5 }] },
		]),
	);
	// 10-24 keeps its positive character delta, so it isn't empty; words floor at 0.
	assert.deepEqual(days(result), [{ date: "2026-10-24", words: 0, charactersWithSpaces: 5 }]);
});

test("rows with no changes, and days that net to zero, are not imported", () => {
	const result = source.parse(
		backup([
			{ date: "2026-10-21", changes: [] },
			{ date: "2026-10-22", changes: [{ timeKey: "10:00", w: 5, c: 20 }, { timeKey: "10:05", w: -5, c: -20 }] },
		]),
	);
	assert.deepEqual(days(result), []);
});

test("invalid dates and malformed rows are ignored; days come back sorted", () => {
	const result = source.parse(
		backup([
			{ date: "2026-10-25", changes: [{ timeKey: "1", w: 2, c: 10 }] },
			{ date: "not-a-date", changes: [{ timeKey: "1", w: 9, c: 9 }] },
			"junk",
			{ date: "2026-10-19", changes: [{ timeKey: "1", w: 3, c: 15 }, "junk", { w: "x" }] },
		]),
	);
	assert.deepEqual(
		days(result).map((d) => d.date),
		["2026-10-19", "2026-10-25"],
	);
});

test("rejects bad JSON, an unknown schema, and a file with no daily activity", () => {
	assert.ok("error" in source.parse("{nope"));
	assert.ok("error" in source.parse(backup([], "9.9")));
	assert.ok("error" in source.parse(JSON.stringify({ schema: "0.2", stats: {} })));
	assert.ok("error" in source.parse("[]"));
});

test("declares that its characters are counted with spaces", () => {
	assert.equal(source.charactersConvention, "withSpaces");
});
