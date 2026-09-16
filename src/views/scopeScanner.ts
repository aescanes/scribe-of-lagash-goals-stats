// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { App, Component, debounce } from "obsidian";
import { measureBoth } from "../data/textMetrics";
import { isExcluded } from "../data/exclusion";
import { inStoryFolder } from "../data/scope";

/** The settings slice the scanner needs, read lazily so it always sees current values. */
export interface ScopeScannerConfig {
	storyFolder: string;
	excludedPaths: string[];
}

/** Both metrics for one file, measured together from a single read. */
export interface FileMetrics {
	words: number;
	characters: number;
}

/**
 * Scans the story folder's (or, when empty, the whole vault's) markdown notes
 * once per change and shares the result — both the file-explorer badges and
 * the writing-goal history need "how much has been written", and this is the
 * one place that reads every in-scope note, so neither reads the vault twice.
 * Excluded paths and Scribe-generated files are skipped.
 */
export class ScopeScanner extends Component {
	private perFile = new Map<string, FileMetrics>();
	/** Each in-scope file's raw text, from the same read `perFile` was measured
	 *  from — kept for `GoalHistoryStore`'s word-level diff, so it doesn't have
	 *  to read the vault a second time itself. */
	private perFileContent = new Map<string, string>();
	private listeners: Array<() => void> = [];

	/** Coalesces bursts of vault/metadata events into one rescan. */
	private scheduleRefresh = debounce(() => void this.refresh(), 300, true);

	constructor(
		private app: App,
		private getConfig: () => ScopeScannerConfig,
	) {
		super();
	}

	onload(): void {
		this.app.workspace.onLayoutReady(() => void this.refresh());
		this.registerEvent(this.app.metadataCache.on("resolved", () => this.scheduleRefresh()));
		this.registerEvent(this.app.vault.on("modify", () => this.scheduleRefresh()));
		this.registerEvent(this.app.vault.on("create", () => this.scheduleRefresh()));
		this.registerEvent(this.app.vault.on("delete", () => this.scheduleRefresh()));
		this.registerEvent(this.app.vault.on("rename", () => this.scheduleRefresh()));
	}

	/** Notified after every rescan completes. Returns an unsubscribe function. */
	onChange(listener: () => void): () => void {
		this.listeners.push(listener);
		return () => {
			this.listeners = this.listeners.filter((l) => l !== listener);
		};
	}

	/** Both metrics for every in-scope file, from the most recent scan. */
	getPerFile(): ReadonlyMap<string, FileMetrics> {
		return this.perFile;
	}

	/** Each in-scope file's raw text, from the most recent scan. */
	getPerFileContent(): ReadonlyMap<string, string> {
		return this.perFileContent;
	}

	/** Both metrics summed across every in-scope file. */
	getTotals(): FileMetrics {
		let words = 0;
		let characters = 0;
		for (const metrics of this.perFile.values()) {
			words += metrics.words;
			characters += metrics.characters;
		}
		return { words, characters };
	}

	/** Rescans in-scope notes; safe to call from anywhere (e.g. when settings change). */
	async refresh(): Promise<void> {
		const { storyFolder, excludedPaths } = this.getConfig();

		const files = this.app.vault
			.getMarkdownFiles()
			.filter((file) => inStoryFolder(file.path, storyFolder) && !isExcluded(file.path, excludedPaths));

		const perFile = new Map<string, FileMetrics>();
		const perFileContent = new Map<string, string>();
		await Promise.all(
			files.map(async (file) => {
				const content = await this.app.vault.cachedRead(file);
				perFile.set(file.path, measureBoth(content));
				perFileContent.set(file.path, content);
			}),
		);

		this.perFile = perFile;
		this.perFileContent = perFileContent;
		for (const listener of this.listeners) listener();
	}
}
