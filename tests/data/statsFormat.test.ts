// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import assert from "node:assert/strict";
import { test } from "node:test";
import { formatTarget, formatPages, formatReadTime, targetProgress, noteRatios } from "../../src/data/statsFormat";

test("formatReadTime shows minutes, then hours and minutes", () => {
	assert.equal(formatReadTime(0), "—");
	assert.equal(formatReadTime(1), "1 min");
	assert.equal(formatReadTime(59), "59 min");
	assert.equal(formatReadTime(60), "1 h");
	assert.equal(formatReadTime(75), "1 h 15 min");
});

test("formatPages shows whole pages and a dash for none", () => {
	assert.equal(formatPages(0), "—");
	assert.equal(formatPages(2), (2).toLocaleString());
});

test("noteRatios divides to one decimal, with a dash for a zero divisor", () => {
	const stats = { size: 4670, words: 4670, readMinutes: 20, syllables: 9728, sentences: 606, paragraphs: 53, pages: 19 };
	assert.deepEqual(noteRatios(stats).map((r) => r.value), ["7.7", "11.4", "2.1"]);
	const empty = { size: 0, words: 0, readMinutes: 0, syllables: 0, sentences: 0, paragraphs: 0, pages: 0 };
	assert.deepEqual(noteRatios(empty).map((r) => r.value), ["—", "—", "—"]);
});

test("targetProgress gives percent, a clamped bar fraction and what remains", () => {
	assert.deepEqual(targetProgress(4670, 5000), { percent: 93, fraction: 0.934, remaining: 330 });
	assert.deepEqual(targetProgress(6000, 5000), { percent: 120, fraction: 1, remaining: 0 });
	assert.deepEqual(targetProgress(10, 0), { percent: 0, fraction: 0, remaining: 0 });
});

test("formatTarget groups digits and dashes a missing target", () => {
	assert.equal(formatTarget(null), "—");
	assert.equal(formatTarget(5000), (5000).toLocaleString());
});
