// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { Plugin, WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, normalizeSettings, ScribeGoalsStatsSettings } from "./settings/settings";
import { ScribeGoalsStatsSettingTab } from "./settings/settingsTab";
import { ExplorerDecorator } from "./views/explorerDecorator";
import { ScopeScanner } from "./views/scopeScanner";
import { GoalHistoryStore } from "./views/goalHistoryStore";
import { GOAL_WIDGET_ICON, GoalWidgetView, VIEW_TYPE_GOAL_WIDGET } from "./views/goalWidgetView";

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

		this.registerView(VIEW_TYPE_GOAL_WIDGET, (leaf) => new GoalWidgetView(leaf, this));

		this.addRibbonIcon(GOAL_WIDGET_ICON, "Open writing goal", () => {
			void this.activateGoalWidget();
		});

		this.addCommand({
			id: "open-writing-goal-widget",
			name: "Open writing goal widget",
			callback: () => void this.activateGoalWidget(),
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

	private async activateGoalWidget(): Promise<void> {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf | null = workspace.getLeavesOfType(VIEW_TYPE_GOAL_WIDGET)[0] ?? null;
		if (!leaf) {
			leaf = workspace.getRightLeaf(false);
			if (!leaf) return;
			await leaf.setViewState({ type: VIEW_TYPE_GOAL_WIDGET, active: true });
		}

		await workspace.revealLeaf(leaf);
	}
}
