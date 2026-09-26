// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import assert from "node:assert/strict";
import { test } from "node:test";
import { DIFF_WORD_LIMIT, insertedText, insertedWords } from "../../src/data/textDiff";

test("insertedWords: identical text has nothing new", () => {
	assert.deepEqual(insertedWords("The hero walked in.", "The hero walked in."), []);
});

test("insertedWords: an empty baseline means every word is new", () => {
	assert.deepEqual(insertedWords("", "a b c"), ["a", "b", "c"]);
});

test("insertedWords: an empty current text has nothing new, regardless of the baseline", () => {
	assert.deepEqual(insertedWords("a b c", ""), []);
});

test("insertedWords: appended words are new, the unchanged prefix is not", () => {
	assert.deepEqual(insertedWords("a b c", "a b c d e"), ["d", "e"]);
});

test("insertedWords: prepended words are new, the unchanged suffix is not", () => {
	assert.deepEqual(insertedWords("b c", "a b c"), ["a"]);
});

test("insertedWords: a word inserted mid-sentence is new, its neighbours are not", () => {
	assert.deepEqual(insertedWords("a b d", "a b c d"), ["c"]);
});

test("insertedWords: pure deletions add nothing new", () => {
	assert.deepEqual(insertedWords("a b c d", "a c"), []);
});

test("insertedWords: deleting part of what was added still leaves only the rest as new", () => {
	// Simulates: baseline "a b c", then a sentence "x y" was typed in and one of
	// those two words ("x") was deleted before this scan ran.
	assert.deepEqual(insertedWords("a b c", "a b y c"), ["y"]);
});

test("insertedWords: an old deletion elsewhere never appears alongside a real addition", () => {
	// The two-note scenario collapsed into one call: unrelated old text ("b")
	// is gone, and a genuinely new word ("z") was added.
	assert.deepEqual(insertedWords("a b c", "a c z"), ["z"]);
});

test("insertedWords: a repeated word only counts the extra occurrence as new", () => {
	const result = insertedWords("a a b", "a a a b");
	assert.deepEqual(result, ["a"]);
});

test("insertedWords: reordering counts as one new word, not a wholesale rewrite", () => {
	const result = insertedWords("a b", "b a");
	assert.equal(result?.length, 1);
});

test("insertedWords: returns null instead of diffing past the size limit", () => {
	const big = Array.from({ length: DIFF_WORD_LIMIT }, (_, i) => `w${i}`).join(" ");
	assert.equal(insertedWords(big, big + " one-more-word"), null);
});

test("insertedWords: diffs normally right at the size limit", () => {
	const half = DIFF_WORD_LIMIT / 2;
	const baseline = Array.from({ length: half }, (_, i) => `w${i}`).join(" ");
	assert.deepEqual(insertedWords(baseline, baseline), []);
});

test("insertedWords: returns null when the two texts are almost entirely different, even under the size limit", () => {
	// Well under DIFF_WORD_LIMIT, but with no overlap at all the edit distance
	// (roughly baseline.length + current.length) blows past MAX_EDIT_DISTANCE.
	const size = 2000;
	const baseline = Array.from({ length: size }, (_, i) => `old${i}`).join(" ");
	const current = Array.from({ length: size }, (_, i) => `new${i}`).join(" ");
	assert.equal(insertedWords(baseline, current), null);
});

test("insertedWords: a large but mostly-unchanged note still diffs precisely", () => {
	// Comfortably under DIFF_WORD_LIMIT even with the two appended words added.
	const words = Array.from({ length: 3800 }, (_, i) => `w${i}`);
	const baseline = words.join(" ");
	const current = [...words, "new1", "new2"].join(" ");
	assert.deepEqual(insertedWords(baseline, current), ["new1", "new2"]);
});

test("insertedText: a run's real internal whitespace survives, not just its words", () => {
	// Two spaces after the period and a blank line before the next paragraph —
	// exactly what "characters with spaces" needs to count precisely, unlike
	// the word list, which is naturally blind to how much whitespace ran between tokens.
	// The run also reaches back to claim the gap before it (the two spaces
	// right after "para.") — see `InsertedText.runs`'s doc comment for why.
	const baseline = "First para.";
	const current = "First para.  Second sentence.\n\nNew paragraph here.";
	const result = insertedText(baseline, current);
	assert.deepEqual(result?.words, ["Second", "sentence.", "New", "paragraph", "here."]);
	assert.deepEqual(result?.runs, ["  Second sentence.\n\nNew paragraph here."]);
	// Exact: baseline is current's unchanged prefix, so the run is precisely everything after it.
	assert.equal(result?.runs[0].length, current.length - baseline.length);
});

test("insertedText: separate (non-contiguous) insertions are their own runs, never stitched together", () => {
	// "new1" is inserted mid-sentence, "new2" much later — an unrelated,
	// unchanged word ("c") sits between them in `current`, so they must not be
	// treated as one contiguous run joined by an invented separator. Each run
	// still reaches back to claim its own leading gap (the space after the
	// untouched word before it), but never forward into the other run's gap.
	const baseline = "a b c d";
	const current = "a new1 b c new2 d";
	const result = insertedText(baseline, current);
	assert.deepEqual(result?.words, ["new1", "new2"]);
	assert.deepEqual(result?.runs, [" new1", " new2"]);
});

test("insertedText: an empty baseline's single run is the whole trimmed current text, real spacing included", () => {
	const result = insertedText("", "  Two  spaces   here.  ");
	assert.deepEqual(result?.runs, ["Two  spaces   here."]);
});

test("insertedText: an empty current text has no words and no runs", () => {
	assert.deepEqual(insertedText("a b c", ""), { words: [], runs: [] });
});

test("insertedText: returns null under the same conditions insertedWords does", () => {
	const big = Array.from({ length: DIFF_WORD_LIMIT }, (_, i) => `w${i}`).join(" ");
	assert.equal(insertedText(big, big + " one-more-word"), null);
});
