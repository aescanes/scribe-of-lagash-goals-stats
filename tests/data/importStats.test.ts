// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import assert from "node:assert/strict";
import { test } from "node:test";
import { GoalHistory, parseHistory, serializeHistory } from "../../src/data/goalHistory";
import {
	DEFAULT_SPACES_RATIO,
	describeImport,
	describeNothingToImport,
	estimateSpacesRatio,
	mergeImportedDays,
	resolveCharacters,
} from "../../src/data/importStats";

const GOAL = { dailyGoal: 500, metric: "words" as const };
const TODAY = "2026-10-24";

function day(words: number, withSpaces: number, withoutSpaces: number): GoalHistory[string] {
	return { written: { words, charactersWithSpaces: withSpaces, charactersWithoutSpaces: withoutSpaces } };
}

test("estimateSpacesRatio falls back to the default with fewer than 5 usable days", () => {
	const history: GoalHistory = {};
	for (let i = 1; i <= 4; i++) history[`2026-04-0${i}`] = day(100, 1000, 500);
	assert.equal(estimateSpacesRatio(history), DEFAULT_SPACES_RATIO);
});

test("estimateSpacesRatio uses the writer's own history from 5 usable days, skipping empty ones", () => {
	const history: GoalHistory = { "2026-04-09": day(0, 0, 0) };
	for (let i = 1; i <= 5; i++) history[`2026-04-0${i}`] = day(100, 1000, 800);
	assert.equal(estimateSpacesRatio(history), 0.8);
});

test("resolveCharacters estimates the missing field in both directions", () => {
	assert.deepEqual(resolveCharacters({ date: "d", words: 1, charactersWithSpaces: 1000 }, 0.85), {
		charactersWithSpaces: 1000,
		charactersWithoutSpaces: 850,
		estimated: "charactersWithoutSpaces",
	});
	assert.deepEqual(resolveCharacters({ date: "d", words: 1, charactersWithoutSpaces: 850 }, 0.85), {
		charactersWithSpaces: 1000,
		charactersWithoutSpaces: 850,
		estimated: "charactersWithSpaces",
	});
});

test("resolveCharacters keeps two real counts and zeroes a day with none", () => {
	assert.deepEqual(
		resolveCharacters({ date: "d", words: 1, charactersWithSpaces: 10, charactersWithoutSpaces: 9 }, 0.5),
		{ charactersWithSpaces: 10, charactersWithoutSpaces: 9, estimated: null },
	);
	assert.deepEqual(resolveCharacters({ date: "d", words: 1 }, 0.5), {
		charactersWithSpaces: 0,
		charactersWithoutSpaces: 0,
		estimated: null,
	});
});

test("mergeImportedDays adds new days with the current goal and metric, both split fields set", () => {
	const result = mergeImportedDays(
		{},
		[{ date: "2026-10-20", words: 40, charactersWithSpaces: 240 }],
		{ dailyGoal: 700, metric: "characters" },
	);
	assert.deepEqual(result.added, ["2026-10-20"]);
	assert.equal(result.estimated, "charactersWithoutSpaces");
	assert.deepEqual(result.history["2026-10-20"], {
		written: { words: 40, charactersWithSpaces: 240, charactersWithoutSpaces: 204 },
		dailyGoal: 700,
		metric: "characters",
	});
});

test("mergeImportedDays never overwrites a day with data, but replaces an all-zero one", () => {
	const history: GoalHistory = {
		"2026-10-18": day(10, 60, 50),
		"2026-10-19": day(0, 0, 0),
	};
	const result = mergeImportedDays(
		history,
		[
			{ date: "2026-10-18", words: 99, charactersWithSpaces: 99 },
			{ date: "2026-10-19", words: 30, charactersWithSpaces: 100 },
		],
		GOAL,
	);
	assert.deepEqual(result.skipped, ["2026-10-18"]);
	assert.deepEqual(result.added, ["2026-10-19"]);
	assert.equal(result.history["2026-10-18"], history["2026-10-18"]);
	assert.equal(result.history["2026-10-19"].written.words, 30);
});

test("mergeImportedDays fills today when it has nothing written, but not when it has writing", () => {
	const imported = [{ date: TODAY, words: 5, charactersWithSpaces: 30 }];
	const empty: GoalHistory = { [TODAY]: day(0, 0, 0) };
	const filled = mergeImportedDays(empty, imported, GOAL);
	assert.deepEqual(filled.added, [TODAY]);
	assert.equal(filled.history[TODAY].written.words, 5);
	assert.deepEqual(empty, { [TODAY]: day(0, 0, 0) }, "input is not mutated");

	const busy: GoalHistory = { [TODAY]: day(40, 250, 210) };
	const kept = mergeImportedDays(busy, imported, GOAL);
	assert.deepEqual(kept.skipped, [TODAY]);
	assert.equal(kept.history[TODAY], busy[TODAY]);
});

test("mergeImportedDays adds a day into an empty history (a file that doesn't exist yet)", () => {
	const result = mergeImportedDays({}, [{ date: "2026-10-20", words: 8, charactersWithSpaces: 50 }], GOAL);
	assert.deepEqual(result.added, ["2026-10-20"]);
	assert.equal(result.estimated, "charactersWithoutSpaces");
});

test("imported days survive a serialize → parse round trip", () => {
	const { history } = mergeImportedDays({}, [{ date: "2026-10-20", words: 40, charactersWithSpaces: 240 }], GOAL);
	assert.deepEqual(parseHistory(serializeHistory(history)), history);
});

test("describeImport words the preview and the result, and flags estimated characters", () => {
	const base = { added: ["a", "b"], skipped: ["c"], estimated: "charactersWithoutSpaces" as const };
	assert.equal(
		describeImport(base, false),
		"2 days will be added, 1 day skipped because it already has data. The source counts characters with spaces, so characters without spaces are estimated.",
	);
	assert.equal(describeImport({ added: ["a"], skipped: [], estimated: null }, true), "1 day added.");
});

test("describeNothingToImport names the history file", () => {
	const history: GoalHistory = { "2026-10-23": day(10, 60, 50), "2026-10-22": day(10, 60, 50) };
	const days = [
		{ date: "2026-10-23", words: 5, charactersWithSpaces: 30 },
		{ date: "2026-10-22", words: 5, charactersWithSpaces: 30 },
	];
	const result = mergeImportedDays(history, days, GOAL);
	assert.equal(
		describeNothingToImport(2, result, "Story/(SL) Goals History.json"),
		'Nothing to import: all 2 days in the file already have data in "Story/(SL) Goals History.json".',
	);
	assert.equal(describeNothingToImport(0, result, "x"), "Nothing to import: the file has no days with writing in it.");
});
