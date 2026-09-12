// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { addIcon, Plugin, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, normalizeSettings, ScribeGoalsStatsSettings } from "./settings/settings";
import { ScribeGoalsStatsSettingTab } from "./settings/settingsTab";
import { ExplorerDecorator } from "./views/explorerDecorator";
import { ScopeScanner } from "./views/scopeScanner";
import { GoalHistoryStore } from "./views/goalHistoryStore";
import { GOAL_WIDGET_ICON, GoalWidgetView, VIEW_TYPE_GOAL_WIDGET } from "./views/goalWidgetView";
import {
	GOALS_STATS_TAB_ICON_ID,
	GOALS_STATS_TAB_ICON_SVG,
	GoalsStatsTabView,
	VIEW_TYPE_GOALS_STATS_TAB,
} from "./views/goalsStatsTabView";

/** Where `activateView` opens a view: the right sidebar, or a tab in the main area. */
type ViewPlacement = "right" | "tab";

export default class ScribeGoalsStatsPlugin extends Plugin {
	settings: ScribeGoalsStatsSettings = { ...DEFAULT_SETTINGS };
	goalHistoryStore!: GoalHistoryStore;
	private scanner!: ScopeScanner;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.scanner = this.addChild(
			new ScopeScanner(this.app, () => ({
				storyFolder: this.settings.storyFolder,
				excludedPaths: this.settings.excludedPaths,
			})),
		);

		this.addChild(
			new ExplorerDecorator(this.app, this.scanner, () => ({
				metric: this.settings.metric,
			})),
		);

		this.goalHistoryStore = this.addChild(
			new GoalHistoryStore(this.app, this.scanner, () => ({
				storyFolder: this.settings.storyFolder,
			})),
		);

		addIcon(GOALS_STATS_TAB_ICON_ID, GOALS_STATS_TAB_ICON_SVG);

		this.registerView(VIEW_TYPE_GOAL_WIDGET, (leaf) => new GoalWidgetView(leaf, this));
		this.registerView(VIEW_TYPE_GOALS_STATS_TAB, (leaf) => new GoalsStatsTabView(leaf, this));

		// Right sidebar: today's goal (ring, week/month summary, calendar).
		this.addRibbonIcon(GOAL_WIDGET_ICON, "(SL) G & S: Open Writing Goal", () => {
			void this.activateView(VIEW_TYPE_GOAL_WIDGET, "right");
		}).addClass("scribe-ribbon-icon");

		// Main-area tab: the full picture — every stat and the complete goal
		// history, in more detail than the sidebar widget (not built yet).
		this.addRibbonIcon(GOALS_STATS_TAB_ICON_ID, "(SL) G & S: Open Goals & Stats", () => {
			void this.activateView(VIEW_TYPE_GOALS_STATS_TAB, "tab");
		}).addClass("scribe-ribbon-icon");

		this.addCommand({
			id: "open-writing-goal-widget",
			name: "Open writing goal widget",
			callback: () => void this.activateView(VIEW_TYPE_GOAL_WIDGET, "right"),
		});

		this.addCommand({
			id: "open-goals-stats-tab",
			name: "Open Goals & Stats",
			callback: () => void this.activateView(VIEW_TYPE_GOALS_STATS_TAB, "tab"),
		});

		this.addSettingTab(new ScribeGoalsStatsSettingTab(this.app, this));
	}

	async loadSettings(): Promise<void> {
		this.settings = normalizeSettings(
			(await this.loadData()) as Partial<ScribeGoalsStatsSettings> | null,
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		void this.scanner.refresh();
	}

	/** Reveals an existing leaf of `viewType`, or opens one at the given placement. */
	private async activateView(viewType: string, placement: ViewPlacement): Promise<void> {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(viewType)[0] ?? null;
		if (!leaf) {
			leaf = placement === "right" ? workspace.getRightLeaf(false) : workspace.getLeaf("tab");
			if (!leaf) return;
			await leaf.setViewState({ type: viewType, active: true });
		}

		await workspace.revealLeaf(leaf);
	}
}
