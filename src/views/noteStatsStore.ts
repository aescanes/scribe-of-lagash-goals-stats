// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { App, Component, debounce, TFile } from "obsidian";
import type { GoalMetric } from "../settings/settings";
import { StatsRow } from "../data/statsTable";
import { SCRIBE_GENERATED_PREFIX } from "../data/exclusion";
import { findOutlineStatus, OutlineStatusRow, parseOutlineStatusRows } from "../data/outlineStatus";
import { normalizeStatus } from "../data/statusLabel";
import { computeNoteStats } from "../data/textStats";
import { stripFrontmatter } from "../data/textMetrics";
import { FRONTMATTER_KEYS, NoteStats, OUTLINE_MARKER } from "../types";
import type { ScopeScanner } from "./scopeScanner";

/** The settings slice the store needs, read lazily so it always sees current values. */
export interface NoteStatsConfig {
	metric: GoalMetric;
	charactersIncludeSpaces: boolean;
}

/** One Outline file's Status column, and the folder whose notes its rows plan. */
interface OutlineStatuses {
	folder: string;
	rows: OutlineStatusRow[];
}

interface CacheEntry {
	content: string;
	optionsKey: string;
	stats: NoteStats;
}

/**
 * The full per-note statistics (syllables, sentences, …) for the story table
 * and the note popup. `ScopeScanner` stays the one place that reads the vault
 * and keeps each in-scope note's text; this derives the heavier numbers from
 * that text on demand and caches them by content, so a note is only
 * re-measured when its text (or a reading setting) actually changed — and the
 * scanner's per-keystroke word/character counts never pay for syllables.
 * A note's status is the Status cell of the Visualization plugin's Outline row
 * that plans it or, when there is none, its `scribe-note-status` property (the
 * Outline wins, as in the Visualization plugin). Both are read-only.
 */
export class NoteStatsStore extends Component {
	private cache = new Map<string, CacheEntry>();
	private listeners: Array<() => void> = [];
	private outlines: OutlineStatuses[] = [];

	/** Coalesces bursts of typing/metadata events into one notification, so a
	 *  visible table isn't rebuilt on every keystroke. */
	private notifyLater = debounce(() => this.notify(), 300, true);
	private refreshOutlinesLater = debounce(() => void this.refreshOutlines(), 300, true);

	constructor(
		private app: App,
		private scanner: ScopeScanner,
		private getConfig: () => NoteStatsConfig,
	) {
		super();
	}

	onload(): void {
		this.register(this.scanner.onChange(() => this.notifyLater()));
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				if (file.name.startsWith(SCRIBE_GENERATED_PREFIX)) this.refreshOutlinesLater();
				this.notifyLater();
			}),
		);
		this.registerEvent(
			this.app.metadataCache.on("resolved", () => {
				this.refreshOutlinesLater();
				this.notifyLater();
			}),
		);
		this.registerEvent(this.app.vault.on("delete", () => this.refreshOutlinesLater()));
		this.registerEvent(this.app.vault.on("rename", () => this.refreshOutlinesLater()));
		this.app.workspace.onLayoutReady(() => void this.refreshOutlines());
	}

	/**
	 * Re-reads every Outline file in the vault. They are found by their
	 * frontmatter marker rather than a setting, so there is nothing to keep in
	 * sync with the Visualization plugin, and a vault with several books (one
	 * outline each) just works. Only `(SL) `-prefixed files are checked.
	 */
	private async refreshOutlines(): Promise<void> {
		const files = this.app.vault.getMarkdownFiles().filter((file) => this.isOutlineFile(file));
		const outlines = await Promise.all(
			files.map(async (file): Promise<OutlineStatuses> => {
				const content = await this.app.vault.cachedRead(file);
				return { folder: file.parent?.isRoot() ? "" : (file.parent?.path ?? ""), rows: parseOutlineStatusRows(stripFrontmatter(content)) };
			}),
		);
		// Deepest folder first, so a book nested in another book's folder uses its own outline.
		this.outlines = outlines.sort((a, b) => b.folder.length - a.folder.length);
		this.notifyLater();
	}

	private isOutlineFile(file: TFile): boolean {
		if (!file.name.startsWith(SCRIBE_GENERATED_PREFIX)) return false;
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
		return frontmatter?.[OUTLINE_MARKER.key] === OUTLINE_MARKER.value;
	}

	/** Notified (debounced) when any note's text, status or the reading settings may have changed. */
	onChange(listener: () => void): () => void {
		this.listeners.push(listener);
		return () => {
			this.listeners = this.listeners.filter((l) => l !== listener);
		};
	}

	/** Whether `path` is an in-scope, non-excluded note the scanner knows about. */
	has(path: string): boolean {
		return this.scanner.getPerFileContent().has(path);
	}

	/** Statistics for one in-scope note, or null if it is out of scope. */
	getStats(path: string): NoteStats | null {
		const content = this.scanner.getPerFileContent().get(path);
		return content === undefined ? null : this.statsFor(path, content);
	}

	/**
	 * The note's status, or "" when it has none. Same precedence as the
	 * Visualization plugin uses for every shared field: the Outline row wins,
	 * then the note's own property.
	 */
	getStatus(path: string): string {
		const file = this.app.vault.getFileByPath(path);
		if (!file) return "";
		const fromOutline = this.outlineStatus(path);
		if (fromOutline !== "") return fromOutline;
		const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
		return normalizeStatus(frontmatter?.[FRONTMATTER_KEYS.status]);
	}

	private outlineStatus(path: string): string {
		for (const outline of this.outlines) {
			if (outline.folder !== "" && !path.startsWith(`${outline.folder}/`)) continue;
			const relative = outline.folder === "" ? path : path.slice(outline.folder.length + 1);
			const status = findOutlineStatus(outline.rows, relative);
			if (status !== "") return status;
		}
		return "";
	}

	/** A table row for every in-scope note. */
	getRows(): StatsRow[] {
		const contents = this.scanner.getPerFileContent();
		// Drop notes that left scope or were deleted, so the cache can't grow forever.
		for (const path of this.cache.keys()) if (!contents.has(path)) this.cache.delete(path);

		const rows: StatsRow[] = [];
		for (const [path, content] of contents) {
			const slash = path.lastIndexOf("/");
			rows.push({
				path,
				name: path.slice(slash + 1).replace(/\.md$/i, ""),
				stats: this.statsFor(path, content),
				status: this.getStatus(path),
			});
		}
		return rows;
	}

	private statsFor(path: string, content: string): NoteStats {
		const { metric, charactersIncludeSpaces } = this.getConfig();
		const optionsKey = `${metric}|${charactersIncludeSpaces}`;

		const cached = this.cache.get(path);
		if (cached && cached.content === content && cached.optionsKey === optionsKey) return cached.stats;

		const stats = computeNoteStats(content, {
			metric,
			includeSpaces: charactersIncludeSpaces,
		});
		this.cache.set(path, { content, optionsKey, stats });
		return stats;
	}

	private notify(): void {
		for (const listener of this.listeners) listener();
	}
}
