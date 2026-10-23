// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { setIcon } from "obsidian";
import { FolderGroup, StatsRow, sumStats } from "../data/statsTable";
import { formatPages, formatReadTime, PAGES_HELP, READ_TIME_HELP } from "../data/statsFormat";
import { statusModifier } from "../data/statusLabel";
import type { GoalMetric } from "../settings/settings";
import type { NoteStats } from "../types";
import { renderHelpIcon } from "./helpIcon";

export interface StoryStatsTableOptions {
	metric: GoalMetric;
	/** Folders whose rows are currently hidden; owned by the view so it survives re-renders. */
	collapsed: Set<string>;
	onToggleFolder: (folder: string) => void;
	onOpenNote: (path: string) => void;
}

/** A status as a small pill; nothing at all for a note with none. */
export function renderStatusPill(containerEl: HTMLElement, status: string): void {
	if (status === "") return;
	const modifier = statusModifier(status);
	containerEl.createSpan({
		cls: modifier ? `scribe-status-pill mod-${modifier}` : "scribe-status-pill",
		text: status,
	});
}

/** The numeric cells shared by note, folder-subtotal and total rows. */
function renderNumberCells(rowEl: HTMLElement, stats: NoteStats): void {
	const cells = [
		stats.size.toLocaleString(),
		formatReadTime(stats.readMinutes),
		stats.syllables.toLocaleString(),
		stats.sentences.toLocaleString(),
		stats.paragraphs.toLocaleString(),
		formatPages(stats.pages),
	];
	for (const text of cells) rowEl.createEl("td", { cls: "scribe-stats-num", text });
}

/**
 * The story stats table: one section per folder (collapsible, with a subtotal
 * on its header line), a line per note, and a grand total. DOM only — grouping
 * and sums come from `groupByFolder`/`sumStats`.
 */
export function renderStoryStatsTable(
	containerEl: HTMLElement,
	groups: FolderGroup[],
	options: StoryStatsTableOptions,
): void {
	const wrapper = containerEl.createDiv({ cls: "scribe-stats-table-wrapper" });
	const table = wrapper.createEl("table", { cls: "scribe-stats-table" });

	const headerRow = table.createEl("thead").createEl("tr");
	const sizeLabel = options.metric === "characters" ? "Characters" : "Words";
	const help: Record<string, string> = { "Read time": READ_TIME_HELP, Pages: PAGES_HELP };
	for (const label of ["Note", sizeLabel, "Read time", "Syllables", "Sentences", "Paragraphs", "Pages", "Status"]) {
		const th = headerRow.createEl("th", { cls: label === "Note" || label === "Status" ? "" : "scribe-stats-num" });
		th.createSpan({ text: label });
		if (help[label]) renderHelpIcon(th, help[label]);
	}

	const body = table.createEl("tbody");
	const multipleGroups = groups.length > 1 || (groups.length === 1 && groups[0].folder !== "");

	for (const group of groups) {
		const isCollapsed = options.collapsed.has(group.folder);
		// Notes sitting directly in a story folder that has no subfolders need no header.
		if (multipleGroups) renderFolderRow(body, group, isCollapsed, options);
		if (isCollapsed) continue;
		for (const row of group.rows) renderNoteRow(body, row, multipleGroups, options);
	}

	const total = sumStats(groups.map((group) => group.totals));
	const totalRow = body.createEl("tr", { cls: "scribe-stats-total-row" });
	totalRow.createEl("td", { text: "Total" });
	renderNumberCells(totalRow, total);
	totalRow.createEl("td");
}

function renderFolderRow(
	body: HTMLElement,
	group: FolderGroup,
	isCollapsed: boolean,
	options: StoryStatsTableOptions,
): void {
	const row = body.createEl("tr", { cls: "scribe-stats-folder-row" });
	const nameCell = row.createEl("td");
	const toggle = nameCell.createSpan({ cls: "scribe-stats-folder-toggle" });
	setIcon(toggle, isCollapsed ? "chevron-right" : "chevron-down");
	setIcon(nameCell.createSpan({ cls: "scribe-stats-folder-icon" }), "folder");
	nameCell.createSpan({ text: group.folder === "" ? "(story root)" : group.folder });

	row.addClass("mod-clickable");
	row.addEventListener("click", () => options.onToggleFolder(group.folder));

	renderNumberCells(row, group.totals);
	row.createEl("td");
}

function renderNoteRow(
	body: HTMLElement,
	row: StatsRow,
	indented: boolean,
	options: StoryStatsTableOptions,
): void {
	const rowEl = body.createEl("tr", { cls: "scribe-stats-note-row" });
	const nameCell = rowEl.createEl("td", { cls: indented ? "mod-indented" : "" });
	const link = nameCell.createEl("a", { cls: "scribe-stats-note-link", text: row.name });
	link.addEventListener("click", (evt) => {
		evt.preventDefault();
		options.onOpenNote(row.path);
	});
	renderNumberCells(rowEl, row.stats);
	renderStatusPill(rowEl.createEl("td"), row.status);
}
