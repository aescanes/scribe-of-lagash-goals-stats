// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import assert from "node:assert/strict";
import { test } from "node:test";
import {
	countCharactersWithoutSpaces,
	countCharactersWithSpaces,
	countWords,
	measure,
	measureBoth,
	stripFrontmatter,
} from "../../src/data/textMetrics";

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

test("countCharactersWithoutSpaces excludes whitespace between words", () => {
	assert.equal(countCharactersWithoutSpaces("hello world"), 10);
	assert.equal(countCharactersWithoutSpaces("---\ntitle: x\n---\n  trimmed  "), "trimmed".length);
	assert.equal(countCharactersWithoutSpaces("one\ntwo\tthree"), 11);
	assert.equal(countCharactersWithoutSpaces(""), 0);
});

test("countCharactersWithSpaces counts internal whitespace, only the ends trimmed", () => {
	assert.equal(countCharactersWithSpaces("hello world"), 11);
	assert.equal(countCharactersWithSpaces("---\ntitle: x\n---\n  trimmed  "), "trimmed".length);
	assert.equal(countCharactersWithSpaces("one\ntwo\tthree"), 13);
	assert.equal(countCharactersWithSpaces(""), 0);
});

test("measure dispatches on the metric, and on the spaces convention for characters", () => {
	assert.equal(measure("one two three", "words", false), 3);
	assert.equal(measure("one two three", "characters", false), 11);
	assert.equal(measure("one two three", "characters", true), 13);
});

test("measureBoth returns every count from one pass, frontmatter excluded", () => {
	assert.deepEqual(measureBoth("---\ntitle: x\n---\none two three"), {
		words: 3,
		charactersWithSpaces: 13,
		charactersWithoutSpaces: 11,
	});
	assert.deepEqual(measureBoth(""), { words: 0, charactersWithSpaces: 0, charactersWithoutSpaces: 0 });
});
