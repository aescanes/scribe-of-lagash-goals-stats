// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { App, Component, debounce, normalizePath, TFile, TFolder } from "obsidian";
import { dateKey, FileText, GoalHistory, parseHistory, serializeHistory, writtenAcrossFiles } from "../data/goalHistory";
import type { ScopeScanner } from "./scopeScanner";

/** The settings slice the store needs, read lazily so it always sees current values. */
export interface GoalHistoryStoreConfig {
	storyFolder: string;
}

/** Every in-scope file's text at the moment a given day started. */
export interface TodayTextBaseline {
	date: string;
	perFile: FileText;
}

/**
 * Reads and writes the day's start-of-day text snapshot. Backed by plugin
 * data (`saveData()`/`loadData()`), not the vault-synced history file — it's
 * only ever needed for *today*, to survive an Obsidian restart mid-day, so it
 * doesn't need to travel with the vault or outlive an uninstall the way the
 * actual history does. Losing it (a fresh install, a cleared plugin folder)
 * just means the next `recordToday()` re-establishes the baseline from
 * wherever the scope stands right now, same as any other first day.
 */
export interface TodayTextBaselineCache {
	load: () => Promise<TodayTextBaseline | null>;
	save: (cache: TodayTextBaseline) => Promise<void>;
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
	/** Every in-scope file's own text at the moment the current day started —
	 *  fixed for the rest of that day; "written" is always a diff against this. */
	private dayStartText: FileText | null = null;
	/** Which date `dayStartText` belongs to, so a day rollover is detected. */
	private dayStartDate: string | null = null;
	private listeners: Array<() => void> = [];

	/** Coalesces bursts of scanner updates into one write. */
	private scheduleSave = debounce(() => void this.save(), 1000, true);

	constructor(
		private app: App,
		private scanner: ScopeScanner,
		private getConfig: () => GoalHistoryStoreConfig,
		private textCache: TodayTextBaselineCache,
	) {
		super();
	}

	onload(): void {
		// Deliberately not also triggered from `workspace.onLayoutReady()`: the
		// scanner's own `onLayoutReady` callback (registered when it was added as
		// a child, before this store) always ends its first `refresh()` by
		// notifying listeners — including this one, registered just below —
		// before that promise resolves. Triggering `recordToday()` here too could
		// win the race and run against an empty, not-yet-scanned scope, wrongly
		// treating today's baseline as "nothing exists yet" and crediting the
		// entire scope as "written today" the moment the real scan lands.
		this.register(this.scanner.onChange(() => void this.recordToday()));
		// Nothing else fires exactly at midnight; a coarse poll catches the day
		// rolling over during a long-running session with no edits.
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
		// A different file means a different scope, and possibly a different
		// today baseline; recompute it fresh the next time recordToday() runs.
		this.dayStartDate = null;
		this.dayStartText = null;
	}

	/**
	 * "Written today" is a real word-level diff (`writtenAcrossFiles`) between
	 * every in-scope file's text right now and its own text at the moment today
	 * started — so an old paragraph disappearing never counts against today,
	 * while deleting part of what was typed *today* correctly drops back out of
	 * it. That start-of-day snapshot is fixed once per calendar day: for a day
	 * with no snapshot yet (including the very first day ever tracked) it's
	 * wherever the scope's text stands right now, so a fresh day starts at 0
	 * rather than crediting an already-existing manuscript; for a day already
	 * partway through (e.g. resuming after a restart) it's recovered from
	 * `textCache`, so progress made earlier today before the restart isn't
	 * lost. A day recorded before this text-diff tracking shipped, or one
	 * resumed after `textCache`'s own storage was cleared, has no snapshot to
	 * recover — that one day falls back to "today started right now", same as
	 * a brand-new day.
	 */
	async recordToday(): Promise<void> {
		await this.ensureLoaded();

		const currentText: FileText = {};
		for (const [path, content] of this.scanner.getPerFileContent()) currentText[path] = content;
		const today = dateKey(new Date());

		if (this.dayStartDate !== today) {
			const cached = await this.textCache.load();
			this.dayStartText = cached && cached.date === today ? cached.perFile : currentText;
			this.dayStartDate = today;
			if (!cached || cached.date !== today) await this.textCache.save({ date: today, perFile: this.dayStartText });
		}

		// Falls back to "today started right now" in the unreachable case where
		// the block above hasn't run yet — sound either way, never just a cast.
		const baselineText = this.dayStartText ?? currentText;
		const written = writtenAcrossFiles(baselineText, currentText);

		this.history = { ...this.history, [today]: { written } };

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
