// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import assert from "node:assert/strict";
import { test } from "node:test";
import { CharactersConvention, ImportSource, RawDay } from "../../../src/data/importSources/importSource";

/** A minimal source proving the shared steps apply to any subclass. */
class FakeSource extends ImportSource {
	readonly id = "fake";
	readonly label = "Fake";
	constructor(readonly charactersConvention: CharactersConvention) {
		super();
	}
	protected validate(): string | null {
		return null;
	}
	protected extractDays(json: unknown): RawDay[] {
		return json as RawDay[];
	}
}

test("sums rows per date, rounds, and sorts", () => {
	const result = new FakeSource("withoutSpaces").parse(
		JSON.stringify([
			{ date: "2026-01-02", words: 1.4, characters: 10 },
			{ date: "2026-01-01", words: 2, characters: 7 },
			{ date: "2026-01-02", words: 1, characters: 5 },
		]),
	);
	assert.deepEqual(result, {
		days: [
			{ date: "2026-01-01", words: 2, charactersWithoutSpaces: 7 },
			{ date: "2026-01-02", words: 2, charactersWithoutSpaces: 15 },
		],
	});
});

test("an unknown convention puts the same count in both fields", () => {
	const result = new FakeSource("unknown").parse(JSON.stringify([{ date: "2026-01-01", words: 3, characters: 20 }]));
	assert.deepEqual(result, { days: [{ date: "2026-01-01", words: 3, charactersWithSpaces: 20, charactersWithoutSpaces: 20 }] });
});

test("a source with no character count leaves both fields absent", () => {
	const result = new FakeSource("withSpaces").parse(JSON.stringify([{ date: "2026-01-01", words: 3 }]));
	assert.deepEqual(result, { days: [{ date: "2026-01-01", words: 3 }] });
});
