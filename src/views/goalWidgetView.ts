// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { ItemView, setIcon, WorkspaceLeaf } from "obsidian";
import type ScribeGoalsStatsPlugin from "../main";
import { dayStatus } from "../data/calendarGrid";
import { dateKey, resolveDayGoal, writtenBetween, writtenFor } from "../data/goalHistory";
import { formatDuration, sessionProgress } from "../data/writingSession";
import { renderCalendarWidget } from "./calendarWidget";
import { renderProgressRing } from "./progressRing";

export const VIEW_TYPE_GOAL_WIDGET = "scribe-goal-widget";
export const GOAL_WIDGET_ICON = "target";

/** The three one-click session lengths; a custom-minutes input covers anything else. */
const SESSION_PRESETS_MINUTES = [15, 30, 60];

/**
 * Right-sidebar widget: a ring for today's progress toward the daily goal, a
 * week/month summary, a month calendar colouring each day by whether it met,
 * partly met, or missed the goal, and — unrelated to any of that — a writing-
 * session countdown timer. Pure display — computation lives in `src/data/`.
 */
export class GoalWidgetView extends ItemView {
	/** Which month is on screen; starts on the current month each time the view opens. */
	private cursor = new Date();
	/** The session ring's own container — emptied and rebuilt on every tick,
	 *  separately from the controls below it (see `refreshSession`). */
	private sessionRingEl!: HTMLElement;
	private sessionPlayPauseEl!: HTMLButtonElement;
	private sessionResetEl!: HTMLButtonElement;
	private sessionCustomInputEl!: HTMLInputElement;

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
		// Not this.render(): the timer ticks once a second while a session runs,
		// and a full rebuild would tear down and recreate the custom-minutes
		// input on every tick — wiping out whatever's typed and, worse, stealing
		// focus away from it mid-keystroke. refreshSession() only ever touches
		// the ring and the play/pause icon, leaving the input and buttons alone.
		this.register(this.plugin.writingSessionTimer.onChange(() => this.refreshSession()));
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
		this.renderSessionCard(contentEl);
	}

	private renderRing(containerEl: HTMLElement): void {
		const { dailyGoal, metric } = this.plugin.settings;
		const today = dateKey(new Date());
		const written = writtenFor(this.plugin.goalHistoryStore.getHistory(), today, metric);
		const progress = dailyGoal > 0 ? written / dailyGoal : 0;
		const reached = progress >= 1;

		const card = containerEl.createDiv({ cls: "scribe-goal-card" });
		card.createDiv({ cls: "scribe-goal-card-title", text: "Goal" });

		renderProgressRing(card, {
			progress,
			reached,
			label: reached ? "Goal reached!" : "Today",
			valueText: written.toLocaleString(),
			unitText: metric,
		});

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
			metric,
			writtenForDate: (iso) => writtenFor(history, iso, metric),
			statusForDate: (iso) => {
				const { written, dailyGoal: goal } = resolveDayGoal(history, iso, { dailyGoal, metric });
				return dayStatus(written, goal);
			},
			onNavigate: (next) => {
				this.cursor = next;
				this.render();
			},
		});
	}

	/**
	 * A countdown card, unrelated to any calendar day — see
	 * `WritingSessionTimer`. Built once per `render()`; the ring and play/pause
	 * icon are then kept current by `refreshSession()` alone on every tick, so
	 * typing in the custom-minutes input is never interrupted by a rebuild.
	 */
	private renderSessionCard(containerEl: HTMLElement): void {
		const card = containerEl.createDiv({ cls: "scribe-goal-card" });
		card.createDiv({ cls: "scribe-goal-card-title", text: "Writing Session" });

		this.sessionRingEl = card.createDiv();

		const controls = card.createDiv({ cls: "scribe-session-controls" });

		// Custom length and play/pause share one row: `activateSession()` starts
		// a session from the input's value whenever there is one, regardless of
		// whether one's already running or paused — otherwise it just
		// pauses/resumes whatever's active.
		const custom = controls.createDiv({ cls: "scribe-session-custom" });
		this.sessionCustomInputEl = custom.createEl("input", {
			cls: "scribe-session-custom-input",
			attr: { type: "number", min: "1", step: "1", placeholder: "Minutes" },
		});
		// Typing a length while a session is running pauses it immediately —
		// the length you're entering isn't the one currently counting down.
		this.sessionCustomInputEl.addEventListener("input", () => {
			if (this.plugin.writingSessionTimer.getState().status === "running") {
				this.plugin.writingSessionTimer.togglePause();
			}
		});
		this.sessionCustomInputEl.addEventListener("keydown", (evt) => {
			if (evt.key === "Enter") this.activateSession();
		});

		this.sessionPlayPauseEl = custom.createEl("button", { cls: "clickable-icon scribe-session-play-pause" });
		this.sessionPlayPauseEl.addEventListener("click", () => this.activateSession());

		this.sessionResetEl = custom.createEl("button", { cls: "clickable-icon scribe-session-reset" });
		setIcon(this.sessionResetEl, "refresh-ccw");
		this.sessionResetEl.setAttr("aria-label", "Reset");
		this.sessionResetEl.addEventListener("click", () => {
			this.plugin.writingSessionTimer.reset();
			this.sessionCustomInputEl.value = "";
		});

		const presets = controls.createDiv({ cls: "scribe-session-presets" });
		for (const minutes of SESSION_PRESETS_MINUTES) {
			const preset = presets.createEl("button", { text: `${minutes} minutes` });
			preset.addEventListener("click", () => {
				this.plugin.writingSessionTimer.start(minutes);
				this.sessionCustomInputEl.value = "";
			});
		}

		this.refreshSession();
	}

	/** Updates just the ring and the play/pause icon from the timer's current
	 *  state — never touches the custom input or the preset buttons. */
	private refreshSession(): void {
		const state = this.plugin.writingSessionTimer.getState();

		this.sessionRingEl.empty();
		if (state.status === "idle") {
			renderProgressRing(this.sessionRingEl, { progress: 0, label: "Ready", valueText: "0:00" });
		} else {
			renderProgressRing(this.sessionRingEl, {
				progress: sessionProgress(state.remainingSeconds, state.totalSeconds),
				label: state.status === "paused" ? "Paused" : "Remaining",
				valueText: formatDuration(state.remainingSeconds),
			});
		}

		setIcon(this.sessionPlayPauseEl, state.status === "running" ? "pause" : "play");
		this.sessionPlayPauseEl.setAttr(
			"aria-label",
			state.status === "running" ? "Pause" : state.status === "paused" ? "Resume" : "Start",
		);

		this.sessionResetEl.disabled = state.status === "idle";
	}

	/** A custom length in the input always takes over, starting fresh, no
	 *  matter what the timer's doing; with none typed, this just toggles
	 *  pause/resume on whatever session is already active. */
	private activateSession(): void {
		const timer = this.plugin.writingSessionTimer;
		const minutes = Number(this.sessionCustomInputEl.value);
		if (minutes > 0) {
			timer.start(minutes);
		} else if (timer.getState().status !== "idle") {
			timer.togglePause();
		}
	}
}
