// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import assert from "node:assert/strict";
import { test } from "node:test";
import { folderTotals } from "../../src/data/countTree";

test("each folder sums every file beneath it, at any depth", () => {
	const totals = folderTotals({
		"Story/Act 1/Chapter 1.md": 100,
		"Story/Act 1/Chapter 2.md": 200,
		"Story/Act 2/Chapter 3.md": 50,
	});
	assert.deepEqual(totals, {
		Story: 350,
		"Story/Act 1": 300,
		"Story/Act 2": 50,
	});
});

test("a file at the vault root contributes to no folder", () => {
	assert.deepEqual(folderTotals({ "Loose note.md": 42 }), {});
});

test("an empty input yields no folders", () => {
	assert.deepEqual(folderTotals({}), {});
});
