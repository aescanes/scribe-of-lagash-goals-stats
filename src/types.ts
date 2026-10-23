// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

/**
 * Per-note frontmatter keys shared across the Scribe of Lagash series. The
 * single source of truth for key names — never hardcode these strings.
 */
export const FRONTMATTER_KEYS = {
	status: "scribe-note-status",
} as const;

/** Every statistic shown for one note, in the story table and the note popup. */
export interface NoteStats {
	/** Words or characters, per the active metric (and spaces convention). */
	size: number;
	/** Always word-based, whatever the metric. */
	words: number;
	/** Whole minutes, rounded up; 0 only for an empty note. */
	readMinutes: number;
	syllables: number;
	sentences: number;
	paragraphs: number;
	/** Whole pages, rounded up. */
	pages: number;
}

/**
 * The frontmatter marker the Visualization plugin puts on its Outline file, how
 * this plugin recognizes one without a setting of its own to keep in sync.
 */
export const OUTLINE_MARKER = { key: "scribe-visualization", value: "outline" } as const;
