// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { App, ButtonComponent, Notice, Setting } from "obsidian";
import { describeImport, describeNothingToImport } from "../data/importStats";
import { getImportSource, IMPORT_SOURCES } from "../data/importSources";
import type { GoalHistoryStore } from "../views/goalHistoryStore";
import { confirm } from "../utils/confirmModal";
import { pickTextFile } from "./filePicker";

const FILE_HINT = "No file chosen.";

/**
 * The "Import stats" rows. Kept in a class of its own (not inline in the
 * settings tab) because its state — the chosen source and file — is transient
 * UI state that isn't a setting, and the imperative and declarative rendering
 * paths both need the same rows sharing it.
 */
export class ImportStatsSection {
	private sourceId = IMPORT_SOURCES[0].id;
	private file: { name: string; text: string } | null = null;
	private fileSetting: Setting | null = null;
	private importButton: ButtonComponent | null = null;

	constructor(
		private app: App,
		private getStore: () => GoalHistoryStore,
	) {}

	renderSource(setting: Setting): void {
		setting.addDropdown((dropdown) => {
			for (const source of IMPORT_SOURCES) dropdown.addOption(source.id, source.label);
			dropdown.setValue(this.sourceId);
			dropdown.onChange((value) => (this.sourceId = value));
		});
	}

	renderFile(setting: Setting): void {
		this.fileSetting = setting;
		setting.setDesc(this.file?.name ?? FILE_HINT);
		setting.addButton((button) =>
			button.setButtonText("Choose file…").onClick(async () => {
				const picked = await pickTextFile(".json,application/json");
				if (!picked) return;
				this.file = picked;
				setting.setDesc(picked.name);
				this.importButton?.setDisabled(false);
			}),
		);
	}

	renderImport(setting: Setting): void {
		setting.addButton((button) => {
			this.importButton = button;
			button
				.setButtonText("Import")
				.setCta()
				.setDisabled(this.file === null)
				.onClick(() => void this.run());
		});
	}

	private async run(): Promise<void> {
		const source = getImportSource(this.sourceId);
		if (!source || !this.file) return;

		const parsed = source.parse(this.file.text);
		if ("error" in parsed) {
			new Notice(`Import failed: ${parsed.error}`);
			return;
		}

		const store = this.getStore();
		const preview = await store.previewImport(parsed.days);
		if (preview.added.length === 0) {
			new Notice(describeNothingToImport(parsed.days.length, preview, store.getHistoryPath()));
			return;
		}

		const proceed = await confirm(this.app, {
			title: `Import from ${source.label}`,
			body:
				`${describeImport(preview, false)} Existing days are never overwritten. ` +
				`Checked against "${store.getHistoryPath()}".`,
			cta: "Import",
		});
		if (!proceed) return;

		const result = await store.importDays(parsed.days);
		new Notice(`Import finished. ${describeImport(result, true)}`);
		this.file = null;
		this.fileSetting?.setDesc(FILE_HINT);
		this.importButton?.setDisabled(true);
	}
}
