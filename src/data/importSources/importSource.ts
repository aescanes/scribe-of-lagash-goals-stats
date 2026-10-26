// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

// Reusable parent for "import another plugin's stats". A source subclasses
// `ImportSource` and supplies only what is genuinely its own — the schema
// check and how *its* numbers add up to a day — while everything every source
// needs identically (JSON parsing, date validation, per-date aggregation,
// clamping, sorting) lives here, so a new source is one small file.

/** Which character convention a source's single character count follows. */
export type CharactersConvention = "withSpaces" | "withoutSpaces" | "unknown";

/**
 * One day, in this plugin's terms. A character field is absent when the source
 * didn't provide it (the merge estimates it — see `resolveCharacters`).
 */
export interface ImportedDay {
	date: string;
	words: number;
	charactersWithSpaces?: number;
	charactersWithoutSpaces?: number;
}

/**
 * What a subclass reports per source row (possibly several rows per date —
 * the base class sums them). `characters` is the source's single character
 * count, interpreted via the source's `charactersConvention`.
 */
export interface RawDay {
	date: string;
	words: number;
	characters?: number;
}

export type ImportResult = { days: ImportedDay[] } | { error: string };

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export abstract class ImportSource {
	abstract readonly id: string;
	abstract readonly label: string;
	abstract readonly charactersConvention: CharactersConvention;

	/** `null` when `json` has the shape this source expects, otherwise why not. */
	protected abstract validate(json: unknown): string | null;

	/** The source's own counting logic: its rows, as words/characters per date. */
	protected abstract extractDays(json: unknown): RawDay[];

	parse(raw: string): ImportResult {
		let json: unknown;
		try {
			json = JSON.parse(raw);
		} catch {
			return { error: "The file is not valid JSON." };
		}
		const problem = this.validate(json);
		if (problem !== null) return { error: problem };

		const byDate = new Map<string, { words: number; characters: number; hasCharacters: boolean }>();
		for (const row of this.extractDays(json)) {
			if (!DATE_KEY.test(row.date)) continue;
			const total = byDate.get(row.date) ?? { words: 0, characters: 0, hasCharacters: false };
			total.words += row.words;
			if (row.characters !== undefined) {
				total.characters += row.characters;
				total.hasCharacters = true;
			}
			byDate.set(row.date, total);
		}

		const days: ImportedDay[] = [];
		for (const [date, total] of byDate) {
			// A day can net negative when more was deleted than typed; this
			// plugin's history has no negative days, so it floors at 0.
			const words = Math.max(0, Math.round(total.words));
			const characters = Math.max(0, Math.round(total.characters));
			if (words === 0 && characters === 0) continue;
			days.push({ date, words, ...this.characterFields(total.hasCharacters ? characters : undefined) });
		}
		days.sort((a, b) => a.date.localeCompare(b.date));
		return { days };
	}

	private characterFields(characters: number | undefined): Partial<ImportedDay> {
		if (characters === undefined) return {};
		switch (this.charactersConvention) {
			case "withSpaces":
				return { charactersWithSpaces: characters };
			case "withoutSpaces":
				return { charactersWithoutSpaces: characters };
			default:
				// No basis to tell which, so the same number stands in for both.
				return { charactersWithSpaces: characters, charactersWithoutSpaces: characters };
		}
	}
}
