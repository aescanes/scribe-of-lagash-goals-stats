// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import assert from "node:assert/strict";
import { test } from "node:test";
import { inStoryFolder } from "../../src/data/scope";

test("an empty story folder puts the whole vault in scope", () => {
	assert.equal(inStoryFolder("Anything/Note.md", ""), true);
	assert.equal(inStoryFolder("Note.md", "   "), true);
});

test("the story folder itself and its descendants are in scope", () => {
	assert.equal(inStoryFolder("Story/City", "Story/City"), true);
	assert.equal(inStoryFolder("Story/City/Act 1/Ch 1.md", "Story/City"), true);
});

test("siblings and ancestors of the story folder are out of scope", () => {
	assert.equal(inStoryFolder("Story", "Story/City"), false);
	assert.equal(inStoryFolder("Story/Other/Ch 1.md", "Story/City"), false);
	assert.equal(inStoryFolder("Story/City-notes/Ch 1.md", "Story/City"), false);
});

test("entries tolerate stray slashes", () => {
	assert.equal(inStoryFolder("/Story/City/Ch 1.md/", "/Story/City/"), true);
});
