// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

// Pure parsing of a note's length target — no Obsidian imports, unit-tested.

/**
 * A target from untyped input (a frontmatter value or an Outline cell): a
 * positive number, or text such as "5000", "5,000" or "5 000"; the first usable
 * item of a list. Anything else — zero, negative, blank, non-numeric — is no
 * target (null).
 */
export function parseTarget(raw: unknown): number | null {
	if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? Math.round(raw) : null;
	if (typeof raw === "string") {
		const digits = raw.trim().replace(/[\s,_.](?=\d{3}\b)/g, "");
		return /^\d+$/.test(digits) && Number.parseInt(digits, 10) > 0 ? Number.parseInt(digits, 10) : null;
	}
	if (Array.isArray(raw)) {
		for (const item of raw) {
			const target = parseTarget(item);
			if (target !== null) return target;
		}
	}
	return null;
}
