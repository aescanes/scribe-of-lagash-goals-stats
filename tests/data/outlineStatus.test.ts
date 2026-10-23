// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import assert from "node:assert/strict";
import { test } from "node:test";
import { findOutlineStatus, noteSegments, parseOutlineStatusRows } from "../../src/data/outlineStatus";

const TABLE = [
	"| Act | Chapter | Scene | Line | Synopsis | Status | Comments |",
	"| --- | --- | --- | --- | --- | --- | --- |",
	"| I | 1 | 1 | Main | The start | Done | |",
	"| I | 1 | 2 | Main | Next | In Progress | |",
	"| II | 2 |  | Main | A \\| pipe | TO DO | |",
	"| I | 3 | 1 | Main | none yet | No Status | |",
	"|   |   |   |   |   | Done | blank row |",
	"",
	"after the table",
].join("\n");

test("parseOutlineStatusRows reads position and status, dropping unnumbered rows", () => {
	const rows = parseOutlineStatusRows(TABLE);
	assert.equal(rows.length, 4);
	assert.deepEqual(rows.map((r) => r.status), ["Done", "In Progress", "TO DO", ""]);
	assert.deepEqual(rows[0].segments.map((s) => s.number), [1, 1, 1]);
	assert.deepEqual(rows[2].segments.map((s) => s.number), [2, 2]);
});

test("parseOutlineStatusRows copes with no table, no Status column, and bracket shorthand", () => {
	assert.deepEqual(parseOutlineStatusRows("just text"), []);
	assert.deepEqual(parseOutlineStatusRows("| Chapter |\n| --- |\n| 1 |"), []);
	const rows = parseOutlineStatusRows("| Chapter | Status |\n| --- | --- |\n| [1] | [Done] |");
	assert.equal(rows[0].status, "Done");
});

test("noteSegments drops label words and the .md extension", () => {
	assert.deepEqual(noteSegments("Act I/Chapter 1 - Start/Scene 2.md").map((s) => s.number), [1, 1, 2]);
	assert.deepEqual(noteSegments("Acto II/Capítulo 3/Escena IV.md").map((s) => s.number), [2, 3, 4]);
	assert.deepEqual(noteSegments("Chapter 5.md").map((s) => s.number), [5]);
});

test("findOutlineStatus matches by structure and numbers, roman or digits", () => {
	const rows = parseOutlineStatusRows(TABLE);
	assert.equal(findOutlineStatus(rows, "Act I/Chapter 1/Scene 1.md"), "Done");
	assert.equal(findOutlineStatus(rows, "Act I/Chapter 1/Scene 2.md"), "In Progress");
	assert.equal(findOutlineStatus(rows, "Act 1/Chapter 1/Scene 2.md"), "In Progress");
	assert.equal(findOutlineStatus(rows, "Acto I/Capítulo 1/Escena II.md"), "In Progress");
	assert.equal(findOutlineStatus(rows, "Act II/Chapter 2 - Title.md"), "TO DO");
});

test("findOutlineStatus is empty for unplanned, mismatched-depth or No Status notes", () => {
	const rows = parseOutlineStatusRows(TABLE);
	assert.equal(findOutlineStatus(rows, "Act I/Chapter 3/Scene 1.md"), "");
	assert.equal(findOutlineStatus(rows, "Act I/Chapter 9/Scene 1.md"), "");
	assert.equal(findOutlineStatus(rows, "Chapter 1.md"), "");
	assert.equal(findOutlineStatus(rows, "Prologue.md"), "");
});

test("a non-numeric Act cell matches the folder's text", () => {
	const rows = parseOutlineStatusRows("| Act | Chapter | Status |\n| --- | --- | --- |\n| Beginning | 1 | Done |");
	assert.equal(findOutlineStatus(rows, "Act Beginning/Chapter 1.md"), "Done");
	assert.equal(findOutlineStatus(rows, "Act Ending/Chapter 1.md"), "");
});
