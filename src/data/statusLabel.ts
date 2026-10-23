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

/** A CSS-safe modifier for a status ("In Progress" → "in-progress"); empty for none. */
export function statusModifier(status: string): string {
	return status
		.toLowerCase()
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}
