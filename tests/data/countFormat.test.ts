// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import assert from "node:assert/strict";
import { test } from "node:test";
import { formatCount } from "../../src/data/countFormat";

test("notes are wrapped in parentheses", () => {
	assert.equal(formatCount(1234, "words", false), "(1,234 words)");
	assert.equal(formatCount(1, "words", false), "(1 word)");
	assert.equal(formatCount(0, "words", false), "(0 words)");
});

test("folders are wrapped in brackets", () => {
	assert.equal(formatCount(1234, "words", true), "[1,234 words]");
	assert.equal(formatCount(1, "words", true), "[1 word]");
});

test("characters use the character noun, singular below two", () => {
	assert.equal(formatCount(5000, "characters", false), "(5,000 characters)");
	assert.equal(formatCount(1, "characters", true), "[1 character]");
});
