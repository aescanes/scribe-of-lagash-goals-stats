// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { App, Component, debounce, setIcon, WorkspaceLeaf } from "obsidian";
import { folderTotals } from "../data/countTree";
import { formatCount } from "../data/countFormat";
import type { GoalMetric } from "../settings/settings";
import type { ScopeScanner } from "./scopeScanner";

/** The settings slice the decorator needs, read lazily so it always sees current values. */
export interface ExplorerDecoratorConfig {
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

/** Lucide icon marking which kind of row the badge is on. */
const TYPE_ICON = { folder: "folder", note: "file-text" } as const;

/**
 * Shows a word (or character) count next to every note and folder in the file
 * explorer that is inside the story folder: a note shows its own count, a folder
 * the sum of the notes beneath it. Counts come from a shared `ScopeScanner`
 * (which already applies the story-folder scope and exclusions), re-picked in
 * the active metric whenever the scanner rescans.
 */
export class ExplorerDecorator extends Component {
	private fileCounts = new Map<string, number>();
	private folderCounts = new Map<string, number>();
	private observer: MutationObserver | null = null;

	/** Coalesces explorer DOM mutations (folder expand, rebuild) into one repaint. */
	private schedulePaint = debounce(() => this.paint(), 50, true);

	constructor(
		private app: App,
		private scanner: ScopeScanner,
		private getConfig: () => ExplorerDecoratorConfig,
	) {
		super();
	}

	onload(): void {
		this.app.workspace.onLayoutReady(() => {
			this.recomputeFromScanner();
			this.observeExplorer();
		});

		this.register(this.scanner.onChange(() => this.recomputeFromScanner()));

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

	/** Re-picks this metric's counts from the scanner's latest scan, then repaints. */
	recomputeFromScanner(): void {
		const metric = this.getConfig().metric;
		const counts: Record<string, number> = {};
		for (const [path, metrics] of this.scanner.getPerFile()) {
			counts[path] = metric === "characters" ? metrics.characters : metrics.words;
		}

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
			// isFolder never changes for a given path, so the icon is fixed for the
			// badge's whole lifetime: build it once, then only refresh the text.
			badge = createSpan({ cls: COUNT_CLASS });
			setIcon(
				badge.createSpan({ cls: "scribe-explorer-count-icon" }),
				isFolder ? TYPE_ICON.folder : TYPE_ICON.note,
			);
			badge.createSpan({ cls: "scribe-explorer-count-text" });
			// Sit right after the name text, not at the far end of the row.
			const name = row.querySelector<HTMLElement>(":scope > .tree-item-inner");
			if (name) name.insertAdjacentElement("afterend", badge);
			else row.appendChild(badge);
		}
		badge.toggleClass("mod-folder", isFolder);
		badge.toggleClass("mod-note", !isFolder);

		const text = badge.querySelector<HTMLElement>(":scope > .scribe-explorer-count-text");
		text?.setText(formatCount(count, metric, isFolder));
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
