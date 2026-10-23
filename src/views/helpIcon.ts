// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import { setIcon } from "obsidian";

/** A small (?) icon whose hover tooltip explains a stat's label. */
export function renderHelpIcon(containerEl: HTMLElement, text: string): HTMLElement {
	const icon = containerEl.createSpan({ cls: "scribe-help-icon" });
	setIcon(icon, "circle-help");
	icon.setAttr("aria-label", text);
	return icon;
}
