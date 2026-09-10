// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { App, PluginSettingTab, Setting } from "obsidian";
import type ScribeGoalsStatsPlugin from "../main";
import {
	monthlyGoal,
	WEEKDAYS,
	weeklyGoal,
	writingDaysInMonth,
	writingDaysPerWeek,
} from "../data/goalMath";

/** Lower-case noun for the active metric, singular kept simple ("word"/"character"). */
function unitLabel(plugin: ScribeGoalsStatsPlugin): string {
	return plugin.settings.metric === "characters" ? "characters" : "words";
}

export class ScribeGoalsStatsSettingTab extends PluginSettingTab {
	plugin: ScribeGoalsStatsPlugin;

	/** Info rows whose text is recomputed as the daily goal / days / metric change. */
	private weeklyGoalRow: Setting | null = null;
	private monthlyGoalRow: Setting | null = null;

	constructor(app: App, plugin: ScribeGoalsStatsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.renderWritingGoals(containerEl);
		this.renderStats(containerEl);
	}

	private renderWritingGoals(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Writing goals").setHeading();

		new Setting(containerEl)
			.setName("Story folder")
			.setDesc(
				"The folder containing the story's act/chapter/scene notes. Leave empty to scan the whole vault.",
			)
			.addText((text) => {
				text.setPlaceholder("Stories/The Silent City");
				text.setValue(this.plugin.settings.storyFolder);
				text.onChange(async (value) => {
					this.plugin.settings.storyFolder = value.trim();
					await this.plugin.saveSettings();
				});
			});

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
			.then((setting) => this.renderWeekdayPicker(setting));

		this.weeklyGoalRow = new Setting(containerEl).setName("Weekly goal");
		this.monthlyGoalRow = new Setting(containerEl).setName("Monthly goal");
		this.refreshComputedGoals();
	}

	private renderWeekdayPicker(setting: Setting): void {
		const picker = setting.controlEl.createDiv({ cls: "scribe-weekday-picker" });
		WEEKDAYS.forEach((label, index) => {
			const dayLabel = picker.createEl("label", { cls: "scribe-weekday" });
			const checkbox = dayLabel.createEl("input", { type: "checkbox" });
			checkbox.checked = this.plugin.settings.writingDays[index];
			checkbox.addEventListener("change", () => {
				this.plugin.settings.writingDays[index] = checkbox.checked;
				this.refreshComputedGoals();
				void this.plugin.saveSettings();
			});
			dayLabel.createSpan({ text: label.slice(0, 3) });
		});
	}

	/** Restates the weekly/monthly targets from the current daily goal, days and metric. */
	private refreshComputedGoals(): void {
		const { dailyGoal, writingDays } = this.plugin.settings;
		const unit = unitLabel(this.plugin);
		const now = new Date();
		const year = now.getFullYear();
		const month = now.getMonth();

		const perWeek = writingDaysPerWeek(writingDays);
		const perMonth = writingDaysInMonth(year, month, writingDays);
		const monthName = now.toLocaleDateString(undefined, { month: "long", year: "numeric" });

		this.weeklyGoalRow?.setDesc(
			`${perWeek} writing ${perWeek === 1 ? "day" : "days"} per week × ${dailyGoal.toLocaleString()} ` +
				`= ${weeklyGoal(dailyGoal, writingDays).toLocaleString()} ${unit} per week.`,
		);
		this.monthlyGoalRow?.setDesc(
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
