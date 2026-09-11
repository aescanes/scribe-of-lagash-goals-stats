// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import assert from "node:assert/strict";
import { test } from "node:test";
import {
	dateKey,
	GoalHistory,
	parseHistory,
	serializeHistory,
	writtenBetween,
	writtenFor,
} from "../../src/data/goalHistory";

test("dateKey is the local YYYY-MM-DD, zero-padded", () => {
	assert.equal(dateKey(new Date(2026, 0, 5)), "2026-01-05");
	assert.equal(dateKey(new Date(2026, 10, 30)), "2026-11-30");
});

test("parseHistory keeps only well-formed date-keyed day records", () => {
	const raw = JSON.stringify({
		"2026-09-10": { total: { words: 100, characters: 500 }, written: { words: 100, characters: 500 } },
		"not-a-date": { total: { words: 1, characters: 1 }, written: { words: 1, characters: 1 } },
		"2026-09-11": { total: { words: "oops" } },
		"2026-09-12": { total: { words: 300, characters: 900 }, written: { words: 200, characters: 400 } },
	});
	assert.deepEqual(parseHistory(raw), {
		"2026-09-10": { total: { words: 100, characters: 500 }, written: { words: 100, characters: 500 } },
		"2026-09-12": { total: { words: 300, characters: 900 }, written: { words: 200, characters: 400 } },
	});
});

test("parseHistory tolerates invalid JSON and non-object input", () => {
	assert.deepEqual(parseHistory("{not json"), {});
	assert.deepEqual(parseHistory("42"), {});
	assert.deepEqual(parseHistory("null"), {});
});

test("serializeHistory sorts keys chronologically", () => {
	const zero = { words: 0, characters: 0 };
	const history: GoalHistory = {
		"2026-09-12": { total: zero, written: { words: 3, characters: 3 } },
		"2026-09-10": { total: zero, written: { words: 1, characters: 1 } },
		"2026-09-11": { total: zero, written: { words: 2, characters: 2 } },
	};
	const keys = Object.keys(JSON.parse(serializeHistory(history)) as object);
	assert.deepEqual(keys, ["2026-09-10", "2026-09-11", "2026-09-12"]);
});

test("writtenFor reads the requested metric, 0 when the day is missing", () => {
	const history: GoalHistory = {
		"2026-09-10": { total: { words: 100, characters: 550 }, written: { words: 100, characters: 550 } },
	};
	assert.equal(writtenFor(history, "2026-09-10", "words"), 100);
	assert.equal(writtenFor(history, "2026-09-10", "characters"), 550);
	assert.equal(writtenFor(history, "2026-09-11", "words"), 0);
});

test("writtenBetween sums written amounts over an inclusive date range", () => {
	const zero = { words: 0, characters: 0 };
	const history: GoalHistory = {
		"2026-09-07": { total: zero, written: { words: 100, characters: 500 } }, // outside the range
		"2026-09-08": { total: zero, written: { words: 200, characters: 900 } },
		"2026-09-09": { total: zero, written: { words: 50, characters: 250 } },
		"2026-09-10": { total: zero, written: { words: 300, characters: 1200 } }, // outside the range
	};
	assert.equal(writtenBetween(history, "2026-09-08", "2026-09-09", "words"), 250);
	assert.equal(writtenBetween(history, "2026-09-08", "2026-09-09", "characters"), 1150);
});

test("writtenBetween is inclusive of a single-day range and 0 for an empty one", () => {
	const history: GoalHistory = {
		"2026-09-08": { total: { words: 0, characters: 0 }, written: { words: 200, characters: 900 } },
	};
	assert.equal(writtenBetween(history, "2026-09-08", "2026-09-08", "words"), 200);
	assert.equal(writtenBetween(history, "2026-09-01", "2026-09-07", "words"), 0);
	assert.equal(writtenBetween({}, "2026-09-01", "2026-09-30", "words"), 0);
});
