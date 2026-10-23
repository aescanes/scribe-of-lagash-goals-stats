// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

// Pure status helpers — no Obsidian imports, unit-tested.

/**
 * A note's raw status value as a display string. Frontmatter is untyped, so
 * this takes a string as-is, the first string of a list, and anything else
 * (number, object, missing) as no status.
 */
export function normalizeStatus(raw: unknown): string {
	if (typeof raw === "string") return raw.trim();
	if (Array.isArray(raw)) {
		const first = raw.find((item): item is string => typeof item === "string" && item.trim() !== "");
		return first ? first.trim() : "";
	}
	return "";
}

/**
 * The statuses the Visualization plugin's Plot matrix offers for an Outline
 * row, in the order of a note's life. Any other text is still shown as written;
 * this list only names the ones with their own color.
 */
export const KNOWN_STATUSES = ["TO DO", "In Progress", "First Draft", "Revised Draft", "Final Draft", "Done"] as const;

/** A CSS-safe modifier for a status ("In Progress" → "in-progress"); empty for none. */
export function statusModifier(status: string): string {
	return status
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}
