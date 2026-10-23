// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import assert from "node:assert/strict";
import { test } from "node:test";
import { groupByFolder, StatsRow, sumStats } from "../../src/data/statsTable";
import { normalizeStatus, statusModifier } from "../../src/data/statusLabel";
import type { NoteStats } from "../../src/types";

function stats(size: number, extra: Partial<NoteStats> = {}): NoteStats {
	return { size, words: size, readMinutes: 1, syllables: size * 2, sentences: 1, paragraphs: 1, pages: 0.5, ...extra };
}

function row(path: string, size: number, status = ""): StatsRow {
	return { path, name: path.slice(path.lastIndexOf("/") + 1).replace(/\.md$/, ""), stats: stats(size), status };
}

test("sumStats adds counts and derives read time and pages from the summed words", () => {
	// Two 100-word notes: one page each on their own, but 200 words is one page together.
	const total = sumStats([stats(100, { pages: 1 }), stats(100, { pages: 1 })]);
	assert.equal(total.size, 200);
	assert.equal(total.syllables, 400);
	assert.equal(total.readMinutes, 1);
	assert.equal(total.pages, 1);
	assert.deepEqual(sumStats([]), { size: 0, words: 0, readMinutes: 0, syllables: 0, sentences: 0, paragraphs: 0, pages: 0 });
});

test("groupByFolder puts story-root notes first, then folders in natural order", () => {
	const groups = groupByFolder(
		[
			row("Story/Act/Chapter 10/b.md", 1),
			row("Story/Act/Chapter 2/a.md", 2),
			row("Story/Intro.md", 3),
		],
		"Story",
	);
	assert.deepEqual(groups.map((g) => g.folder), ["", "Act/Chapter 2", "Act/Chapter 10"]);
});

test("groupByFolder sorts notes naturally and rolls up totals", () => {
	const [group] = groupByFolder(
		[row("S/Scene 10.md", 4, "draft"), row("S/Scene 2.md", 6, "draft"), row("S/Scene 3.md", 5, "done")],
		"S",
	);
	assert.deepEqual(group.rows.map((r) => r.name), ["Scene 2", "Scene 3", "Scene 10"]);
	assert.equal(group.totals.size, 15);
});

test("groupByFolder with an empty story folder uses vault-relative folders", () => {
	const groups = groupByFolder([row("Top.md", 1), row("A/B/x.md", 2)], "");
	assert.deepEqual(groups.map((g) => g.folder), ["", "A/B"]);
	assert.deepEqual(groupByFolder([], "S"), []);
});

test("normalizeStatus accepts strings and string lists, nothing else", () => {
	assert.equal(normalizeStatus("  draft "), "draft");
	assert.equal(normalizeStatus(["", "done", "x"]), "done");
	assert.equal(normalizeStatus(3), "");
	assert.equal(normalizeStatus(null), "");
	assert.equal(normalizeStatus(undefined), "");
});

test("statusModifier makes a CSS-safe slug", () => {
	assert.equal(statusModifier("In Progress"), "in-progress");
	assert.equal(statusModifier("Revisión!"), "revision");
	assert.equal(statusModifier(""), "");
});
