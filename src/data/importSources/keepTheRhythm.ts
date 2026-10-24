// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { CharactersConvention, ImportSource, RawDay } from "./importSource";

/** Backup schema versions this importer understands. */
const KNOWN_SCHEMAS = ["0.2"];

/**
 * Keep the Rhythm's backup file (its settings → backup). Mirrors the plugin's
 * own day total: `dailyActivity` has one row per (date, file), and a day is
 * the net sum of every row's `changes` — the `*Start` fields are the file's
 * size when first seen that day and are ignored, exactly as the plugin does
 * for its heatmap and day totals. `charCountStart` is the note's raw
 * `text.length`, so its character deltas (`c`) are "with spaces".
 */
export class KeepTheRhythmSource extends ImportSource {
	readonly id = "keep-the-rhythm";
	readonly label = "Keep the Rhythm";
	readonly charactersConvention: CharactersConvention = "withSpaces";

	protected validate(json: unknown): string | null {
		if (!isRecord(json)) return "This doesn't look like a Keep the Rhythm backup.";
		if (typeof json.schema !== "string" || !KNOWN_SCHEMAS.includes(json.schema)) {
			return `Unsupported Keep the Rhythm backup version "${String(json.schema)}" (supported: ${KNOWN_SCHEMAS.join(", ")}).`;
		}
		if (!isRecord(json.stats) || !Array.isArray(json.stats.dailyActivity)) {
			return "The backup has no daily activity to import.";
		}
		return null;
	}

	protected extractDays(json: unknown): RawDay[] {
		const rows = (json as { stats: { dailyActivity: unknown[] } }).stats.dailyActivity;
		const days: RawDay[] = [];
		for (const row of rows) {
			if (!isRecord(row) || typeof row.date !== "string" || !Array.isArray(row.changes)) continue;
			let words = 0;
			let characters = 0;
			for (const change of row.changes) {
				if (!isRecord(change)) continue;
				if (typeof change.w === "number") words += change.w;
				if (typeof change.c === "number") characters += change.c;
			}
			days.push({ date: row.date, words, characters });
		}
		return days;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
