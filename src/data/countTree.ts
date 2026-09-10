// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

// Pure aggregation — no Obsidian imports, unit-tested.

/**
 * Given per-file counts keyed by vault-relative path, returns the total for
 * every ancestor folder, each summed over the files anywhere beneath it. Folder
 * keys carry no trailing slash; the vault root is not included. Files at the
 * vault root contribute to no folder and so add nothing to the result.
 */
export function folderTotals(fileCounts: Record<string, number>): Record<string, number> {
	const totals: Record<string, number> = {};
	for (const [path, count] of Object.entries(fileCounts)) {
		const parts = path.split("/");
		parts.pop(); // drop the file name, leaving its folder chain
		let prefix = "";
		for (const part of parts) {
			prefix = prefix ? `${prefix}/${part}` : part;
			totals[prefix] = (totals[prefix] ?? 0) + count;
		}
	}
	return totals;
}
