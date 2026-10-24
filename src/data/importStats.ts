// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

// Source-agnostic half of the stats import: turns `ImportedDay`s (whatever
// plugin they came from) into history entries. Pure, no Obsidian imports.

import type { GoalHistory } from "./goalHistory";
import { hasWrittenAnything } from "./goalHistory";
import type { ImportedDay } from "./importSources/importSource";
import type { GoalMetric } from "../settings/settings";

/** Typical characters-without-spaces ÷ characters-with-spaces for prose. */
export const DEFAULT_SPACES_RATIO = 0.85;
/** How many of the writer's own days are needed before their ratio is trusted. */
export const MIN_RATIO_DAYS = 5;

export type CharacterField = "charactersWithSpaces" | "charactersWithoutSpaces";

/**
 * without-spaces ÷ with-spaces, from the writer's own history when enough
 * days have both counts — their prose, their ratio — otherwise the default.
 */
export function estimateSpacesRatio(history: GoalHistory): number {
	let days = 0;
	let withSpaces = 0;
	let withoutSpaces = 0;
	for (const { written } of Object.values(history)) {
		const { words, charactersWithSpaces, charactersWithoutSpaces } = written;
		if (words > 0 && (charactersWithSpaces ?? 0) > 0 && (charactersWithoutSpaces ?? 0) > 0) {
			days++;
			withSpaces += charactersWithSpaces ?? 0;
			withoutSpaces += charactersWithoutSpaces ?? 0;
		}
	}
	if (days < MIN_RATIO_DAYS) return DEFAULT_SPACES_RATIO;
	const ratio = withoutSpaces / withSpaces;
	// Without-spaces can't exceed with-spaces; anything else is bad data.
	return ratio > 0 && ratio <= 1 ? ratio : DEFAULT_SPACES_RATIO;
}

/**
 * Both split fields for `day`, filling in whichever one the source didn't
 * provide from the one it did (`estimated` names the filled one). A day with
 * neither has no character data at all and gets zeros.
 */
export function resolveCharacters(
	day: ImportedDay,
	ratio: number,
): { charactersWithSpaces: number; charactersWithoutSpaces: number; estimated: CharacterField | null } {
	const { charactersWithSpaces, charactersWithoutSpaces } = day;
	if (charactersWithSpaces !== undefined && charactersWithoutSpaces !== undefined) {
		return { charactersWithSpaces, charactersWithoutSpaces, estimated: null };
	}
	if (charactersWithSpaces !== undefined) {
		return {
			charactersWithSpaces,
			charactersWithoutSpaces: Math.round(charactersWithSpaces * ratio),
			estimated: "charactersWithoutSpaces",
		};
	}
	if (charactersWithoutSpaces !== undefined) {
		return {
			charactersWithSpaces: Math.round(charactersWithoutSpaces / ratio),
			charactersWithoutSpaces,
			estimated: "charactersWithSpaces",
		};
	}
	return { charactersWithSpaces: 0, charactersWithoutSpaces: 0, estimated: null };
}

export interface MergeResult {
	history: GoalHistory;
	/** Dates written (new, or replacing an all-zero day). */
	added: string[];
	/** Dates left alone because they already hold real data. */
	skipped: string[];
	/** Which character field was estimated for the added days, if any. */
	estimated: CharacterField | null;
}

/**
 * Merges imported days into `history` without mutating it. A date that
 * already has anything written is skipped; a missing or all-zero day —
 * today included — takes the imported data. Imported days are recorded
 * against the *current* goal and metric, like any day recorded today.
 */
export function mergeImportedDays(
	history: GoalHistory,
	days: ImportedDay[],
	goal: { dailyGoal: number; metric: GoalMetric },
): MergeResult {
	const ratio = estimateSpacesRatio(history);
	const merged: GoalHistory = { ...history };
	const added: string[] = [];
	const skipped: string[] = [];
	let estimated: CharacterField | null = null;

	for (const day of days) {
		const existing = history[day.date];
		if (existing && hasWrittenAnything({ [day.date]: existing })) {
			skipped.push(day.date);
			continue;
		}
		const characters = resolveCharacters(day, ratio);
		estimated ??= characters.estimated;
		merged[day.date] = {
			written: {
				words: day.words,
				charactersWithSpaces: characters.charactersWithSpaces,
				charactersWithoutSpaces: characters.charactersWithoutSpaces,
			},
			dailyGoal: goal.dailyGoal,
			metric: goal.metric,
		};
		added.push(day.date);
	}
	return { history: merged, added, skipped, estimated };
}

/** The summary shown in the confirm dialog (`done` false) and the final notice (`done` true). */
export function describeImport(result: Pick<MergeResult, "added" | "skipped" | "estimated">, done: boolean): string {
	const dayWord = (n: number) => `${n} day${n === 1 ? "" : "s"}`;
	let text = `${dayWord(result.added.length)} ${done ? "added" : "will be added"}`;
	if (result.skipped.length > 0) text += `, ${dayWord(result.skipped.length)} skipped because ${result.skipped.length === 1 ? "it already has" : "they already have"} data`;
	text += ".";
	if (result.estimated) {
		const [estimated, real] =
			result.estimated === "charactersWithoutSpaces"
				? ["without spaces", "with spaces"]
				: ["with spaces", "without spaces"];
		text += ` The source counts characters ${real}, so characters ${estimated} are estimated.`;
	}
	return text;
}

/**
 * Why a non-empty file still imported nothing, naming the history file the
 * days were checked against — that file belongs to the current story folder,
 * so "already has data" is only meaningful relative to it.
 */
export function describeNothingToImport(parsedDays: number, result: MergeResult, historyPath: string): string {
	if (parsedDays === 0) return "Nothing to import: the file has no days with writing in it.";
	const n = result.skipped.length;
	return `Nothing to import: ${n === 1 ? "the day in the file already has" : `all ${n} days in the file already have`} data in "${historyPath}".`;
}
