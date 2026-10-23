// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { App, Component, MarkdownView } from "obsidian";
import type { GoalMetric } from "../settings/settings";
import { GOALS_STATS_TAB_ICON_ID } from "./goalsStatsTabView";
import { NoteStatsModal } from "./noteStatsModal";
import type { NoteStatsStore } from "./noteStatsStore";

/**
 * The same stats icon as the status bar's, as a button in each note pane's
 * header (beside the title, with the reading-mode and "more options" buttons),
 * opening that note's stats popup. Unlike the status bar this works on mobile.
 * A pane's button is added once and then only shown or hidden, because the
 * pane can navigate to a different file — or out of scope — without being
 * recreated.
 */
export class NoteStatsHeaderAction extends Component {
	private actions = new WeakMap<MarkdownView, HTMLElement>();
	/** Every button added, so unload can remove them all (a WeakMap can't be walked). */
	private allActions = new Set<HTMLElement>();

	constructor(
		private app: App,
		private store: NoteStatsStore,
		private getMetric: () => GoalMetric,
	) {
		super();
	}

	onload(): void {
		const refresh = (): void => this.refresh();
		this.registerEvent(this.app.workspace.on("layout-change", refresh));
		this.registerEvent(this.app.workspace.on("file-open", refresh));
		this.register(this.store.onChange(refresh));
		this.app.workspace.onLayoutReady(refresh);
	}

	onunload(): void {
		for (const action of this.allActions) action.remove();
		this.allActions.clear();
	}

	private refresh(): void {
		for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
			const view = leaf.view;
			if (!(view instanceof MarkdownView)) continue;

			let action = this.actions.get(view);
			if (!action) {
				action = view.addAction(GOALS_STATS_TAB_ICON_ID, "Note stats", () => {
					const path = view.file?.path;
					if (path !== undefined && this.store.has(path)) {
						new NoteStatsModal(this.app, this.store, path, this.getMetric).open();
					}
				});
				action.addClass("scribe-note-stats-header-action");
				this.actions.set(view, action);
				this.allActions.add(action);
			}

			const path = view.file?.path;
			action.toggleClass("mod-hidden", path === undefined || !this.store.has(path));
		}
	}
}
