// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { App, Component, debounce, WorkspaceLeaf } from "obsidian";
import { measure } from "../data/textMetrics";
import { folderTotals } from "../data/countTree";
import { formatCount } from "../data/countFormat";
import { isExcluded } from "../data/exclusion";
import { inStoryFolder } from "../data/scope";
import type { GoalMetric } from "../settings/settings";

/** The settings slice the decorator needs, read lazily so it always sees current values. */
export interface ExplorerDecoratorConfig {
	storyFolder: string;
	excludedPaths: string[];
	metric: GoalMetric;
}

/**
 * Minimal shape of Obsidian's built-in file-explorer view. It is not part of the
 * public API, so this describes only the two things used here: the per-path item
 * map and each item's row element.
 */
interface FileExplorerItem {
	selfEl?: HTMLElement;
	titleEl?: HTMLElement;
}
interface FileExplorerView {
	fileItems?: Record<string, FileExplorerItem>;
}

const FILE_EXPLORER_TYPE = "file-explorer";
const COUNT_CLASS = "scribe-explorer-count";

/**
 * Shows a word (or character) count next to every note and folder in the file
 * explorer that is inside the story folder: a note shows its own count, a folder
 * the sum of the notes beneath it. Excluded paths and Scribe-generated files are
 * skipped. Counts are cached and recomputed on vault and metadata changes.
 */
export class ExplorerDecorator extends Component {
	private fileCounts = new Map<string, number>();
	private folderCounts = new Map<string, number>();
	private observer: MutationObserver | null = null;

	/** Coalesces bursts of vault/metadata events into one rescan. */
	private scheduleRefresh = debounce(() => void this.refresh(), 300, true);
	/** Coalesces explorer DOM mutations (folder expand, rebuild) into one repaint. */
	private schedulePaint = debounce(() => this.paint(), 50, true);

	constructor(
		private app: App,
		private getConfig: () => ExplorerDecoratorConfig,
	) {
		super();
	}

	onload(): void {
		this.app.workspace.onLayoutReady(() => {
			void this.refresh();
			this.observeExplorer();
		});

		this.registerEvent(this.app.metadataCache.on("resolved", () => this.scheduleRefresh()));
		this.registerEvent(this.app.vault.on("modify", () => this.scheduleRefresh()));
		this.registerEvent(this.app.vault.on("create", () => this.scheduleRefresh()));
		this.registerEvent(this.app.vault.on("delete", () => this.scheduleRefresh()));
		this.registerEvent(this.app.vault.on("rename", () => this.scheduleRefresh()));

		// The explorer leaf can be recreated (layout restore, moving the sidebar);
		// re-attach the observer and repaint when the workspace layout changes.
		this.registerEvent(
			this.app.workspace.on("layout-change", () => {
				this.observeExplorer();
				this.schedulePaint();
			}),
		);

		this.register(() => this.teardown());
	}

	/** Rescans in-scope notes, recomputes folder totals, and repaints. */
	async refresh(): Promise<void> {
		const { storyFolder, excludedPaths, metric } = this.getConfig();

		const files = this.app.vault
			.getMarkdownFiles()
			.filter((file) => inStoryFolder(file.path, storyFolder) && !isExcluded(file.path, excludedPaths));

		const counts: Record<string, number> = {};
		await Promise.all(
			files.map(async (file) => {
				const content = await this.app.vault.cachedRead(file);
				counts[file.path] = measure(content, metric);
			}),
		);

		this.fileCounts = new Map(Object.entries(counts));
		this.folderCounts = new Map(Object.entries(folderTotals(counts)));
		this.paint();
	}

	private explorerLeaf(): WorkspaceLeaf | undefined {
		return this.app.workspace.getLeavesOfType(FILE_EXPLORER_TYPE)[0];
	}

	private explorerView(): FileExplorerView | undefined {
		const leaf = this.explorerLeaf();
		return leaf ? (leaf.view as unknown as FileExplorerView) : undefined;
	}

	/** Writes (or clears) the count badge on every explorer row. */
	private paint(): void {
		const items = this.explorerView()?.fileItems;
		if (!items) return;

		// Our own DOM writes would retrigger the observer; pause it for the pass.
		this.observer?.disconnect();
		try {
			const metric = this.getConfig().metric;
			for (const [path, item] of Object.entries(items)) {
				const row = item.selfEl ?? item.titleEl;
				if (!row) continue;
				const isFolder = this.folderCounts.has(path);
				const count = isFolder ? this.folderCounts.get(path) : this.fileCounts.get(path);
				this.setBadge(row, count, metric, isFolder);
			}
		} finally {
			this.reconnectObserver();
		}
	}

	private setBadge(
		row: HTMLElement,
		count: number | undefined,
		metric: GoalMetric,
		isFolder: boolean,
	): void {
		let badge = row.querySelector<HTMLElement>(`:scope > .${COUNT_CLASS}`);
		if (count === undefined) {
			badge?.remove();
			return;
		}
		if (!badge) {
			badge = createSpan({ cls: COUNT_CLASS });
			// Sit right after the name text, not at the far end of the row.
			const name = row.querySelector<HTMLElement>(":scope > .tree-item-inner");
			if (name) name.insertAdjacentElement("afterend", badge);
			else row.appendChild(badge);
		}
		badge.toggleClass("mod-folder", isFolder);
		badge.toggleClass("mod-note", !isFolder);
		badge.setText(formatCount(count, metric, isFolder));
	}

	private observeExplorer(): void {
		const container = this.explorerContainer();
		if (!container) return;
		if (this.observer) this.observer.disconnect();
		else this.observer = new MutationObserver(() => this.schedulePaint());
		this.observer.observe(container, { childList: true, subtree: true });
	}

	private reconnectObserver(): void {
		const container = this.explorerContainer();
		if (this.observer && container) {
			this.observer.observe(container, { childList: true, subtree: true });
		}
	}

	private explorerContainer(): HTMLElement | null {
		const leaf = this.explorerLeaf();
		return leaf?.view.containerEl.querySelector<HTMLElement>(".nav-files-container") ?? null;
	}

	/** Removes every badge and stops observing — run on unload. */
	private teardown(): void {
		this.observer?.disconnect();
		this.observer = null;
		const items = this.explorerView()?.fileItems ?? {};
		for (const item of Object.values(items)) {
			(item.selfEl ?? item.titleEl)?.querySelector(`.${COUNT_CLASS}`)?.remove();
		}
	}
}
