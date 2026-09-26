// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { App, Modal, Setting } from "obsidian";

/**
 * A minimal Yes/No confirmation dialog — Obsidian has no built-in one. The
 * only current use is confirming a story-folder change mid-day (see
 * `ScribeGoalsStatsSettingTab`). Dismissing the modal any other way (Escape,
 * clicking outside) is treated the same as declining.
 */
export class ConfirmModal extends Modal {
	private confirmed = false;

	constructor(
		app: App,
		private message: string,
		private confirmText: string,
		private onResult: (confirmed: boolean) => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("p", { text: this.message });
		new Setting(contentEl)
			.addButton((button) =>
				button
					.setButtonText(this.confirmText)
					// `setDestructive()` needs Obsidian 1.13.0, above this plugin's
					// minAppVersion (1.10.0) — `setWarning()` is deprecated in its
					// favor but still works, and still compatible that far back.
					.setWarning()
					.onClick(() => {
						this.confirmed = true;
						this.close();
					}),
			)
			.addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()));
	}

	onClose(): void {
		this.contentEl.empty();
		this.onResult(this.confirmed);
	}
}
