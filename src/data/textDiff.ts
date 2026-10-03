// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

// Pure word-level diff — no Obsidian imports, unit-tested. Powers "written
// today": comparing the day's starting text against the current text so
// deleting old, already-existing text never counts as negative progress,
// while deleting part of what was added *today* correctly disappears from
// today's count — the same distinction `git diff` draws between removed and
// inserted lines, applied to words instead of lines.

/** A word token plus its exact `[start, end)` offset in the text it was found
 *  in — the offset is what lets `insertedText` recover a run's real internal
 *  whitespace instead of just its word content. */
interface Token {
	word: string;
	start: number;
	end: number;
}

/** Same tokenization `countWords` uses: any run of non-whitespace is a word,
 *  in the order it appears, each with its exact position. */
function tokenize(text: string): Token[] {
	const tokens: Token[] = [];
	const re = /\S+/g;
	let match: RegExpExecArray | null;
	while ((match = re.exec(text)) !== null) {
		tokens.push({ word: match[0], start: match.index, end: match.index + match[0].length });
	}
	return tokens;
}

/**
 * Above this many combined baseline+current words, `insertedText` returns
 * `null` instead of running the diff — a coarse, cheap pre-check against a
 * genuinely huge note (an imported manuscript, say), before the algorithm
 * itself even starts. `MAX_EDIT_DISTANCE` below is what actually bounds the
 * expensive case.
 */
export const DIFF_WORD_LIMIT = 8_000;

/**
 * Myers' algorithm backtracks through one recorded snapshot per edit-distance
 * step `d`, so both its time *and* memory are O((n+m)·d) — fine for a normal
 * editing session, where most of a note stays untouched and `d` is small
 * regardless of the note's length, but a note replaced almost entirely (`d`
 * approaching `n+m`) turns that into O((n+m)²) of both: gigabytes of
 * snapshots for a note of even a few thousand words. Aborting once `d` alone
 * passes this bound — independent of how long the note is — keeps that worst
 * case's memory to roughly `MAX_EDIT_DISTANCE × (2 × DIFF_WORD_LIMIT) × 4
 * bytes` (around 130 MB at the current values, as a momentary,
 * garbage-collected spike rather than a sustained cost) — a bound that
 * matters more here than on desktop alone since this plugin also has to run
 * on mobile. Note that a substitution (replacing a word with a different one)
 * costs *two* edits, not one — a scattered same-day revision touching a
 * thousand individual words could need close to this limit on its own even
 * though it doesn't feel like "a thousand edits" while typing it. A note that
 * does exceed it that day falls back to a plainer measure for just that one
 * file, for the rest of that day.
 */
const MAX_EDIT_DISTANCE = 2_000;

/**
 * What's new in `current` since `baseline`: a flat list of the inserted words
 * themselves, and separately the actual runs of newly-typed text they came
 * from — verbatim slices of `current`, so a run's own internal whitespace (a
 * double space after a period, a blank line between two new paragraphs, …)
 * survives exactly rather than being discarded and reassembled with a single
 * space between every word. `words`/a "characters without spaces" count don't
 * care about that distinction, but a "characters with spaces" count would
 * silently under-report against the note's real total without it. Two words
 * are only part of the same run when they're genuinely adjacent in `current`
 * — an old, unchanged word sitting between two new ones starts a new run
 * rather than bridging them, and disjoint runs are never stitched together
 * with an invented separator between them.
 */
export interface InsertedText {
	/** The inserted words themselves, in the order they appear in `current`. */
	words: string[];
	/**
	 * Contiguous runs of newly-typed text, each a verbatim slice of `current`
	 * — extended backward to also claim the whitespace gap between the run
	 * and whichever token precedes it (if any), on top of the run's own
	 * internal whitespace. That gap is the separator the run needed typing
	 * *some* new whitespace against an untouched neighbor to stay readable
	 * (`"a b c"` gaining a word becomes `"a new b c"`, not `"anew b c"`), so
	 * attributing it to the run is right far more often than leaving it
	 * unclaimed. It's deliberately not also extended forward past the run's
	 * own last token: a lone inserted word sitting between two untouched
	 * neighbors only ever needs *one* new separator, not two, and claiming
	 * both sides would double-count the very same keystroke — whichever
	 * single side actually got typed can't be told apart from the other, so
	 * this picks one consistently rather than risking counting a typed
	 * character twice.
	 */
	runs: string[];
}

/**
 * `null` when the inputs are too large, or too different from one another, to
 * diff cheaply — see `DIFF_WORD_LIMIT` and `MAX_EDIT_DISTANCE`.
 */
export function insertedText(baseline: string, current: string): InsertedText | null {
	const baselineWords = tokenize(baseline).map((t) => t.word);
	const currentTokens = tokenize(current);
	const currentWords = currentTokens.map((t) => t.word);

	if (baselineWords.length + currentWords.length > DIFF_WORD_LIMIT) return null;

	let indices: number[];
	if (baselineWords.length === 0) {
		indices = currentWords.map((_, i) => i);
	} else if (currentWords.length === 0) {
		indices = [];
	} else {
		const result = diffInsertions(baselineWords, currentWords);
		if (result === null) return null;
		indices = result;
	}

	return {
		words: indices.map((i) => currentWords[i]),
		runs: groupConsecutive(indices).map(([start, end]) => {
			const from = start > 0 ? currentTokens[start - 1].end : currentTokens[start].start;
			return current.slice(from, currentTokens[end].end);
		}),
	};
}

/**
 * The words in `current` that are not part of the longest common (in-order)
 * subsequence shared with `baseline` — words genuinely new since the
 * baseline, not ones that already existed there and just moved, repeated
 * elsewhere, or sit next to a deletion. Returned in the order they appear in
 * `current`. A thin projection of `insertedText` onto just the word list, for
 * callers that only need the words themselves — `insertedText`'s run
 * boundaries make no difference to this result. `null` under the same
 * conditions as `insertedText`.
 */
export function insertedWords(baseline: string, current: string): string[] | null {
	return insertedText(baseline, current)?.words ?? null;
}

/** Groups a list of indices, given in ascending order, into inclusive `[start, end]` runs of consecutive integers. */
function groupConsecutive(indices: number[]): Array<[number, number]> {
	const runs: Array<[number, number]> = [];
	for (const i of indices) {
		const last = runs[runs.length - 1];
		if (last && i === last[1] + 1) last[1] = i;
		else runs.push([i, i]);
	}
	return runs;
}

/**
 * Myers' greedy diff algorithm: finds the shortest edit script turning `a`
 * into `b`, then returns just the indices (into `b`) of the inserted tokens,
 * in order. See Myers, "An O(ND) Difference Algorithm and Its Variations"
 * (1986) — the same algorithm behind `diff`/`git diff`.
 */
function diffInsertions(a: string[], b: string[]): number[] | null {
	const n = a.length;
	const m = b.length;
	const max = n + m;
	const offset = max;
	// v[offset + k]: the furthest x reached on diagonal k (x - y = k) so far.
	// Int32Array rather than a plain array halves the memory of the one
	// snapshot kept per edit-distance step — see MAX_EDIT_DISTANCE's doc comment.
	const v = new Int32Array(2 * max + 1);
	const trace: Int32Array[] = [];

	for (let d = 0; d <= Math.min(max, MAX_EDIT_DISTANCE); d++) {
		trace.push(v.slice());
		for (let k = -d; k <= d; k += 2) {
			let x: number;
			if (k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1])) {
				x = v[offset + k + 1]; // came from an insertion (diagonal k + 1)
			} else {
				x = v[offset + k - 1] + 1; // came from a deletion (diagonal k - 1)
			}
			let y = x - k;
			while (x < n && y < m && a[x] === b[y]) {
				x++;
				y++;
			}
			v[offset + k] = x;
			if (x >= n && y >= m) return backtrack(trace, n, m, offset, d);
		}
	}
	// The two texts are too different from one another to align within
	// MAX_EDIT_DISTANCE — the caller falls back to a plainer measure.
	return null;
}

/**
 * Walks the recorded furthest-reaching paths backward from (n, m) to (0, 0),
 * collecting the index (into `b`) inserted at each step (those found via a
 * `k + 1` predecessor; a `k - 1` predecessor is a deletion, contributing
 * nothing here). `trace[d]` holds `v` as it stood after distance `d - 1` was
 * fully explored — exactly the values distance `d`'s own step read from.
 */
function backtrack(trace: Int32Array[], n: number, m: number, offset: number, finalD: number): number[] {
	let x = n;
	let y = m;
	const inserted: number[] = [];

	for (let d = finalD; d > 0; d--) {
		const v = trace[d];
		const k = x - y;
		const cameFromInsertion = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]);
		const prevK = cameFromInsertion ? k + 1 : k - 1;
		const prevX = v[offset + prevK];
		const stepX = cameFromInsertion ? prevX : prevX + 1;

		// Undo this step's diagonal run (the matched words) back to the point
		// right after the single insertion/deletion.
		while (x > stepX) {
			x--;
			y--;
		}
		if (cameFromInsertion) inserted.push(y - 1);

		x = prevX;
		y = prevX - prevK;
	}

	inserted.reverse();
	return inserted;
}
