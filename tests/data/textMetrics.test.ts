// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import assert from "node:assert/strict";
import { test } from "node:test";
import { countCharacters, countWords, measure, measureBoth, stripFrontmatter } from "../../src/data/textMetrics";

test("stripFrontmatter removes a leading YAML block only", () => {
	assert.equal(stripFrontmatter("---\ntitle: x\n---\nHello world"), "Hello world");
	assert.equal(stripFrontmatter("No frontmatter here"), "No frontmatter here");
	// A --- later in the body is not frontmatter.
	assert.equal(stripFrontmatter("Body\n---\nMore"), "Body\n---\nMore");
});

test("countWords counts whitespace-separated runs, frontmatter excluded", () => {
	assert.equal(countWords("---\ntitle: x\n---\nOne two three"), 3);
	assert.equal(countWords("  spaced   out  words \n\n here "), 4);
	assert.equal(countWords(""), 0);
	assert.equal(countWords("---\nonly: frontmatter\n---\n"), 0);
});

test("countWords treats markdown and punctuation as part of the word", () => {
	assert.equal(countWords("# Heading"), 2);
	assert.equal(countWords("well-being isn't one"), 3);
});

test("countCharacters counts body characters including inner spaces", () => {
	assert.equal(countCharacters("hello world"), 11);
	assert.equal(countCharacters("---\ntitle: x\n---\n  trimmed  "), "trimmed".length);
	assert.equal(countCharacters(""), 0);
});

test("measure dispatches on the metric", () => {
	assert.equal(measure("one two three", "words"), 3);
	assert.equal(measure("one two three", "characters"), 13);
});

test("measureBoth returns both counts from one pass, frontmatter excluded", () => {
	assert.deepEqual(measureBoth("---\ntitle: x\n---\none two three"), { words: 3, characters: 13 });
	assert.deepEqual(measureBoth(""), { words: 0, characters: 0 });
});
