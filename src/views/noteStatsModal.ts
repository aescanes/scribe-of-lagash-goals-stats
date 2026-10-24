// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { App, Modal } from "obsidian";
import {
	formatPages,
	formatReadTime,
	targetProgress,
	noteRatios,
	PAGES_HELP,
	READ_TIME_HELP,
} from "../data/statsFormat";
import type { GoalMetric } from "../settings/settings";
import type { NoteStats } from "../types";
import { renderHelpIcon } from "./helpIcon";
import type { NoteStatsStore } from "./noteStatsStore";

/**
 * The centered popup for one note: its title, the headline count,
 * a strip of the other stats and a line of ratios. Stays live while open (the
 * store notifies as the note is typed in) and closes itself if the note leaves
 * scope or is deleted. A note with a length target (Outline Target column or
 * `scribe-note-target`) gets a progress block and bar under the headline count.
 */
export class NoteStatsModal extends Modal {
	private unsubscribe: (() => void) | null = null;

	constructor(
		app: App,
		private store: NoteStatsStore,
		private path: string,
		private getMetric: () => GoalMetric,
	) {
		super(app);
	}

	onOpen(): void {
		this.modalEl.addClass("scribe-note-stats-modal");
		this.unsubscribe = this.store.onChange(() => this.render());
		this.render();
	}

	onClose(): void {
		this.unsubscribe?.();
		this.unsubscribe = null;
		this.titleEl.empty();
		this.contentEl.empty();
	}

	private render(): void {
		const stats = this.store.getStats(this.path);
		if (!stats) {
			this.close();
			return;
		}

		this.renderHeader();
		const { contentEl } = this;
		contentEl.empty();
		this.renderHero(contentEl, stats);
		this.renderStrip(contentEl, stats);
		this.renderRatios(contentEl, stats);
	}

	/** "Note stats" eyebrow, then the note's name. */
	private renderHeader(): void {
		const { titleEl } = this;
		titleEl.empty();
		titleEl.createDiv({ cls: "scribe-note-stats-eyebrow", text: "Note stats" });

		const row = titleEl.createDiv({ cls: "scribe-note-stats-title-row" });
		const name = this.path.slice(this.path.lastIndexOf("/") + 1).replace(/\.md$/i, "");
		row.createSpan({ cls: "scribe-note-stats-title", text: name });
	}

	/** The headline count, with the target block and bar when there is a target. */
	private renderHero(containerEl: HTMLElement, stats: NoteStats): void {
		const hero = containerEl.createDiv({ cls: "scribe-note-stats-hero" });
		const main = hero.createDiv({ cls: "scribe-note-stats-hero-main" });
		main.createSpan({ cls: "scribe-note-stats-hero-value", text: stats.size.toLocaleString() });
		main.createSpan({
			cls: "scribe-note-stats-hero-unit",
			text: this.getMetric() === "characters" ? "characters" : "words",
		});

		const target = this.store.getTarget(this.path);
		if (target === null) return;
		const progress = targetProgress(stats.size, target);

		const block = hero.createDiv({ cls: "scribe-note-stats-target" });
		const percent = block.createDiv();
		percent.createSpan({ cls: "scribe-note-stats-target-percent", text: `${progress.percent}%` });
		percent.appendText(` of ${target.toLocaleString()}`);
		block.createDiv({ text: `${progress.remaining.toLocaleString()} to go` });

		const bar = containerEl.createDiv({ cls: "scribe-note-stats-bar" });
		// A computed width, which is what a runtime style property is for.
		bar.createDiv({ cls: "scribe-note-stats-bar-fill" }).style.setProperty("--progress", `${progress.fraction * 100}%`);
	}

	/** Read time, pages, sentences, paragraphs and syllables in one divided row. */
	private renderStrip(containerEl: HTMLElement, stats: NoteStats): void {
		const strip = containerEl.createDiv({ cls: "scribe-note-stats-strip" });
		this.renderCell(strip, "Read time", formatReadTime(stats.readMinutes), READ_TIME_HELP);
		this.renderCell(strip, "Syllables", stats.syllables.toLocaleString());
		this.renderCell(strip, "Sentences", stats.sentences.toLocaleString());
		this.renderCell(strip, "Paragraphs", stats.paragraphs.toLocaleString());
		this.renderCell(strip, "Pages", formatPages(stats.pages), PAGES_HELP);
	}

	/** A label (with an optional (?) tooltip) above its value; a trailing unit such as "min" is set smaller. */
	private renderCell(stripEl: HTMLElement, label: string, value: string, help?: string): void {
		const cell = stripEl.createDiv({ cls: "scribe-note-stats-cell" });
		const labelEl = cell.createDiv({ cls: "scribe-note-stats-cell-label" });
		labelEl.createSpan({ text: label });
		if (help) {
			labelEl.createSpan({ text: " " });
			renderHelpIcon(labelEl, help);
		}

		const valueEl = cell.createDiv({ cls: "scribe-note-stats-cell-value" });
		const space = value.indexOf(" ");
		if (space === -1) {
			valueEl.setText(value);
			return;
		}
		valueEl.createSpan({ text: value.slice(0, space) });
		valueEl.createSpan({ cls: "scribe-note-stats-cell-unit", text: value.slice(space) });
	}

	private renderRatios(containerEl: HTMLElement, stats: NoteStats): void {
		const footer = containerEl.createDiv({ cls: "scribe-note-stats-ratios" });
		for (const { value, label } of noteRatios(stats)) {
			const item = footer.createDiv();
			item.createSpan({ cls: "scribe-note-stats-ratio-value", text: value });
			item.appendText(` ${label}`);
		}
	}
}
