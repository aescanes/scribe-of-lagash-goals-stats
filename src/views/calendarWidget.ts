// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { setIcon } from "obsidian";
import { buildCalendar, CalendarCell, DayStatus } from "../data/calendarGrid";
import { formatCount } from "../data/countFormat";
import type { GoalMetric } from "../settings/settings";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

export interface CalendarWidgetOptions {
	/** Which month to show; only its year/month matter. */
	cursor: Date;
	metric: GoalMetric;
	writtenForDate: (iso: string) => number;
	/** A day's goal status — the caller resolves this against whatever goal
	 *  actually applied that day (see `resolveDayGoal`), not just today's. */
	statusForDate: (iso: string) => DayStatus;
	/** Prev/next nav clicked; the caller owns `cursor` and re-renders. */
	onNavigate: (next: Date) => void;
	/** Called when a day *with data* is clicked. Days with nothing written aren't clickable. */
	onDayClick?: (cell: CalendarCell) => void;
}

/**
 * Renders a month calendar — prev/next nav and a Sunday-first grid of day
 * cells coloured by goal status — into `containerEl`. Shared by the
 * right-sidebar goal widget and the main-area Goals and Stats tab, so both stay
 * visually and behaviourally identical without duplicating the DOM building.
 */
export function renderCalendarWidget(containerEl: HTMLElement, options: CalendarWidgetOptions): void {
	const { cursor, metric, writtenForDate, statusForDate, onNavigate, onDayClick } = options;
	const year = cursor.getFullYear();
	const month = cursor.getMonth();

	const nav = containerEl.createDiv({ cls: "scribe-goal-calendar-nav" });

	const prev = nav.createEl("button", { cls: "clickable-icon" });
	setIcon(prev, "chevron-left");
	prev.addEventListener("click", () => onNavigate(new Date(year, month - 1, 1)));

	nav.createSpan({
		cls: "scribe-goal-calendar-title",
		text: cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
	});

	const next = nav.createEl("button", { cls: "clickable-icon" });
	setIcon(next, "chevron-right");
	next.addEventListener("click", () => onNavigate(new Date(year, month + 1, 1)));

	const grid = containerEl.createDiv({ cls: "scribe-goal-calendar-grid" });
	for (const label of WEEKDAY_LABELS) {
		grid.createDiv({ cls: "scribe-goal-calendar-weekday", text: label });
	}

	const weeks = buildCalendar(year, month, new Date(), writtenForDate, statusForDate);
	for (const week of weeks) {
		for (const cell of week) renderDayCell(grid, cell, metric, onDayClick);
	}
}

function renderDayCell(
	grid: HTMLElement,
	cell: CalendarCell,
	metric: GoalMetric,
	onDayClick?: (cell: CalendarCell) => void,
): void {
	const el = grid.createDiv({ cls: "scribe-goal-calendar-day" });
	el.toggleClass("mod-out-of-month", !cell.inMonth);
	el.toggleClass("mod-today", cell.isToday);
	if (cell.status !== "none") el.addClass(`mod-${cell.status}`);
	el.setText(String(cell.date.getDate()));

	// Only a day with data has anything to say — there's nothing to show or
	// click for "none".
	if (cell.status !== "none") {
		el.setAttr("aria-label", formatCount(cell.written, metric, false));
		if (onDayClick) {
			el.addClass("mod-clickable");
			el.addEventListener("click", () => onDayClick(cell));
		}
	}
}
