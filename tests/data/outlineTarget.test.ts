// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import assert from "node:assert/strict";
import { test } from "node:test";
import { findOutlineTarget, noteSegments, parseOutlineTargetRows } from "../../src/data/outlineTarget";

const TABLE = [
	"| Act | Chapter | Scene | Line | Synopsis | Target | Comments |",
	"| --- | --- | --- | --- | --- | --- | --- |",
	"| I | 1 | 1 | Main | The start | 5,000 | |",
	"| I | 1 | 2 | Main | Next | 800 | |",
	"| II | 2 |  | Main | A \\| pipe | 1200 | |",
	"| I | 3 | 1 | Main | none yet | | |",
	"|   |   |   |   |   | 900 | blank row |",
	"",
	"after the table",
].join("\n");

test("parseOutlineTargetRows reads position and target, dropping unnumbered rows", () => {
	const rows = parseOutlineTargetRows(TABLE);
	assert.equal(rows.length, 4);
	assert.deepEqual(rows.map((r) => r.target), [5000, 800, 1200, null]);
	assert.deepEqual(rows[0].segments.map((s) => s.number), [1, 1, 1]);
	assert.deepEqual(rows[2].segments.map((s) => s.number), [2, 2]);
});

test("parseOutlineTargetRows copes with no table, no Target column, and bracket shorthand", () => {
	assert.deepEqual(parseOutlineTargetRows("just text"), []);
	assert.deepEqual(parseOutlineTargetRows("| Chapter |\n| --- |\n| 1 |"), []);
	const rows = parseOutlineTargetRows("| Chapter | Target |\n| --- | --- |\n| [1] | [700] |");
	assert.equal(rows[0].target, 700);
});

test("noteSegments drops label words and the .md extension", () => {
	assert.deepEqual(noteSegments("Act I/Chapter 1 - Start/Scene 2.md").map((s) => s.number), [1, 1, 2]);
	assert.deepEqual(noteSegments("Acto II/Capítulo 3/Escena IV.md").map((s) => s.number), [2, 3, 4]);
	assert.deepEqual(noteSegments("Chapter 5.md").map((s) => s.number), [5]);
});

test("findOutlineTarget matches by structure and numbers, roman or digits", () => {
	const rows = parseOutlineTargetRows(TABLE);
	assert.equal(findOutlineTarget(rows, "Act I/Chapter 1/Scene 1.md"), 5000);
	assert.equal(findOutlineTarget(rows, "Act 1/Chapter 1/Scene 2.md"), 800);
	assert.equal(findOutlineTarget(rows, "Acto I/Capítulo 1/Escena II.md"), 800);
	assert.equal(findOutlineTarget(rows, "Act II/Chapter 2 - Title.md"), 1200);
});

test("findOutlineTarget is null for unplanned, mismatched-depth or targetless notes", () => {
	const rows = parseOutlineTargetRows(TABLE);
	assert.equal(findOutlineTarget(rows, "Act I/Chapter 3/Scene 1.md"), null);
	assert.equal(findOutlineTarget(rows, "Act I/Chapter 9/Scene 1.md"), null);
	assert.equal(findOutlineTarget(rows, "Chapter 1.md"), null);
	assert.equal(findOutlineTarget(rows, "Prologue.md"), null);
});

test("a non-numeric Act matches by its text", () => {
	const rows = parseOutlineTargetRows("| Act | Chapter | Target |\n| --- | --- | --- |\n| Beginning | 1 | 300 |");
	assert.equal(findOutlineTarget(rows, "Act Beginning/Chapter 1.md"), 300);
	assert.equal(findOutlineTarget(rows, "Act Ending/Chapter 1.md"), null);
});

test("a Status column is ignored", () => {
	const rows = parseOutlineTargetRows("| Chapter | Scene | Target | Status |\n| --- | --- | --- | --- |\n| 1 | 1 | 50 | Done |");
	assert.equal(findOutlineTarget(rows, "Chapter 1/Scene 1.md"), 50);
});
