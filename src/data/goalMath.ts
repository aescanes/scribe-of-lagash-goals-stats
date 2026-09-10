// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

// Pure goal math — no Obsidian imports, unit-tested. The weekly and monthly
// targets shown in settings are derived here from the daily goal plus which
// weekdays the author writes on.

/** Writing-day labels, Monday-first — the order `Settings.writingDays` uses. */
export const WEEKDAYS = [
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
	"Sunday",
] as const;

/** Rounds a raw daily goal to a non-negative whole number of words/characters. */
function normalizeDailyGoal(dailyGoal: number): number {
	return Number.isFinite(dailyGoal) && dailyGoal > 0 ? Math.round(dailyGoal) : 0;
}

/** How many of the seven weekdays are marked as writing days. */
export function writingDaysPerWeek(writingDays: readonly boolean[]): number {
	return writingDays.filter(Boolean).length;
}

/** Daily goal × writing days per week. */
export function weeklyGoal(dailyGoal: number, writingDays: readonly boolean[]): number {
	return normalizeDailyGoal(dailyGoal) * writingDaysPerWeek(writingDays);
}

/**
 * How many dates in the given calendar month fall on a writing day. `month` is
 * 0-based like `Date`; `writingDays` is Monday-first (index 0 = Monday … 6 =
 * Sunday). Counting the real month rather than assuming 4.33 weeks keeps the
 * monthly target honest — a 31-day month starting on a writing day has more.
 */
export function writingDaysInMonth(
	year: number,
	month: number,
	writingDays: readonly boolean[],
): number {
	// Day 0 of the next month is the last day of this one.
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	let count = 0;
	for (let day = 1; day <= daysInMonth; day++) {
		// Date.getDay() is Sunday-first (0–6); shift to Monday-first.
		const mondayFirst = (new Date(year, month, day).getDay() + 6) % 7;
		if (writingDays[mondayFirst]) count++;
	}
	return count;
}

/** Daily goal × writing days that actually occur in the given month. */
export function monthlyGoal(
	dailyGoal: number,
	writingDays: readonly boolean[],
	year: number,
	month: number,
): number {
	return normalizeDailyGoal(dailyGoal) * writingDaysInMonth(year, month, writingDays);
}
