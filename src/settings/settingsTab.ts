// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { App, Notice, normalizePath, PluginSettingTab, requireApiVersion, Setting, TFolder } from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
import type ScribeGoalsStatsPlugin from "../main";
import { monthlyGoal, weeklyGoal } from "../data/goalMath";
import { SCRIBE_GENERATED_PREFIX } from "../data/exclusion";
import { confirm } from "../utils/confirmModal";
import { FolderSuggest } from "./folderSuggest";

const SUPPORT_NAME = "If this plugin helps your writing, you can support its development";
const SUPPORT_URL = "https://ko-fi.com/O3J528W3FZ";

/** Every day counts as a writing day: the goals below are just the daily goal scaled up. */
const EVERY_DAY: readonly boolean[] = [true, true, true, true, true, true, true];

export class ScribeGoalsStatsSettingTab extends PluginSettingTab {
	plugin: ScribeGoalsStatsPlugin;

	/**
	 * A story folder isn't just "which notes count" — it's also which history
	 * file today's writing lands in, so unlike every other setting it isn't
	 * applied as the author types: they click "Set" (or press Enter in the
	 * field — see `renderStoryFolderField`) once the path is actually ready.
	 * Switching to a different folder mid-day means `GoalHistoryStore` has no
	 * start-of-day snapshot for that folder's files, so without resetting it,
	 * every word already sitting in the new folder would look like it was
	 * written today (see `ScribeGoalsStatsPlugin.resetTodayTextBaseline`'s own
	 * doc comment) — hence the confirmation. The old folder's history file is
	 * never touched — it's simply not pointed at anymore until the author
	 * switches back to it.
	 */
	private async applyStoryFolder(value: string): Promise<void> {
		if (value === this.plugin.settings.storyFolder) return;

		// Empty is always valid (it means "the whole vault"); anything else
		// must be a folder that's actually there — otherwise every note in the
		// vault would silently drop out of scope until the typo is noticed.
		if (value !== "" && !(this.app.vault.getAbstractFileByPath(normalizePath(value)) instanceof TFolder)) {
			new Notice(`Folder "${value}" doesn't exist.`);
			return;
		}

		const proceed = await this.confirmStoryFolderChange();
		if (!proceed) return;

		await this.plugin.resetTodayTextBaseline();
		this.plugin.settings.storyFolder = value;
		await this.plugin.saveSettings();
		this.updateIfSupported();
	}

	private confirmStoryFolderChange(): Promise<boolean> {
		return confirm(this.app, {
			title: "Change story folder",
			body:
				"Changing the story folder starts today's writing count over at zero for the new " +
				"folder. Nothing is deleted — the old folder's history file stays exactly as it is, " +
				"and switching back to it later picks up right where you left off.",
			cta: "Change story folder",
		});
	}

	constructor(app: App, plugin: ScribeGoalsStatsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.renderGeneral(containerEl);
		this.renderWritingGoals(containerEl);

		new Setting(containerEl).setName("Support").setHeading();
		this.renderSupportButton(new Setting(containerEl).setName(SUPPORT_NAME));
	}

	/**
	 * Declarative counterpart to `display()`, used by Obsidian 1.13.0+ so this
	 * tab's settings appear in the app's settings search — `display()` above
	 * still runs as-is on older versions, where this is never called. The two
	 * describe the same settings and are kept in sync by hand.
	 */
	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				type: "group",
				heading: "Scope",
				items: [
					{
						name: "Story folder",
						desc: this.storyFolderDesc(),
						render: (setting) => this.renderStoryFolderField(setting),
					},
					{
						name: "Excluded notes and folders",
						desc: this.excludedPathsDesc(),
						control: {
							type: "textarea",
							key: "excludedPaths",
							placeholder: "Notes/scratchpad\narchive",
							rows: 4,
						},
					},
				],
			},
			{
				type: "group",
				heading: "Writing goals",
				items: [
					{
						name: "Metric",
						desc: "Whether goals and statistics are measured in words or characters.",
						control: {
							type: "dropdown",
							key: "metric",
							options: { words: "Words", characters: "Characters" },
						},
					},
					{
						name: "Count spaces in character counts",
						desc: this.countSpacesDesc(),
						control: {
							type: "toggle",
							key: "charactersIncludeSpaces",
						},
					},
					{
						name: "Daily writing goal",
						desc: this.dailyGoalDesc(),
						render: (setting) => this.renderDailyGoalField(setting),
					},
				],
			},
			{
				type: "group",
				heading: "Support",
				items: [
					{
						name: SUPPORT_NAME,
						searchable: false,
						render: (setting) => this.renderSupportButton(setting),
					},
				],
			},
		];
	}

	getControlValue(key: string): unknown {
		switch (key) {
			case "excludedPaths":
				return this.plugin.settings.excludedPaths.join("\n");
			case "metric":
				return this.plugin.settings.metric;
			case "charactersIncludeSpaces":
				return this.plugin.settings.charactersIncludeSpaces;
			default:
				return undefined;
		}
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		switch (key) {
			case "excludedPaths":
				this.plugin.settings.excludedPaths =
					typeof value === "string"
						? value
								.split("\n")
								.map((line) => line.trim())
								.filter(Boolean)
						: [];
				break;
			case "metric":
				this.plugin.settings.metric = value === "characters" ? "characters" : "words";
				break;
			case "charactersIncludeSpaces":
				this.plugin.settings.charactersIncludeSpaces = value === true;
				break;
			default:
				return;
		}
		await this.plugin.saveSettings();
		this.updateIfSupported();
	}

	/**
	 * `SettingTab.update()` only exists since Obsidian 1.13.0, but this is only
	 * ever reached from the declarative code path above (`setControlValue`), which Obsidian itself never
	 * invokes below 1.13.0 — `display()`'s own imperative path never calls this.
	 * Guarded with `requireApiVersion` all the same, both so it's genuinely
	 * safe rather than safe "by construction", and because `no-unsupported-api`
	 * only recognizes that as proof a call is version-gated.
	 */
	private updateIfSupported(): void {
		if (requireApiVersion("1.13.0")) this.update();
	}

	private renderSupportButton(setting: Setting): void {
		setting.addButton((button) =>
			button
				.setButtonText("Buy me a coffee")
				.setCta()
				.onClick(() => window.open(SUPPORT_URL)),
		);
	}

	private renderGeneral(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Scope").setHeading();

		new Setting(containerEl)
			.setName("Story folder")
			.setDesc(this.storyFolderDesc())
			.then((setting) => this.renderStoryFolderField(setting));

		new Setting(containerEl)
			.setName("Excluded notes and folders")
			.setDesc(this.excludedPathsDesc())
			.addTextArea((area) => {
				area.setPlaceholder("Notes/scratchpad\narchive");
				area.setValue(this.plugin.settings.excludedPaths.join("\n"));
				area.inputEl.rows = 4;
				area.inputEl.cols = 40;
				area.inputEl.addClass("scribe-excluded-paths");
				area.onChange(async (value) => {
					this.plugin.settings.excludedPaths = value
						.split("\n")
						.map((line) => line.trim())
						.filter(Boolean);
					await this.plugin.saveSettings();
				});
			});
	}

	private renderWritingGoals(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Writing goals").setHeading();

		let dailyGoalSetting: Setting | null = null;

		new Setting(containerEl)
			.setName("Metric")
			.setDesc("Whether goals and statistics are measured in words or characters.")
			.addDropdown((dropdown) => {
				dropdown.addOption("words", "Words");
				dropdown.addOption("characters", "Characters");
				dropdown.setValue(this.plugin.settings.metric);
				dropdown.onChange(async (value) => {
					this.plugin.settings.metric = value === "characters" ? "characters" : "words";
					await this.plugin.saveSettings();
					dailyGoalSetting?.setDesc(this.dailyGoalDesc());
				});
			});

		new Setting(containerEl)
			.setName("Count spaces in character counts")
			.setDesc(this.countSpacesDesc())
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.charactersIncludeSpaces);
				toggle.onChange(async (value) => {
					this.plugin.settings.charactersIncludeSpaces = value;
					await this.plugin.saveSettings();
				});
			});

		dailyGoalSetting = new Setting(containerEl)
			.setName("Daily writing goal")
			.setDesc(this.dailyGoalDesc());
		this.renderDailyGoalField(dailyGoalSetting);
	}

	/** Shared by both rendering paths; applies on every keystroke and restates the derived goals. */
	private renderDailyGoalField(setting: Setting): void {
		setting.addText((text) => {
			text.inputEl.type = "number";
			text.inputEl.min = "0";
			text.setValue(String(this.plugin.settings.dailyGoal));
			text.onChange(async (value) => {
				if (value.trim() === "") return;
				const next = Number(value);
				if (!Number.isFinite(next) || next < 0) return;
				this.plugin.settings.dailyGoal = Math.round(next);
				await this.plugin.saveSettings();
				setting.setDesc(this.dailyGoalDesc());
			});
		});
	}

	/** Daily goal blurb with the weekly and current-month targets derived from it. */
	private dailyGoalDesc(): DocumentFragment {
		const { dailyGoal, metric } = this.plugin.settings;
		const unit = metric === "characters" ? "characters" : "words";
		const now = new Date();
		const monthName = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });
		const weekly = weeklyGoal(dailyGoal, EVERY_DAY).toLocaleString();
		const monthly = monthlyGoal(dailyGoal, EVERY_DAY, now.getFullYear(), now.getMonth()).toLocaleString();
		return createFragment((frag) => {
			frag.appendText("How much you aim to write each day.");
			frag.createEl("br");
			frag.createEl("br");
			frag.appendText(`Weekly goal: ${weekly} ${unit}.`);
			frag.createEl("br");
			frag.appendText(`Monthly goal (${monthName}): ${monthly} ${unit}.`);
		});
	}

	/** The fragment shared by both `display()`'s imperative row and the declarative definition. */
	private countSpacesDesc(): DocumentFragment {
		return createFragment((frag) => {
			frag.appendText(
				"This setting only matters when the metric above is Characters.",
			);
			frag.createEl("br");
			frag.appendText(
				"When enabled, spaces are counted in character totals. When disabled, spaces are ignored.",
			);
		});
	}

	/** The fragment shared by both `display()`'s imperative row and the declarative definition. */
	private storyFolderDesc(): DocumentFragment {
		return createFragment((frag) => {
			frag.appendText(
				"The folder containing the story's act/chapter/scene notes. Leave empty to scan the whole vault.",
			);
			frag.createEl("br");
			frag.appendText('Click "Set" (or press Enter in the field) to apply it.');
		});
	}

	/**
	 * Text field plus a "Set" button — shared by both `display()`'s imperative
	 * row and the declarative definition. Nothing is applied while typing;
	 * only the button (or Enter in the field) commits the typed path, via
	 * `applyStoryFolder` — see its own doc comment for why.
	 */
	private renderStoryFolderField(setting: Setting): void {
		let typed = this.plugin.settings.storyFolder;
		setting.addText((text) => {
			text.setPlaceholder("Stories/the silent city");
			text.setValue(this.plugin.settings.storyFolder);
			text.onChange((value) => (typed = value));
			text.inputEl.addEventListener("keydown", (evt) => {
				if (evt.key === "Enter") void this.applyStoryFolder(typed.trim());
			});
			// Picking a suggestion doesn't itself redraw the input — set both
			// the tracked value and the field's displayed text explicitly.
			new FolderSuggest(this.app, text.inputEl).onSelect((folder) => {
				typed = folder.path;
				text.setValue(folder.path);
			});
		});
		setting.addButton((button) =>
			button.setButtonText("Set").onClick(() => void this.applyStoryFolder(typed.trim())),
		);
	}

	/** The fragment shared by both `display()`'s imperative row and the declarative definition. */
	private excludedPathsDesc(): DocumentFragment {
		return createFragment((frag) => {
			frag.appendText(
				"Notes and folders to leave out of the writing goals and statistics — " +
					"one vault-relative path per line. Naming a folder excludes everything inside it.",
			);
			frag.createEl("br");
			frag.appendText(
				`Files and folders named with the "${SCRIBE_GENERATED_PREFIX} " prefix ` +
					"(created by the Scribe of Lagash plugins) are always excluded.",
			);
		});
	}
}
