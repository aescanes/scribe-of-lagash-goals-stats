// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

// Pure calendar math — no Obsidian imports, unit-tested.

import { dateKey } from "./goalHistory";

/** How a day compares to the daily goal, for colouring its calendar cell. */
export type DayStatus = "met" | "partial" | "none";

export interface CalendarCell {
	date: Date;
	/** Local date key, "YYYY-MM-DD". */
	iso: string;
	/** Whether this cell falls in the requested month (false for the leading/trailing filler days). */
	inMonth: boolean;
	isToday: boolean;
	status: DayStatus;
	/** The raw amount written that day (0 for a day with no entry) — e.g. for a tooltip. */
	written: number;
}

/** "met" at or past the goal, "partial" for any lesser amount written, "none" for nothing. */
export function dayStatus(written: number, dailyGoal: number): DayStatus {
	if (written <= 0) return "none";
	return dailyGoal > 0 && written >= dailyGoal ? "met" : "partial";
}

/** A month grid is always this many full weeks — a fixed height regardless of the month. */
const WEEKS_PER_GRID = 6;

/**
 * A Sunday-first grid of `Date`s for the given month (0-based, like `Date`),
 * always `WEEKS_PER_GRID` weeks — padded with the tail of the previous month
 * and the head of the next — so the widget's height doesn't jump as the month
 * changes.
 */
export function monthGrid(year: number, month: number): Date[][] {
	const startWeekday = new Date(year, month, 1).getDay(); // 0 = Sunday
	const weeks: Date[][] = [];
	for (let week = 0; week < WEEKS_PER_GRID; week++) {
		const row: Date[] = [];
		for (let day = 0; day < 7; day++) {
			row.push(new Date(year, month, 1 - startWeekday + week * 7 + day));
		}
		weeks.push(row);
	}
	return weeks;
}

/**
 * `monthGrid` enriched with each cell's status and raw amount written, via
 * caller-supplied lookups (typically closed over the loaded history — so
 * this module stays independent of the history file's shape). `statusForDate`
 * is a separate lookup from `writtenForDate`, not just `dayStatus(written,
 * someDailyGoal)` applied uniformly here, so the caller can compare each day
 * against whatever goal actually applied *that day* rather than one goal
 * value for the whole grid.
 */
export function buildCalendar(
	year: number,
	month: number,
	today: Date,
	writtenForDate: (iso: string) => number,
	statusForDate: (iso: string) => DayStatus,
): CalendarCell[][] {
	const todayIso = dateKey(today);
	return monthGrid(year, month).map((week) =>
		week.map((date) => {
			const iso = dateKey(date);
			return {
				date,
				iso,
				inMonth: date.getMonth() === month,
				isToday: iso === todayIso,
				status: statusForDate(iso),
				written: writtenForDate(iso),
			};
		}),
	);
}
