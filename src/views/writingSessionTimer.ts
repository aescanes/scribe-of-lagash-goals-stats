// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { Component, Notice } from "obsidian";
import { playBellSound } from "./bellSound";

export type WritingSessionState =
	| { status: "idle" }
	| { status: "running"; totalSeconds: number; remainingSeconds: number }
	| { status: "paused"; totalSeconds: number; remainingSeconds: number };

/** What's persisted for a session in progress — just enough to restore it as
 *  paused; never *running*, since resuming is always an explicit click. */
export interface PersistedWritingSession {
	totalSeconds: number;
	remainingSeconds: number;
}

/**
 * Reads and writes the one in-progress session, if any — synchronously.
 * Backed by `App.saveLocalStorage()`/`loadLocalStorage()` (vault-scoped,
 * device-local, available since Obsidian 1.8.7), deliberately *not* the
 * plugin's `saveData()`/`loadData()` used for settings and the goal-history
 * text baseline: those are async and go through the whole (potentially large,
 * since the text baseline holds full note contents) `data.json` blob on every
 * write, whereas this needs to persist roughly once a second while a session
 * runs, cheaply, and — critically — synchronously, so the very last tick
 * before Obsidian actually closes is guaranteed to be saved rather than lost
 * to an in-flight promise that never gets to finish.
 */
export interface WritingSessionPersistence {
	load: () => PersistedWritingSession | null;
	save: (session: PersistedWritingSession | null) => void;
}

/**
 * A plain countdown timer for a single writing session — deliberately
 * unrelated to any calendar day or the daily goal (see
 * docs/feature-plans/writing-session-plan.md): starting, pausing, or
 * finishing one has nothing to do with `GoalHistoryStore`. Lives at the
 * plugin level (a child `Component`, like `GoalHistoryStore`) rather than
 * inside `GoalWidgetView`, so the countdown keeps running even if the
 * sidebar view is closed and reopened while it's mid-session.
 *
 * A session in progress survives closing Obsidian: it's restored as
 * *paused*, wherever it was left off, so reopening and clicking play resumes
 * the countdown rather than losing it. It's never restored as still
 * running — there's no wall-clock accounting for time that passed while
 * Obsidian was closed, closing is simply treated as an automatic pause.
 */
export class WritingSessionTimer extends Component {
	private state: WritingSessionState = { status: "idle" };
	private listeners: Array<() => void> = [];
	private intervalId: number | null = null;

	constructor(private persistence: WritingSessionPersistence) {
		super();
	}

	/** The session's current state. Treat as read-only. */
	getState(): WritingSessionState {
		return this.state;
	}

	/** Notified after the state changes (started, paused, resumed, ticked, reset, or finished). */
	onChange(listener: () => void): () => void {
		this.listeners.push(listener);
		return () => {
			this.listeners = this.listeners.filter((l) => l !== listener);
		};
	}

	onload(): void {
		const persisted = this.persistence.load();
		if (persisted && persisted.totalSeconds > 0 && persisted.remainingSeconds > 0) {
			this.setState({
				status: "paused",
				totalSeconds: persisted.totalSeconds,
				remainingSeconds: persisted.remainingSeconds,
			});
		}
	}

	/** Starts a fresh session, replacing any session already running or paused. */
	start(minutes: number): void {
		const totalSeconds = Math.round(minutes * 60);
		if (totalSeconds <= 0) return;
		this.setState({ status: "running", totalSeconds, remainingSeconds: totalSeconds });
		this.startTicking();
	}

	/** Pauses a running session, or resumes a paused one; does nothing while idle. */
	togglePause(): void {
		if (this.state.status === "running") {
			this.setState({ ...this.state, status: "paused" });
			this.stopTicking();
		} else if (this.state.status === "paused") {
			this.setState({ ...this.state, status: "running" });
			this.startTicking();
		}
	}

	/** Cancels the current session outright — back to idle, no completion notice. */
	reset(): void {
		if (this.state.status === "idle") return;
		this.stopTicking();
		this.setState({ status: "idle" });
	}

	onunload(): void {
		this.stopTicking();
	}

	private tick(): void {
		if (this.state.status !== "running") return;
		const remainingSeconds = this.state.remainingSeconds - 1;
		if (remainingSeconds <= 0) {
			this.stopTicking();
			this.setState({ status: "idle" });
			new Notice("⏰ Writing session complete!");
			playBellSound();
		} else {
			this.setState({ ...this.state, remainingSeconds });
		}
	}

	/** (Re)starts the once-a-second tick, clearing any previous interval first
	 *  so pausing and resuming never stacks up more than one. */
	private startTicking(): void {
		this.stopTicking();
		this.intervalId = window.setInterval(() => this.tick(), 1000);
	}

	private stopTicking(): void {
		if (this.intervalId !== null) {
			window.clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	/** Every state change persists — including each tick. Since persistence
	 *  here is synchronous and vault-local (not a `data.json` round trip), that
	 *  costs nothing worth avoiding, and it means whatever's on disk is never
	 *  more than a second stale, however Obsidian actually closes. */
	private setState(state: WritingSessionState): void {
		this.state = state;
		for (const listener of this.listeners) listener();
		if (this.state.status === "idle") {
			this.persistence.save(null);
		} else {
			this.persistence.save({ totalSeconds: this.state.totalSeconds, remainingSeconds: this.state.remainingSeconds });
		}
	}
}
