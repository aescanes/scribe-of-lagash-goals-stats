// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { Plugin } from "obsidian";
import { DEFAULT_SETTINGS, normalizeSettings, ScribeGoalsStatsSettings } from "./settings/settings";
import { ScribeGoalsStatsSettingTab } from "./settings/settingsTab";

export default class ScribeGoalsStatsPlugin extends Plugin {
	settings: ScribeGoalsStatsSettings = { ...DEFAULT_SETTINGS };

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new ScribeGoalsStatsSettingTab(this.app, this));
	}

	async loadSettings(): Promise<void> {
		this.settings = normalizeSettings(
			(await this.loadData()) as Partial<ScribeGoalsStatsSettings> | null,
		);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
