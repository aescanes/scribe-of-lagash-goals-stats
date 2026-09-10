// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import assert from "node:assert/strict";
import { test } from "node:test";
import { isExcluded, SCRIBE_GENERATED_PREFIX } from "../../src/data/exclusion";

test("SCRIBE_GENERATED_PREFIX is the (SL) marker", () => {
	assert.equal(SCRIBE_GENERATED_PREFIX, "(SL)");
});

test("Scribe-generated files and folders are always excluded", () => {
	assert.equal(isExcluded("Stories/City/(SL) StoryLines.md", []), true);
	assert.equal(isExcluded("(SL) Story Outline.md", []), true);
	assert.equal(isExcluded("Stories/(SL) Planning/Chapter 1.md", []), true);
});

test("ordinary notes are not excluded by default", () => {
	assert.equal(isExcluded("Stories/City/Chapter 1.md", []), false);
	assert.equal(isExcluded("Notes/SL notes.md", []), false); // prefix must be at the start
});

test("a user note entry matches with or without the .md extension", () => {
	assert.equal(isExcluded("Notes/Scratchpad.md", ["Notes/Scratchpad"]), true);
	assert.equal(isExcluded("Notes/Scratchpad.md", ["Notes/Scratchpad.md"]), true);
	assert.equal(isExcluded("Notes/Other.md", ["Notes/Scratchpad"]), false);
});

test("a user folder entry excludes everything inside it", () => {
	assert.equal(isExcluded("Archive/Old draft.md", ["Archive"]), true);
	assert.equal(isExcluded("Archive/2024/Draft.md", ["Archive"]), true);
	assert.equal(isExcluded("Archive.md", ["Archive"]), true); // the folder note itself
	assert.equal(isExcluded("Archived/Draft.md", ["Archive"]), false); // no partial-segment match
});

test("entries tolerate stray slashes and whitespace", () => {
	assert.equal(isExcluded("Archive/Draft.md", ["  /Archive/  "]), true);
	assert.equal(isExcluded("Archive/Draft.md", [""]), false);
});

test("an empty path is never excluded", () => {
	assert.equal(isExcluded("", ["Archive"]), false);
});
