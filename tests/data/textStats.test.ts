// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import assert from "node:assert/strict";
import { test } from "node:test";
import {
	computeNoteStats,
	countParagraphs,
	countSentences,
	countSyllables,
	countTextSyllables,
	pageCount,
	readMinutes,
	stripMarkdown,
} from "../../src/data/textStats";

test("stripMarkdown drops syntax but keeps the prose", () => {
	assert.equal(stripMarkdown("---\na: b\n---\n**bold** and [[Note|alias]]").trim(), "bold and alias");
	assert.equal(stripMarkdown("[link](http://x.y) text").trim(), "link text");
	assert.equal(stripMarkdown("# Heading\nBody").trim(), "Body");
	assert.equal(stripMarkdown("a\n```\ncode\n```\nb").replace(/\s+/g, " ").trim(), "a b");
});

test("countSyllables handles plain, silent-e and -le words", () => {
	assert.equal(countSyllables("cat"), 1);
	assert.equal(countSyllables("make"), 1);
	assert.equal(countSyllables("table"), 2);
	assert.equal(countSyllables("beautiful"), 3);
	assert.equal(countSyllables("walked"), 1);
	assert.equal(countSyllables("makes"), 1);
	assert.equal(countSyllables("the"), 1);
	assert.equal(countSyllables("rhythm"), 1);
});

test("countSyllables ignores punctuation and empty input", () => {
	assert.equal(countSyllables("cat,"), 1);
	assert.equal(countSyllables("123"), 0);
	assert.equal(countSyllables(""), 0);
});

test("countSyllables counts accented Spanish vowels and keeps diphthongs", () => {
	assert.equal(countSyllables("cielo"), 2);
	assert.equal(countSyllables("canción"), 2);
});

test("countTextSyllables sums over words and skips markdown", () => {
	assert.equal(countTextSyllables("# Title\nThe cat sat."), 3);
	assert.equal(countTextSyllables(""), 0);
});

test("countSentences splits on terminators", () => {
	assert.equal(countSentences("One. Two! Three?"), 3);
	assert.equal(countSentences("No terminator here"), 1);
	assert.equal(countSentences(""), 0);
	assert.equal(countSentences("   \n"), 0);
});

test("countSentences ignores abbreviations, decimals and closing quotes", () => {
	assert.equal(countSentences("Dr. Smith paid 3.5 coins. He left."), 2);
	assert.equal(countSentences('She said "go." Then she left.'), 2);
	assert.equal(countSentences("Wait... what?"), 2);
});

test("countParagraphs counts prose blocks only", () => {
	assert.equal(countParagraphs("One.\n\nTwo.\n\n\nThree."), 3);
	assert.equal(countParagraphs("# Heading\n\nBody"), 1);
	assert.equal(countParagraphs("---\na: b\n---\n"), 0);
	assert.equal(countParagraphs(""), 0);
	assert.equal(countParagraphs("Line one\nline two"), 1);
});

test("readMinutes rounds up and is zero for nothing", () => {
	assert.equal(readMinutes(0, 200), 0);
	assert.equal(readMinutes(1, 200), 1);
	assert.equal(readMinutes(200, 200), 1);
	assert.equal(readMinutes(201, 200), 2);
	assert.equal(readMinutes(100, 0), 0);
});

test("pageCount rounds up to whole pages", () => {
	assert.equal(pageCount(0, 250), 0);
	assert.equal(pageCount(250, 250), 1);
	assert.equal(pageCount(1, 250), 1);
	assert.equal(pageCount(251, 250), 2);
	assert.equal(pageCount(100, 0), 0);
});

test("computeNoteStats combines every measure", () => {
	const stats = computeNoteStats("---\nx: y\n---\nThe cat sat. It purred.\n\nDone.", {
		metric: "words",
		includeSpaces: false,
	});
	assert.equal(stats.size, 6);
	assert.equal(stats.words, 6);
	assert.equal(stats.readMinutes, 1);
	assert.equal(stats.sentences, 3);
	assert.equal(stats.paragraphs, 2);
	assert.equal(stats.pages, 1);
	assert.equal(stats.syllables, 6);
});

test("computeNoteStats uses characters when asked, read time stays word-based", () => {
	const stats = computeNoteStats("one two three", {
		metric: "characters",
		includeSpaces: true,
	});
	assert.equal(stats.size, 13);
	assert.equal(stats.words, 3);
});
