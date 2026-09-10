// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

// Pure scoping rule — no Obsidian imports, unit-tested.

/** Trims surrounding whitespace and slashes so paths compare cleanly. */
function normalize(path: string): string {
	return path.trim().replace(/^\/+/, "").replace(/\/+$/, "");
}

/**
 * Whether a vault-relative path (a note or a folder) is within the configured
 * story folder. An empty story folder means the whole vault is in scope. An
 * ancestor of the story folder is not in scope — only the folder itself and
 * everything beneath it.
 */
export function inStoryFolder(path: string, storyFolder: string): boolean {
	const base = normalize(storyFolder);
	if (!base) return true;
	const target = normalize(path);
	return target === base || target.startsWith(`${base}/`);
}
