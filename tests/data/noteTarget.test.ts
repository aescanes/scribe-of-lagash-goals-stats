// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTarget } from "../../src/data/noteTarget";

test("parseTarget accepts numbers and digit strings with grouping", () => {
	assert.equal(parseTarget(5000), 5000);
	assert.equal(parseTarget("5000"), 5000);
	assert.equal(parseTarget(" 5,000 "), 5000);
	assert.equal(parseTarget("5 000"), 5000);
	assert.equal(parseTarget("1.250.000"), 1250000);
});

test("parseTarget takes the first usable item of a list", () => {
	assert.equal(parseTarget(["", "soon", 800]), 800);
});

test("parseTarget rejects zero, negatives, decimals and non-numbers", () => {
	for (const bad of [0, -5, "0", "abc", "", "12.5", null, undefined, {}, [], NaN]) assert.equal(parseTarget(bad), null);
});
