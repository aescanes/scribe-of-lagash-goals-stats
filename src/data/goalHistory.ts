// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

// Pure history model — no Obsidian imports, unit-tested. Persisted as JSON in a
// vault file (see `GoalHistoryStore`) so it survives a plugin uninstall/reinstall
// and travels with the vault through whatever the author already syncs it with.

import { insertedText } from "./textDiff";
import { measureBoth } from "./textMetrics";
import type { GoalMetric } from "../settings/settings";

/**
 * A count in each metric, regardless of which is active in settings — so
 * switching the metric later doesn't strand or misinterpret past history.
 *
 * `characters` is the legacy field from before the with/without-spaces split
 * (every plugin version through 0.7.5): "characters without spaces", the
 * plugin's only convention at the time. It is never written by this version
 * onward — only ever read, for a day recorded before the split shipped — so a
 * real user's existing history file keeps working unchanged rather than
 * losing or silently reinterpreting those older days. Every day recorded from
 * this version on stores `charactersWithSpaces`/`charactersWithoutSpaces`
 * instead, both always populated regardless of the `charactersIncludeSpaces`
 * setting, the same reasoning as `words`/`characters` both always being
 * stored regardless of the active metric. See `charactersFor` for how a day
 * record of either shape is read.
 */
export interface DayTotals {
	words: number;
	characters?: number;
	charactersWithSpaces?: number;
	charactersWithoutSpaces?: number;
}

/**
 * The characters count to use for `written`, in the requested spaces
 * convention: the matching split field when present (every day recorded from
 * the with/without-spaces split onward has both), otherwise the legacy
 * `characters` field (always "without spaces") as the closest available
 * approximation for a day recorded before the split — better than treating
 * that day as having no data at all.
 */
export function charactersFor(written: DayTotals, includeSpaces: boolean): number {
	const split = includeSpaces ? written.charactersWithSpaces : written.charactersWithoutSpaces;
	return split ?? written.characters ?? 0;
}

/** Each in-scope file's full text, keyed by vault path. */
export type FileText = Record<string, string>;

/**
 * One day's record. `written` — what the ring and calendar show — is a real
 * word-level diff (see `writtenAcrossFiles`) between each file's text right
 * now and its own text at the moment the day started: only words genuinely
 * new since then count. Deleting old, already-existing text is invisible to
 * it — it was never part of the "inserted" set — while deleting part of what
 * was typed *today* correctly drops back out of it, the same distinction
 * `git diff` draws between untouched, removed, and inserted lines.
 *
 * `dailyGoal`/`metric` are the goal settings actually in effect *that day* —
 * recorded once as part of the day's entry, not read live from settings at
 * display time, so changing the daily goal (or the words/characters metric)
 * later never repaints a past day's calendar colour. Optional because a day
 * recorded before this was tracked has neither; see `resolveDayGoal` for how
 * that's handled.
 */
export interface DayRecord {
	written: DayTotals;
	dailyGoal?: number;
	metric?: GoalMetric;
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

/**
 * A valid `written` block has `words` plus, for the characters side, either
 * the legacy single `characters` field or both split fields — never neither,
 * and never just one split field (a half-written split is as unusable as none).
 */
function isDayTotals(value: unknown): value is DayTotals {
	if (typeof value !== "object" || value === null) return false;
	const { words, characters, charactersWithSpaces, charactersWithoutSpaces } = value as Record<string, unknown>;
	if (typeof words !== "number") return false;
	if (typeof characters === "number") return true;
	return typeof charactersWithSpaces === "number" && typeof charactersWithoutSpaces === "number";
}

/** Copies only `written`'s recognized, valid-typed fields — `isDayTotals` has
 *  already confirmed one complete shape or the other applies. */
function sanitizeDayTotals(written: DayTotals): DayTotals {
	const { words, characters, charactersWithSpaces, charactersWithoutSpaces } = written;
	return {
		words,
		...(typeof characters === "number" ? { characters } : {}),
		...(typeof charactersWithSpaces === "number" ? { charactersWithSpaces } : {}),
		...(typeof charactersWithoutSpaces === "number" ? { charactersWithoutSpaces } : {}),
	};
}

/** Only `written` is required for a day record to be usable at all — see the
 *  per-field tolerance for `dailyGoal`/`metric` in `parseHistory` below. */
function hasValidWritten(value: unknown): value is { written: DayTotals } {
	if (typeof value !== "object" || value === null) return false;
	return isDayTotals((value as Record<string, unknown>).written);
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
		if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !hasValidWritten(value)) continue;
		const { dailyGoal, metric } = value as Record<string, unknown>;
		history[key] = {
			written: sanitizeDayTotals(value.written),
			...(typeof dailyGoal === "number" ? { dailyGoal } : {}),
			...(metric === "words" || metric === "characters" ? { metric } : {}),
		};
	}
	return history;
}

/** Serializes history with sorted keys, so the file diffs cleanly and reads chronologically. */
export function serializeHistory(history: GoalHistory): string {
	const sorted: GoalHistory = {};
	for (const key of Object.keys(history).sort()) sorted[key] = history[key];
	return JSON.stringify(sorted, null, "\t");
}

/**
 * Today's `written`: for every file in `current`, the words genuinely new
 * since its entry in `baselineText` (see `insertedText` — a missing entry
 * means the whole file is new today, since it didn't exist at the start of
 * the day), summed across every file. `words`/`charactersWithoutSpaces` are
 * summed from `insertedText`'s flat word list, but `charactersWithSpaces`
 * from its `runs` instead — each run's own real slice of `currentText`, so a
 * double space, a blank line between two new paragraphs, or any other
 * whitespace actually typed today survives, rather than every inserted word
 * being reassembled with exactly one space between it and the next regardless
 * of what was really there. A file present in `baselineText` but missing from
 * `current` (deleted, or moved out of scope) simply drops out — it
 * contributes 0, not a negative number that would eat into some other file's
 * total. When a file's diff is too large or too different to compute cheaply
 * (`insertedText` returns `null` — see its size limits), that one file falls
 * back to a plain count difference floored at 0, still immune to a
 * *different* file's deletions cancelling it out, just not immune to old and
 * new text mixing together within that one large file.
 */
export function writtenAcrossFiles(baselineText: FileText, current: FileText): DayTotals {
	let words = 0;
	let charactersWithSpaces = 0;
	let charactersWithoutSpaces = 0;
	for (const [path, currentText] of Object.entries(current)) {
		const baseline = baselineText[path] ?? "";
		const inserted = insertedText(baseline, currentText);
		if (inserted) {
			words += inserted.words.length;
			charactersWithoutSpaces += inserted.words.reduce((sum, word) => sum + word.length, 0);
			charactersWithSpaces += inserted.runs.reduce((sum, run) => sum + run.length, 0);
		} else {
			const currentTotals = measureBoth(currentText);
			const baselineTotals = measureBoth(baseline);
			words += Math.max(0, currentTotals.words - baselineTotals.words);
			charactersWithSpaces += Math.max(0, currentTotals.charactersWithSpaces - baselineTotals.charactersWithSpaces);
			charactersWithoutSpaces += Math.max(
				0,
				currentTotals.charactersWithoutSpaces - baselineTotals.charactersWithoutSpaces,
			);
		}
	}
	return { words, charactersWithSpaces, charactersWithoutSpaces };
}

/**
 * How much was written on `date`, in the given metric; 0 when the day has no
 * entry. `includeSpaces` only matters when `metric` is "characters" — see
 * `charactersFor`.
 */
export function writtenFor(history: GoalHistory, date: string, metric: GoalMetric, includeSpaces: boolean): number {
	const day = history[date];
	if (!day) return 0;
	return metric === "characters" ? charactersFor(day.written, includeSpaces) : day.written.words;
}

/**
 * What to compare against `dayStatus` for `date`'s calendar colour: the
 * amount written and the daily goal actually recorded for that day, in
 * whichever metric was active *then* — not `fallback`'s live, current
 * values, and not necessarily today's metric either, so a day's status
 * always reflects what genuinely happened that day regardless of any later
 * change to the goal number or the words/characters setting. `fallback` only
 * applies to a day recorded before this was tracked (or with no entry at
 * all), which has nothing of its own to use instead. `includeSpaces` is
 * always the live, current setting, unlike `fallback` — both spaces
 * conventions are always stored for every day (see `DayTotals`), so unlike
 * the daily goal or metric there's nothing day-specific to prefer instead.
 */
export function resolveDayGoal(
	history: GoalHistory,
	date: string,
	fallback: { dailyGoal: number; metric: GoalMetric },
	includeSpaces: boolean,
): { written: number; dailyGoal: number } {
	const day = history[date];
	const metric = day?.metric ?? fallback.metric;
	const dailyGoal = day?.dailyGoal ?? fallback.dailyGoal;
	const written = day ? (metric === "characters" ? charactersFor(day.written, includeSpaces) : day.written.words) : 0;
	return { written, dailyGoal };
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
	includeSpaces: boolean,
): number {
	let total = 0;
	for (const [date, record] of Object.entries(history)) {
		if (date >= startDate && date <= endDate) {
			total += metric === "characters" ? charactersFor(record.written, includeSpaces) : record.written.words;
		}
	}
	return total;
}
