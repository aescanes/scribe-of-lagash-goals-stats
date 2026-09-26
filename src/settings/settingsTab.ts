// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { App, Notice, normalizePath, PluginSettingTab, requireApiVersion, Setting, TFolder } from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
import type ScribeGoalsStatsPlugin from "../main";
import {
	monthlyGoal,
	WEEKDAYS,
	weeklyGoal,
	writingDaysInMonth,
	writingDaysPerWeek,
} from "../data/goalMath";
import { SCRIBE_GENERATED_PREFIX } from "../data/exclusion";
import { ConfirmModal } from "./confirmModal";
import { FolderSuggest } from "./folderSuggest";

/** Lower-case noun for the active metric, singular kept simple ("word"/"character"). */
function unitLabel(plugin: ScribeGoalsStatsPlugin): string {
	return plugin.settings.metric === "characters" ? "characters" : "words";
}

export class ScribeGoalsStatsSettingTab extends PluginSettingTab {
	plugin: ScribeGoalsStatsPlugin;

	/** Info rows whose text is recomputed as the daily goal / days / metric change. */
	private weeklyGoalRow: Setting | null = null;
	private monthlyGoalRow: Setting | null = null;

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
		return new Promise((resolve) => {
			new ConfirmModal(
				this.app,
				"Changing the story folder starts today's writing count over at zero for the new " +
					"folder. Nothing is deleted — the old folder's history file stays exactly as it is, " +
					"and switching back to it later picks up right where you left off.",
				"Change story folder",
				resolve,
			).open();
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
		this.renderStats(containerEl);
	}

	/**
	 * Declarative counterpart to `display()`, used by Obsidian 1.13.0+ so this
	 * tab's settings appear in the app's settings search — `display()` above
	 * still runs as-is on older versions, where this is never called. The two
	 * describe the same settings and are kept in sync by hand; `renderWeekdayPicker`
	 * and `describeWeeklyGoal`/`describeMonthlyGoal` are shared by both since
	 * their custom (non-control) UI has no declarative equivalent.
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
						desc: "How much you aim to write on each of your writing days.",
						control: {
							type: "number",
							key: "dailyGoal",
							min: 0,
							validate: (value) =>
								Number.isFinite(value) && value >= 0 ? undefined : "Enter a number of 0 or more.",
						},
					},
					{
						name: "Writing days",
						desc: "The days you plan to write. Weekly and monthly goals are calculated from these.",
						render: (setting) => this.renderWeekdayPicker(setting, () => this.updateIfSupported()),
					},
					{
						name: "Weekly goal",
						render: (setting) => this.describeWeeklyGoal(setting),
					},
					{
						name: "Monthly goal",
						render: (setting) => this.describeMonthlyGoal(setting),
					},
				],
			},
			{
				type: "group",
				heading: "Stats",
				items: [{ name: "", desc: "Statistics options will appear here in a future release." }],
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
			case "dailyGoal":
				return this.plugin.settings.dailyGoal;
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
			case "dailyGoal":
				this.plugin.settings.dailyGoal = typeof value === "number" ? Math.round(value) : this.plugin.settings.dailyGoal;
				break;
			default:
				return;
		}
		await this.plugin.saveSettings();
		this.updateIfSupported();
	}

	/**
	 * `SettingTab.update()` only exists since Obsidian 1.13.0, but this is only
	 * ever reached from the declarative code path above (`setControlValue` and
	 * the weekday picker's declarative `render`), which Obsidian itself never
	 * invokes below 1.13.0 — `display()`'s own imperative path never calls this.
	 * Guarded with `requireApiVersion` all the same, both so it's genuinely
	 * safe rather than safe "by construction", and because `no-unsupported-api`
	 * only recognizes that as proof a call is version-gated.
	 */
	private updateIfSupported(): void {
		if (requireApiVersion("1.13.0")) this.update();
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
					this.refreshComputedGoals();
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

		new Setting(containerEl)
			.setName("Daily writing goal")
			.setDesc("How much you aim to write on each of your writing days.")
			.addText((text) => {
				text.inputEl.type = "number";
				text.inputEl.min = "0";
				text.setValue(String(this.plugin.settings.dailyGoal));
				text.onChange(async (value) => {
					if (value.trim() === "") return;
					const next = Number(value);
					if (!Number.isFinite(next) || next < 0) return;
					this.plugin.settings.dailyGoal = Math.round(next);
					await this.plugin.saveSettings();
					this.refreshComputedGoals();
				});
			});

		new Setting(containerEl)
			.setName("Writing days")
			.setDesc("The days you plan to write. Weekly and monthly goals are calculated from these.")
			.then((setting) => this.renderWeekdayPicker(setting, () => this.refreshComputedGoals()));

		this.weeklyGoalRow = new Setting(containerEl).setName("Weekly goal");
		this.monthlyGoalRow = new Setting(containerEl).setName("Monthly goal");
		this.refreshComputedGoals();
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

	/** Builds the weekday checkboxes; `onChange` lets each rendering path (imperative
	 *  row refresh vs. declarative `update()`) refresh the dependent goal text its own way. */
	private renderWeekdayPicker(setting: Setting, onChange: () => void): void {
		const picker = setting.controlEl.createDiv({ cls: "scribe-weekday-picker" });
		WEEKDAYS.forEach((label, index) => {
			const dayLabel = picker.createEl("label", { cls: "scribe-weekday" });
			const checkbox = dayLabel.createEl("input", { type: "checkbox" });
			checkbox.checked = this.plugin.settings.writingDays[index];
			checkbox.addEventListener("change", () => {
				this.plugin.settings.writingDays[index] = checkbox.checked;
				onChange();
				void this.plugin.saveSettings();
			});
			dayLabel.createSpan({ text: label.slice(0, 3) });
		});
	}

	/** Restates the weekly/monthly targets from the current daily goal, days and metric. */
	private refreshComputedGoals(): void {
		if (this.weeklyGoalRow) this.describeWeeklyGoal(this.weeklyGoalRow);
		if (this.monthlyGoalRow) this.describeMonthlyGoal(this.monthlyGoalRow);
	}

	private describeWeeklyGoal(setting: Setting): void {
		const { dailyGoal, writingDays } = this.plugin.settings;
		const unit = unitLabel(this.plugin);
		const perWeek = writingDaysPerWeek(writingDays);
		setting.setDesc(
			`${perWeek} writing ${perWeek === 1 ? "day" : "days"} per week × ${dailyGoal.toLocaleString()} ` +
				`= ${weeklyGoal(dailyGoal, writingDays).toLocaleString()} ${unit} per week.`,
		);
	}

	private describeMonthlyGoal(setting: Setting): void {
		const { dailyGoal, writingDays } = this.plugin.settings;
		const unit = unitLabel(this.plugin);
		const now = new Date();
		const year = now.getFullYear();
		const month = now.getMonth();
		const perMonth = writingDaysInMonth(year, month, writingDays);
		const monthName = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });

		setting.setDesc(
			createFragment((frag) => {
				frag.appendText(
					"Here we are using the current month to give you a reference of this month's goal:",
				);
				frag.createEl("br");
				frag.appendText(
					`${perMonth} writing ${perMonth === 1 ? "day" : "days"} in ${monthName} × ` +
						`${dailyGoal.toLocaleString()} = ` +
						`${monthlyGoal(dailyGoal, writingDays, year, month).toLocaleString()} ${unit}.`,
				);
			}),
		);
	}

	private renderStats(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Stats").setHeading();
		new Setting(containerEl).setDesc("Statistics options will appear here in a future release.");
	}
}
