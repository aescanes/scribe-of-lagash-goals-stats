// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

/**
 * Opens the system file picker and reads the chosen file as text; `null` when
 * the picker is dismissed. The file is only read, never copied into the vault.
 * Obsidian has no picker of its own, so this drives a hidden
 * `<input type="file">`. It is attached to the page while the picker is open:
 * a detached input can be garbage-collected before the user chooses, and its
 * `change` event then never fires.
 */
export function pickTextFile(accept: string): Promise<{ name: string; text: string } | null> {
	return new Promise((resolve) => {
		const input = activeDocument.body.createEl("input", { type: "file", cls: "scribe-file-input" });
		input.accept = accept;
		const finish = (value: { name: string; text: string } | null) => {
			input.remove();
			resolve(value);
		};
		input.addEventListener("cancel", () => finish(null));
		input.addEventListener("change", () => {
			const file = input.files?.[0];
			if (!file) {
				finish(null);
				return;
			}
			file.text().then(
				(text) => finish({ name: file.name, text }),
				() => finish(null),
			);
		});
		input.click();
	});
}
