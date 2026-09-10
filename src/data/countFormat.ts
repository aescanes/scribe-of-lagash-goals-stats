// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import type { GoalMetric } from "../settings/settings";

/**
 * The count as shown next to a file-explorer row: locale-grouped number,
 * spelled-out unit, singular below two. A folder's rolled-up total is wrapped
 * in brackets — "[1,234 words]" — and a note's own count in parentheses —
 * "(1 character)" — so the two read differently at a glance.
 */
export function formatCount(count: number, metric: GoalMetric, isFolder: boolean): string {
	const grouped = count.toLocaleString();
	const unit =
		metric === "characters"
			? count === 1
				? "character"
				: "characters"
			: count === 1
				? "word"
				: "words";
	const body = `${grouped} ${unit}`;
	return isFolder ? `[${body}]` : `(${body})`;
}
