// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { App, Component, debounce, normalizePath, TFile, TFolder } from "obsidian";
import { DayTotals, dateKey, GoalHistory, parseHistory, serializeHistory } from "../data/goalHistory";
import type { ScopeScanner } from "./scopeScanner";

/** The settings slice the store needs, read lazily so it always sees current values. */
export interface GoalHistoryStoreConfig {
	storyFolder: string;
}

/**
 * Name of the plugin-managed history file. Fixed, not user-configurable —
 * unlike the Visualization plugin's Lines/Outline files, nobody is meant to
 * open or rename this one by hand.
 */
const HISTORY_FILE_NAME = "(SL) Goals History.json";

/**
 * Records each day's writing (both metrics, regardless of which is active) to
 * a plugin-managed JSON file inside the story folder — or the vault root when
 * no story folder is set, or it doesn't exist yet. Being a real vault file
 * (not plugin data under `.obsidian/`) means the history survives a plugin
 * uninstall/reinstall and travels with the vault through whatever the author
 * already syncs it with.
 */
export class GoalHistoryStore extends Component {
	private history: GoalHistory = {};
	private loadedPath: string | null = null;
	private lastSavedContent: string | null = null;
	/** The scope's total at the moment the current day started — fixed for the
	 *  rest of that day; "written" is always the live total minus this. */
	private dayStartTotal: DayTotals | null = null;
	/** Which date `dayStartTotal` belongs to, so a day rollover is detected. */
	private dayStartDate: string | null = null;
	private listeners: Array<() => void> = [];

	/** Coalesces bursts of scanner updates into one write. */
	private scheduleSave = debounce(() => void this.save(), 1000, true);

	constructor(
		private app: App,
		private scanner: ScopeScanner,
		private getConfig: () => GoalHistoryStoreConfig,
	) {
		super();
	}

	onload(): void {
		this.app.workspace.onLayoutReady(() => void this.recordToday());
		this.register(this.scanner.onChange(() => void this.recordToday()));
		// Nothing else fires exactly at midnight; a coarse poll catches the day
		// rolling over during a long-running Obsidian session with no edits.
		this.registerInterval(window.setInterval(() => void this.recordToday(), 5 * 60 * 1000));
	}

	/** Notified after the in-memory history changes (before the write to disk completes). */
	onChange(listener: () => void): () => void {
		this.listeners.push(listener);
		return () => {
			this.listeners = this.listeners.filter((l) => l !== listener);
		};
	}

	/** The full history loaded so far. Treat as read-only. */
	getHistory(): GoalHistory {
		return this.history;
	}

	/** Where the history file lives for the current story-folder setting. */
	private path(): string {
		const configured = normalizePath(this.getConfig().storyFolder.trim());
		const folderExists =
			configured !== "" && configured !== "." && this.app.vault.getAbstractFileByPath(configured) instanceof TFolder;
		return normalizePath(folderExists ? `${configured}/${HISTORY_FILE_NAME}` : HISTORY_FILE_NAME);
	}

	/** (Re)loads from disk when the resolved path has changed since the last load. */
	private async ensureLoaded(): Promise<void> {
		const path = this.path();
		if (this.loadedPath === path) return;
		const file = this.app.vault.getAbstractFileByPath(path);
		this.history = file instanceof TFile ? parseHistory(await this.app.vault.cachedRead(file)) : {};
		this.loadedPath = path;
		this.lastSavedContent = null;
		// A different file means a different diff baseline; recompute it fresh
		// the next time recordToday() runs, rather than reusing one from the
		// previous file.
		this.dayStartDate = null;
		this.dayStartTotal = null;
	}

	/**
	 * "Written today" is always the scope's current total minus its total at
	 * the moment today started — live, in both directions, like any ordinary
	 * word-count tracker (deleting text lowers it same as any other edit).
	 * That start-of-day baseline is fixed once per calendar day: for a day
	 * with no record yet (including the very first day ever tracked) it's
	 * wherever the scope stands right now, so a fresh day starts at 0 rather
	 * than crediting an already-existing manuscript; for a day already
	 * partway recorded (e.g. resuming after a restart) it's recovered from
	 * what's already stored (`total − written`), so progress made earlier
	 * today before the restart isn't lost.
	 */
	async recordToday(): Promise<void> {
		await this.ensureLoaded();

		const current = this.scanner.getTotals();
		const today = dateKey(new Date());

		if (this.dayStartDate !== today) {
			const recorded = this.history[today];
			this.dayStartTotal = recorded
				? {
						words: recorded.total.words - recorded.written.words,
						characters: recorded.total.characters - recorded.written.characters,
					}
				: current;
			this.dayStartDate = today;
		}

		// Falls back to "today started right now" in the unreachable case where
		// the block above hasn't run yet — sound either way, never just a cast.
		const baseline = this.dayStartTotal ?? current;
		const written: DayTotals = {
			words: Math.max(0, current.words - baseline.words),
			characters: Math.max(0, current.characters - baseline.characters),
		};

		this.history = { ...this.history, [today]: { total: current, written } };

		for (const listener of this.listeners) listener();
		this.scheduleSave();
	}

	private async save(): Promise<void> {
		const content = serializeHistory(this.history);
		if (content === this.lastSavedContent) return;

		const path = this.path();
		const file = this.app.vault.getAbstractFileByPath(path);
		try {
			if (file instanceof TFile) await this.app.vault.process(file, () => content);
			else await this.app.vault.create(path, content);
		} catch (err) {
			// Most likely the story folder doesn't exist yet (mid-typing in
			// settings) or a sync conflict; the next scheduled save retries. Log
			// it rather than failing silently — a *persistent* failure here
			// would otherwise look exactly like "nothing happens".
			console.error(`Scribe Goals & Stats: failed to save "${path}"`, err);
			return;
		}
		this.lastSavedContent = content;
	}
}
