// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { Component, Notice } from "obsidian";
import { dayStatus } from "../data/calendarGrid";
import { formatCount } from "../data/countFormat";
import { dateKey, writtenFor } from "../data/goalHistory";
import type { GoalMetric } from "../settings/settings";
import { playConfettiBurst } from "./confetti";
import type { GoalHistoryStore } from "./goalHistoryStore";

/** The settings slice the celebration needs, read lazily so it always sees current values. */
export interface GoalCelebrationConfig {
	dailyGoal: number;
	metric: GoalMetric;
}

/**
 * Announces the daily goal being reached even when the goal widget isn't
 * open, so reaching it isn't only visible to whoever happens to have the
 * right sidebar open at the time: a toast (`Notice`) plus a confetti burst
 * each time it's freshly crossed — including a second time the same day, if
 * it's dipped back under and climbed over again — and a status-bar item
 * (desktop only — mobile has no status bar, so this half is a no-op there)
 * that stays lit whenever the goal currently stands met. All three read
 * `GoalHistoryStore`, so "reached" always agrees with the ring and calendar
 * rather than being computed a second way.
 */
export class GoalCelebration extends Component {
	/** Whether the goal was met as of the last update — the toast fires again
	 *  each time "met" newly turns true, not just once per day: dipping back
	 *  under the goal (e.g. deleting more than you type in the same edit) and
	 *  climbing back over it later is a fresh "reached" moment, not a repeat of
	 *  the first one. */
	private wasMet = false;
	/** Whether `update()` has run at least once yet — the very first run just
	 *  establishes `wasMet`'s starting point silently, rather than treating
	 *  "the goal happens to already be met when Obsidian opens" as a rising
	 *  edge. Without this, reopening Obsidian on a day the goal was already
	 *  reached would re-fire the toast even though nothing was just written. */
	private hasRun = false;

	constructor(
		private goalHistoryStore: GoalHistoryStore,
		private getConfig: () => GoalCelebrationConfig,
		private statusBarEl: HTMLElement,
	) {
		super();
		this.statusBarEl.addClass("scribe-goal-status-bar");
	}

	onload(): void {
		// Deliberately not also calling update() directly here: at this point
		// GoalHistoryStore hasn't necessarily recorded today's data yet (its own
		// first recordToday() is itself deferred to the scanner's first real
		// scan completing — see its onload() for why). Calling update() early
		// would read an empty history, wrongly setting hasRun/wasMet's baseline
		// against "nothing written yet" instead of the real starting state —
		// then the actual first update, once real data arrives, would see
		// hasRun already true and fire the toast if the goal was already met
		// before Obsidian even opened. onChange() alone guarantees the first
		// call this component sees carries real data.
		this.register(this.goalHistoryStore.onChange(() => this.update()));
	}

	private update(): void {
		const { dailyGoal, metric } = this.getConfig();
		const today = dateKey(new Date());
		const written = writtenFor(this.goalHistoryStore.getHistory(), today, metric);
		const met = dayStatus(written, dailyGoal) === "met";

		this.statusBarEl.toggleClass("mod-hidden", !met);
		this.statusBarEl.setText(met ? "🎯 Daily writing goal reached" : "");

		if (met && !this.wasMet && this.hasRun) {
			new Notice(`🎉 Daily writing goal reached! You wrote ${formatCount(written, metric, false)} today.`);
			playConfettiBurst();
		}
		this.wasMet = met;
		this.hasRun = true;
	}
}
