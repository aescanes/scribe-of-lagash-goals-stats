// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { ItemView, WorkspaceLeaf } from "obsidian";
import type ScribeGoalsStatsPlugin from "../main";
import { dateKey, writtenBetween, writtenFor } from "../data/goalHistory";
import { renderCalendarWidget } from "./calendarWidget";

export const VIEW_TYPE_GOAL_WIDGET = "scribe-goal-widget";
export const GOAL_WIDGET_ICON = "target";

const SVG_NS = "http://www.w3.org/2000/svg";
const DISC_RADIUS = 52;
/** An SVG stroke is centred on its path, so the arc needs a smaller radius
 *  than the filled disc — by half its own width — to sit flush on the rim
 *  instead of sticking out past it. */
const ARC_STROKE_WIDTH = 10;
const ARC_RADIUS = DISC_RADIUS - ARC_STROKE_WIDTH / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * ARC_RADIUS;

/**
 * Right-sidebar widget: a ring for today's progress toward the daily goal,
 * and a month calendar colouring each day by whether it met, partly met, or
 * missed the goal. Pure display — computation lives in `src/data/`.
 */
export class GoalWidgetView extends ItemView {
	/** Which month is on screen; starts on the current month each time the view opens. */
	private cursor = new Date();

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: ScribeGoalsStatsPlugin,
	) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_GOAL_WIDGET;
	}

	getDisplayText(): string {
		return "(SL) G & S: Writing goal";
	}

	getIcon(): string {
		return GOAL_WIDGET_ICON;
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

		this.renderRing(contentEl);
		this.renderSummary(contentEl);
		this.renderCalendar(contentEl);
	}

	private renderRing(containerEl: HTMLElement): void {
		const { dailyGoal, metric } = this.plugin.settings;
		const today = dateKey(new Date());
		const written = writtenFor(this.plugin.goalHistoryStore.getHistory(), today, metric);
		const progress = dailyGoal > 0 ? Math.min(1, written / dailyGoal) : 0;
		const reached = progress >= 1;

		const card = containerEl.createDiv({ cls: "scribe-goal-card" });
		card.createDiv({ cls: "scribe-goal-card-title", text: "Goal" });

		const wrap = card.createDiv({ cls: "scribe-goal-ring-wrap" });
		wrap.toggleClass("mod-reached", reached);

		const svg = document.createElementNS(SVG_NS, "svg");
		svg.setAttribute("viewBox", "0 0 120 120");
		svg.setAttribute("class", "scribe-goal-ring");
		wrap.appendChild(svg);

		const track = document.createElementNS(SVG_NS, "circle");
		track.setAttribute("cx", "60");
		track.setAttribute("cy", "60");
		track.setAttribute("r", String(DISC_RADIUS));
		track.setAttribute("class", "scribe-goal-ring-track");
		svg.appendChild(track);

		const fill = document.createElementNS(SVG_NS, "circle");
		fill.setAttribute("cx", "60");
		fill.setAttribute("cy", "60");
		fill.setAttribute("r", String(ARC_RADIUS));
		fill.setAttribute("class", "scribe-goal-ring-fill");
		fill.setAttribute("stroke-dasharray", String(RING_CIRCUMFERENCE));
		fill.setAttribute("stroke-dashoffset", String(RING_CIRCUMFERENCE * (1 - progress)));
		svg.appendChild(fill);

		const center = wrap.createDiv({ cls: "scribe-goal-ring-center" });
		center.createDiv({ cls: "scribe-goal-ring-label", text: reached ? "Goal reached!" : "Today" });
		center.createDiv({ cls: "scribe-goal-ring-value", text: written.toLocaleString() });
		center.createDiv({ cls: "scribe-goal-ring-unit", text: metric });

		card.createDiv({
			cls: "scribe-goal-ring-caption",
			text: `of at least ${dailyGoal.toLocaleString()} ${metric}`,
		});
	}

	/** A compact card between the ring and the calendar: totals for the current week and month. */
	private renderSummary(containerEl: HTMLElement): void {
		const { metric } = this.plugin.settings;
		const history = this.plugin.goalHistoryStore.getHistory();
		const today = new Date();
		// Sunday-first, matching the calendar grid below.
		const startOfWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
		const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

		const weekTotal = writtenBetween(history, dateKey(startOfWeek), dateKey(today), metric);
		const monthTotal = writtenBetween(history, dateKey(startOfMonth), dateKey(today), metric);

		const card = containerEl.createDiv({ cls: "scribe-goal-card scribe-goal-summary" });
		this.renderSummaryItem(card, "This week", weekTotal);
		card.createDiv({ cls: "scribe-goal-summary-divider" });
		this.renderSummaryItem(card, "This month", monthTotal);
	}

	private renderSummaryItem(card: HTMLElement, label: string, value: number): void {
		const item = card.createDiv({ cls: "scribe-goal-summary-item" });
		item.createDiv({ cls: "scribe-goal-summary-value", text: value.toLocaleString() });
		item.createDiv({ cls: "scribe-goal-summary-label", text: label });
	}

	private renderCalendar(containerEl: HTMLElement): void {
		const { dailyGoal, metric } = this.plugin.settings;
		const history = this.plugin.goalHistoryStore.getHistory();

		const card = containerEl.createDiv({ cls: "scribe-goal-card" });
		renderCalendarWidget(card, {
			cursor: this.cursor,
			dailyGoal,
			metric,
			writtenForDate: (iso) => writtenFor(history, iso, metric),
			onNavigate: (next) => {
				this.cursor = next;
				this.render();
			},
		});
	}
}
