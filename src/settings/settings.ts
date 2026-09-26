// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

/** What goals and statistics are measured in. */
export type GoalMetric = "words" | "characters";

export interface ScribeGoalsStatsSettings {
	/**
	 * Vault-relative folder holding one story's act/chapter/scene notes. Empty
	 * means scan the whole vault.
	 */
	storyFolder: string;

	/**
	 * Extra vault-relative notes and folders to leave out of the writing goals
	 * and statistics, one per line in the UI. Scribe-generated "(SL) …" paths
	 * are always excluded and are not stored here (see `isExcluded`).
	 */
	excludedPaths: string[];

	/** Whether goals and statistics count words or characters. */
	metric: GoalMetric;

	/**
	 * Only meaningful when `metric` is "characters": whether the count includes
	 * spaces and line breaks ("characters with spaces", matching Obsidian's own
	 * word-count status bar) or excludes them ("characters without spaces" —
	 * the previous, fixed behavior of this plugin).
	 */
	charactersIncludeSpaces: boolean;

	/** Target for a single writing day, in the chosen metric. */
	dailyGoal: number;

	/**
	 * Which weekdays are writing days, Monday-first: index 0 = Monday …
	 * 6 = Sunday. Always length 7. The weekly and monthly goals shown in
	 * settings are derived from this plus `dailyGoal`.
	 */
	writingDays: boolean[];
}

export const DEFAULT_SETTINGS: ScribeGoalsStatsSettings = {
	storyFolder: "",
	excludedPaths: [],
	metric: "words",
	charactersIncludeSpaces: false,
	dailyGoal: 500,
	// Default to writing every day; the author unchecks the days they take off.
	writingDays: [true, true, true, true, true, true, true],
};

/**
 * Coerces persisted data — which may be absent, partial, or from an older
 * version — into a fully valid settings object. `loadData()` returns whatever
 * was last written, so every field is re-checked here rather than trusted.
 */
export function normalizeSettings(
	stored: Partial<ScribeGoalsStatsSettings> | null,
): ScribeGoalsStatsSettings {
	const merged = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
	const days = Array.isArray(merged.writingDays) ? merged.writingDays : [];
	return {
		storyFolder: typeof merged.storyFolder === "string" ? merged.storyFolder : "",
		excludedPaths: Array.isArray(merged.excludedPaths)
			? merged.excludedPaths.filter((p): p is string => typeof p === "string" && p.trim() !== "")
			: [],
		metric: merged.metric === "characters" ? "characters" : "words",
		charactersIncludeSpaces: merged.charactersIncludeSpaces === true,
		dailyGoal:
			Number.isFinite(merged.dailyGoal) && merged.dailyGoal > 0
				? Math.round(merged.dailyGoal)
				: DEFAULT_SETTINGS.dailyGoal,
		writingDays: Array.from({ length: 7 }, (_, i) =>
			typeof days[i] === "boolean" ? days[i] : true,
		),
	};
}
