// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { ItemView, setIcon, WorkspaceLeaf } from "obsidian";
import type ScribeGoalsStatsPlugin from "../main";
import type { CalendarCell } from "../data/calendarGrid";
import { dateKey, writtenBetween, writtenFor } from "../data/goalHistory";
import type { GoalMetric } from "../settings/settings";
import { renderCalendarWidget } from "./calendarWidget";
import { GOAL_WIDGET_ICON } from "./goalWidgetView";

export const VIEW_TYPE_GOALS_STATS_TAB = "scribe-goals-stats-tab";

/** Custom icon for the view tab and ribbon; registered in `main.ts` via `addIcon`. */
export const GOALS_STATS_TAB_ICON_ID = "scribe-goals-stats-chart";

/**
 * Lucide "chart-line" paths, scaled from the 24-unit box they were authored in
 * up to Obsidian's 100-unit icon box — Obsidian wraps this in its own
 * `<svg viewBox="0 0 100 100">`, so this is content only, not a full `<svg>`.
 * `currentColor` so the tab icon follows the theme; the ribbon is tinted via
 * the `scribe-ribbon-icon` class.
 */
export const GOALS_STATS_TAB_ICON_SVG =
	`<g fill="none" stroke="currentColor" stroke-width="8.33" stroke-linecap="round" stroke-linejoin="round">` +
	`<path d="M12.5 12.5v66.67a8.33 8.33 0 0 0 8.33 8.33h66.67"/>` +
	`<path d="M79.17 37.5l-20.83 20.83-16.67-16.67-12.5 12.5"/></g>`;

/**
 * Main-area tab: the full "Goals & Stats" picture. Opens as a tab, like the
 * Visualization plugin's StoryLines, rather than a sidebar — this is meant to
 * be worked in, not just glanced at alongside writing. Two sections,
 * separated by a divider:
 *
 * - "Writing goal history" (heading icon: `GOAL_WIDGET_ICON`, the same one as
 *   the sidebar widget's) — two bordered cards, stacked (same card styling as
 *   the sidebar widget). Top: today/week/month totals as plain circles (no
 *   progress arc — this is a record, not a goal being tracked live). Bottom:
 *   the same month calendar as the right-sidebar `GoalWidgetView`, plus a
 *   click-a-day-to-see-its-total interaction (a circle beside the calendar,
 *   inside the same card) the sidebar version doesn't have.
 * - "Story Stats" (heading icon: `GOALS_STATS_TAB_ICON_ID`, this view's own)
 *   — not built yet.
 */
export class GoalsStatsTabView extends ItemView {
	/** Which month is on screen; starts on the current month each time the view opens. */
	private cursor = new Date();
	/** The day last clicked in the calendar, or null if none has been (yet, or since navigating). */
	private selectedDay: CalendarCell | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: ScribeGoalsStatsPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_GOALS_STATS_TAB;
	}

	getDisplayText(): string {
		return "(SL) G & S: Goals & Stats";
	}

	getIcon(): string {
		return GOALS_STATS_TAB_ICON_ID;
	}

	onOpen(): Promise<void> {
		this.register(this.plugin.goalHistoryStore.onChange(() => this.render()));
		this.render();
		return Promise.resolve();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("scribe-goals-view");

		this.renderGoalHistorySection(contentEl);
		contentEl.createEl("hr", { cls: "scribe-stats-divider" });
		this.renderStoryStatsSection(contentEl);
	}

	private renderGoalHistorySection(containerEl: HTMLElement): void {
		this.renderSectionTitle(containerEl, GOAL_WIDGET_ICON, "Writing goal history");

		const { dailyGoal, metric } = this.plugin.settings;
		const history = this.plugin.goalHistoryStore.getHistory();
		const today = new Date();
		// Sunday-first, matching the calendar below.
		const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
		const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

		const stack = containerEl.createDiv({ cls: "scribe-goal-history-stack" });

		// Today/week/month, centred, in its own bordered card — same treatment
		// as the sidebar widget's own summary card.
		const totalsCard = stack.createDiv({ cls: "scribe-goal-card" });
		const totals = totalsCard.createDiv({ cls: "scribe-stat-circle-row" });
		this.renderStatCircle(totals, "Today", writtenFor(history, dateKey(today), metric), metric);
		this.renderStatCircle(
			totals,
			"This week",
			writtenBetween(history, dateKey(startOfWeek), dateKey(today), metric),
			metric,
		);
		this.renderStatCircle(
			totals,
			"This month",
			writtenBetween(history, dateKey(startOfMonth), dateKey(today), metric),
			metric,
		);

		// The calendar, and — once a day is clicked — its detail circle beside
		// it, together in one bordered card below the totals. `mod-calendar`
		// fixes the card's width so it never resizes: neither a longer month
		// name (e.g. "September" vs "May") nor the detail circle appearing or
		// disappearing changes the card's footprint.
		const calendarCard = stack.createDiv({ cls: "scribe-goal-card mod-calendar" });
		const calendarRow = calendarCard.createDiv({ cls: "scribe-goal-history-row" });

		// A fixed width (not just the outer card's) — otherwise this wrapper's
		// own size follows its content, and a longer month name's nav row can
		// need more room than the grid, widening the card for that month only.
		const calendarBlock = calendarRow.createDiv({ cls: "scribe-goal-calendar-block" });
		renderCalendarWidget(calendarBlock, {
			cursor: this.cursor,
			dailyGoal,
			metric,
			writtenForDate: (iso) => writtenFor(history, iso, metric),
			onNavigate: (next) => {
				this.cursor = next;
				this.selectedDay = null;
				this.render();
			},
			onDayClick: (cell) => {
				this.selectedDay = cell;
				this.render();
			},
		});

		if (this.selectedDay) {
			const label = this.selectedDay.date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
			const total = writtenFor(history, this.selectedDay.iso, metric);
			const circle = this.renderStatCircle(calendarRow, label, total, metric);
			circle.setAttr(
				"aria-label",
				this.selectedDay.date.toLocaleDateString(undefined, {
					weekday: "long",
					month: "long",
					day: "numeric",
					year: "numeric",
				}),
			);
		}
	}

	/** A plain circle — no progress arc, this is a record of a total, not a goal in progress. */
	private renderStatCircle(
		containerEl: HTMLElement,
		label: string,
		value: number,
		metric: GoalMetric,
	): HTMLElement {
		const circle = containerEl.createDiv({ cls: "scribe-stat-circle" });
		circle.createDiv({ cls: "scribe-goal-ring-label", text: label });
		circle.createDiv({ cls: "scribe-goal-ring-value", text: value.toLocaleString() });
		circle.createDiv({ cls: "scribe-goal-ring-unit", text: metric });
		return circle;
	}

	private renderStoryStatsSection(containerEl: HTMLElement): void {
		this.renderSectionTitle(containerEl, GOALS_STATS_TAB_ICON_ID, "Story Stats");
		containerEl.createEl("p", {
			cls: "scribe-stats-placeholder",
			text: "Statistics options will appear here in a future release.",
		});
	}

	/** A section heading with its own icon — the same one as the section's ribbon/tab. */
	private renderSectionTitle(containerEl: HTMLElement, iconId: string, text: string): void {
		const heading = containerEl.createEl("h1", { cls: "scribe-stats-section-title" });
		setIcon(heading.createSpan({ cls: "scribe-stats-section-icon" }), iconId);
		heading.createSpan({ text });
	}
}
