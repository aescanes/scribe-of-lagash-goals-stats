// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

// Pure history model — no Obsidian imports, unit-tested. Persisted as JSON in a
// vault file (see `GoalHistoryStore`) so it survives a plugin uninstall/reinstall
// and travels with the vault through whatever the author already syncs it with.

import type { GoalMetric } from "../settings/settings";

/** A count in each metric, regardless of which is active in settings — so
 *  switching the metric later doesn't strand or misinterpret past history. */
export interface DayTotals {
	words: number;
	characters: number;
}

/**
 * One day's record. `written` — what the ring and calendar show — is the net
 * change that day: the scope's total right now minus its total at the moment
 * the day started, clamped at 0 (a net deletion below where the day started
 * reads as "nothing written", not a negative goal). It moves in both
 * directions live, same as the ring — deleting text lowers it, same as any
 * other writing-progress tracker. `total` is the scope's raw word/character
 * count as of the last scan that day; it isn't shown anywhere, it exists only
 * so `GoalHistoryStore` can recover today's start-of-day baseline after a
 * restart (`total − written`).
 */
export interface DayRecord {
	total: DayTotals;
	written: DayTotals;
}

/** History keyed by local date, "YYYY-MM-DD". Keys sort chronologically as strings. */
export type GoalHistory = Record<string, DayRecord>;

/** Local calendar-day key for a `Date` — deliberately not UTC, so a day matches what the author sees. */
export function dateKey(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}

function isDayTotals(value: unknown): value is DayTotals {
	if (typeof value !== "object" || value === null) return false;
	const { words, characters } = value as Record<string, unknown>;
	return typeof words === "number" && typeof characters === "number";
}

function isDayRecord(value: unknown): value is DayRecord {
	if (typeof value !== "object" || value === null) return false;
	const { total, written } = value as Record<string, unknown>;
	return isDayTotals(total) && isDayTotals(written);
}

/**
 * Parses a history file's contents, dropping anything malformed rather than
 * failing outright — a hand-edited or partially-synced file should degrade to
 * "missing that day", not corrupt the whole history.
 */
export function parseHistory(raw: string): GoalHistory {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return {};
	}
	if (typeof parsed !== "object" || parsed === null) return {};

	const history: GoalHistory = {};
	for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
		if (/^\d{4}-\d{2}-\d{2}$/.test(key) && isDayRecord(value)) {
			history[key] = { total: { ...value.total }, written: { ...value.written } };
		}
	}
	return history;
}

/** Serializes history with sorted keys, so the file diffs cleanly and reads chronologically. */
export function serializeHistory(history: GoalHistory): string {
	const sorted: GoalHistory = {};
	for (const key of Object.keys(history).sort()) sorted[key] = history[key];
	return JSON.stringify(sorted, null, "\t");
}

/** How much was written on `date`, in the given metric; 0 when the day has no entry. */
export function writtenFor(history: GoalHistory, date: string, metric: GoalMetric): number {
	const day = history[date];
	if (!day) return 0;
	return metric === "characters" ? day.written.characters : day.written.words;
}

/**
 * Sums `written` for the given metric over an inclusive local-date range
 * ("YYYY-MM-DD" strings — comparable lexicographically like everywhere else
 * in this module). Used for the "this week" / "this month" summary; the
 * caller works out the range's boundaries (`dateKey` on the relevant `Date`s).
 */
export function writtenBetween(
	history: GoalHistory,
	startDate: string,
	endDate: string,
	metric: GoalMetric,
): number {
	let total = 0;
	for (const [date, record] of Object.entries(history)) {
		if (date >= startDate && date <= endDate) {
			total += metric === "characters" ? record.written.characters : record.written.words;
		}
	}
	return total;
}
