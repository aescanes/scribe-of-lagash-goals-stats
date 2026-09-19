// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { ItemView, setIcon, WorkspaceLeaf } from "obsidian";
import type ScribeGoalsStatsPlugin from "../main";
import { CalendarCell, dayStatus } from "../data/calendarGrid";
import { formatCount } from "../data/countFormat";
import { dateKey, GoalHistory, resolveDayGoal, writtenBetween, writtenFor } from "../data/goalHistory";
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
	`<g fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">` +
	`<path d="M12.5 12.5v66.67a8.33 8.33 0 0 0 8.33 8.33h66.67"/>` +
	`<path d="M79.17 37.5l-20.83 20.83-16.67-16.67-12.5 12.5"/></g>`;

/** A period total plus how many days it spans, for the "(N per day)" line. */
interface PeriodStat {
	label: string;
	total: number;
	days: number;
}

/**
 * Main-area tab: the full "Goals and Stats" picture. Opens as a tab, like the
 * Visualization plugin's StoryLines, rather than a sidebar — this is meant to
 * be worked in, not just glanced at alongside writing. Two sections,
 * separated by a divider:
 *
 * - "Writing goal history" (heading icon: `GOAL_WIDGET_ICON`, the same one as
 *   the sidebar widget's) — two bordered cards side by side.
 *   - Left: the same month calendar as the right-sidebar `GoalWidgetView`,
 *     with a small side panel to its right, top-aligned with it: Today's
 *     total always shown, and — when a day other than today is clicked — that
 *     day's total below it, in the same plain style (no average; a single
 *     day has no "per day" to average). That slot is always reserved, empty
 *     or not, so filling it in never resizes the card or shifts "Story
 *     Stats" below.
 *   - Right: plain (no circle) period stats (`.scribe-stat-plain`) — This
 *     week / This month / This year, then Last 7 days / Last 30 days / Last
 *     365 days — each showing its total (`formatCount`) and, since these are
 *     multi-day windows, a "(N per day)" average below it.
 * - "Story Stats" (heading icon: `GOALS_STATS_TAB_ICON_ID`, this view's own)
 *   — not built yet.
 */
export class GoalsStatsTabView extends ItemView {
	/** Which month is on screen; starts on the current month each time the view opens. */
	private cursor = new Date();
	/** The non-today day last clicked in the calendar, or null (none yet, cleared, or navigated away from). */
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
		return "(SL) Goals and Stats";
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

		const columns = containerEl.createDiv({ cls: "scribe-goal-history-columns" });
		this.renderCalendarCard(columns, history, dailyGoal, metric);
		this.renderTotalsCard(columns, history, metric);
	}

	/**
	 * Left column: This week / This month / This year, then Last 7 days /
	 * Last 30 days / Last 365 days — each with a "(N per day)" average, since
	 * these are multi-day windows. "This week"/"This month"/"This year"
	 * average over the days elapsed *so far* in that period (not its full
	 * length), so an in-progress week, month, or year doesn't read as an
	 * artificially slow pace.
	 */
	private renderTotalsCard(containerEl: HTMLElement, history: GoalHistory, metric: GoalMetric): void {
		const today = new Date();
		const todayIso = dateKey(today);
		// Sunday-first, matching the calendar; getDay() is 0 (Sun) to 6 (Sat).
		const daysIntoWeek = today.getDay() + 1;
		const daysIntoMonth = today.getDate();
		const startOfYearDate = new Date(today.getFullYear(), 0, 1);
		const daysIntoYear = Math.round((today.getTime() - startOfYearDate.getTime()) / 86_400_000) + 1;
		const startOfWeek = dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay()));
		const startOfMonth = dateKey(new Date(today.getFullYear(), today.getMonth(), 1));
		const startOfYear = dateKey(startOfYearDate);
		const last7Start = dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6));
		const last30Start = dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29));
		const last365Start = dateKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 364));

		const card = containerEl.createDiv({ cls: "scribe-goal-card" });

		this.renderStatRow(
			card,
			[
				{
					label: "This week",
					total: writtenBetween(history, startOfWeek, todayIso, metric),
					days: daysIntoWeek,
				},
				{
					label: "This month",
					total: writtenBetween(history, startOfMonth, todayIso, metric),
					days: daysIntoMonth,
				},
				{
					label: "This year",
					total: writtenBetween(history, startOfYear, todayIso, metric),
					days: daysIntoYear,
				},
			],
			metric,
		);
		card.createEl("hr", { cls: "scribe-stat-row-divider" });
		this.renderStatRow(
			card,
			[
				{ label: "Last 7 days", total: writtenBetween(history, last7Start, todayIso, metric), days: 7 },
				{ label: "Last 30 days", total: writtenBetween(history, last30Start, todayIso, metric), days: 30 },
				{ label: "Last 365 days", total: writtenBetween(history, last365Start, todayIso, metric), days: 365 },
			],
			metric,
		);
	}

	private renderStatRow(containerEl: HTMLElement, items: PeriodStat[], metric: GoalMetric): void {
		const row = containerEl.createDiv({ cls: "scribe-stat-row" });
		for (const item of items) {
			const cell = row.createDiv({ cls: "scribe-stat-plain" });
			cell.createDiv({ cls: "scribe-stat-plain-value", text: formatCount(item.total, metric, false) });
			const perDay = Math.round(item.total / item.days);
			cell.createDiv({ cls: "scribe-stat-plain-average", text: `(${perDay.toLocaleString()} per day)` });
			cell.createDiv({ cls: "scribe-stat-plain-label", text: item.label });
		}
	}

	/** Value above its label — no average line; used for period stats (via `renderStatRow`) and the day panel alike. */
	private renderStatCell(containerEl: HTMLElement, label: string, valueText: string): HTMLElement {
		const cell = containerEl.createDiv({ cls: "scribe-stat-plain" });
		cell.createDiv({ cls: "scribe-stat-plain-value", text: valueText });
		cell.createDiv({ cls: "scribe-stat-plain-label", text: label });
		return cell;
	}

	/**
	 * Right column: the calendar, with a side panel top-aligned beside it —
	 * Today's total always shown, and a reserved slot below it for a clicked
	 * day's total. That slot exists (empty or not) whether or not a day is
	 * selected, so filling it in never resizes the card.
	 */
	private renderCalendarCard(
		containerEl: HTMLElement,
		history: GoalHistory,
		dailyGoal: number,
		metric: GoalMetric,
	): void {
		const todayIso = dateKey(new Date());
		const card = containerEl.createDiv({ cls: "scribe-goal-card mod-calendar" });
		const layout = card.createDiv({ cls: "scribe-goal-calendar-columns" });

		const calendarBlock = layout.createDiv({ cls: "scribe-goal-calendar-block" });
		renderCalendarWidget(calendarBlock, {
			cursor: this.cursor,
			metric,
			writtenForDate: (iso) => writtenFor(history, iso, metric),
			statusForDate: (iso) => {
				const { written, dailyGoal: goal } = resolveDayGoal(history, iso, { dailyGoal, metric });
				return dayStatus(written, goal);
			},
			onNavigate: (next) => {
				this.cursor = next;
				this.selectedDay = null;
				this.render();
			},
			onDayClick: (cell) => {
				// Today's own total is already shown permanently above; clicking
				// it just clears any other day's detail rather than repeating it.
				this.selectedDay = cell.iso === todayIso ? null : cell;
				this.render();
			},
		});

		const side = layout.createDiv({ cls: "scribe-goal-calendar-side" });

		const todayBox = side.createDiv({ cls: "scribe-goal-calendar-side-box" });
		this.renderStatCell(todayBox, "Today", formatCount(writtenFor(history, todayIso, metric), metric, false));

		const detailSlot = side.createDiv({ cls: "scribe-goal-calendar-side-box" });
		if (this.selectedDay) {
			const label = this.selectedDay.date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
			const total = writtenFor(history, this.selectedDay.iso, metric);
			const cell = this.renderStatCell(detailSlot, label, formatCount(total, metric, false));
			cell.setAttr(
				"aria-label",
				this.selectedDay.date.toLocaleDateString(undefined, {
					weekday: "long",
					month: "long",
					day: "numeric",
					year: "numeric",
				}),
			);
		} else {
			// Kept in the layout (same reserved size as todayBox) but invisible —
			// clicking a day should reveal the box, not shift "Today" down to meet it.
			detailSlot.addClass("mod-empty");
		}
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
