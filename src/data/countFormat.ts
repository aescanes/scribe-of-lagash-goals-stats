// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import type { GoalMetric } from "../settings/settings";

/**
 * The count as shown next to a file-explorer row: locale-grouped number, a
 * short unit ("word"/"words", "char"/"chars"), singular below two. Folder vs.
 * note is no longer spelled out in the text — the badge's position, colour and
 * the note-only icon (see `explorerDecorator`) carry that distinction instead.
 * `isFolder` is kept in the signature in case that changes again.
 */
export function formatCount(count: number, metric: GoalMetric, isFolder: boolean): string {
	const grouped = count.toLocaleString();
	const unit =
		metric === "characters"
			? count === 1
				? "char"
				: "chars"
			: count === 1
				? "word"
				: "words";
	return `${grouped} ${unit}`;
}
