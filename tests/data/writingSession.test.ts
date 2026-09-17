// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDuration, sessionProgress } from "../../src/data/writingSession";

test("formatDuration: m:ss under an hour, minutes unpadded", () => {
	assert.equal(formatDuration(0), "0:00");
	assert.equal(formatDuration(5), "0:05");
	assert.equal(formatDuration(65), "1:05");
	assert.equal(formatDuration(15 * 60), "15:00");
	assert.equal(formatDuration(59 * 60 + 59), "59:59");
});

test("formatDuration: h:mm:ss at an hour or beyond, hours unpadded", () => {
	assert.equal(formatDuration(60 * 60), "1:00:00");
	assert.equal(formatDuration(60 * 60 + 61), "1:01:01");
	assert.equal(formatDuration(2 * 3600 + 5 * 60 + 9), "2:05:09");
});

test("formatDuration: negative or fractional input is floored at zero and rounded", () => {
	assert.equal(formatDuration(-5), "0:00");
	assert.equal(formatDuration(59.6), "1:00");
});

test("sessionProgress: 0 at the start, 1 once time is up", () => {
	assert.equal(sessionProgress(600, 600), 0);
	assert.equal(sessionProgress(0, 600), 1);
	assert.equal(sessionProgress(300, 600), 0.5);
});

test("sessionProgress: clamps instead of going negative or past 1", () => {
	assert.equal(sessionProgress(700, 600), 0); // remaining somehow exceeds total
	assert.equal(sessionProgress(-10, 600), 1); // remaining somehow went negative
});

test("sessionProgress: 0 for a zero-length session rather than dividing by zero", () => {
	assert.equal(sessionProgress(0, 0), 0);
});
