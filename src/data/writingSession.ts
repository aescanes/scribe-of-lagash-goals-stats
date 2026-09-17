// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

// Pure writing-session timer math — no Obsidian imports, unit-tested. A
// session is a plain countdown, deliberately unrelated to any calendar day or
// the daily goal: nothing here reads or writes the goal history.

/**
 * A countdown's remaining time as "m:ss", or "h:mm:ss" once it reaches an
 * hour — a plain digital-timer display, not locale-aware since it's always
 * digits and colons. Only the leftmost unit is left unpadded, same as any
 * ordinary countdown ("5:00", not "05:00").
 */
export function formatDuration(totalSeconds: number): string {
	const seconds = Math.max(0, Math.round(totalSeconds));
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = seconds % 60;
	const pad = (n: number) => String(n).padStart(2, "0");
	return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

/**
 * How much of the session has elapsed, from 0 to 1 — what the ring fills
 * with as time counts down, the mirror image of the daily-goal ring's
 * progress toward a target. 0 for a zero-length or already-finished session.
 */
export function sessionProgress(remainingSeconds: number, totalSeconds: number): number {
	if (totalSeconds <= 0) return 0;
	return Math.min(1, Math.max(0, (totalSeconds - remainingSeconds) / totalSeconds));
}
