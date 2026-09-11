// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import assert from "node:assert/strict";
import { test } from "node:test";
import { formatCount } from "../../src/data/countFormat";

test("words: locale-grouped number with a short unit, singular below two", () => {
	assert.equal(formatCount(1234, "words", false), "1,234 words");
	assert.equal(formatCount(1, "words", false), "1 word");
	assert.equal(formatCount(0, "words", false), "0 words");
});

test("characters abbreviate to char/chars", () => {
	assert.equal(formatCount(5000, "characters", false), "5,000 chars");
	assert.equal(formatCount(1, "characters", true), "1 char");
});

test("folder vs. note is not distinguished in the text", () => {
	assert.equal(formatCount(1234, "words", true), formatCount(1234, "words", false));
});
