// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

const SVG_NS = "http://www.w3.org/2000/svg";
const DISC_RADIUS = 52;
/** An SVG stroke is centred on its path, so the arc needs a smaller radius
 *  than the filled disc — by half its own width — to sit flush on the rim
 *  instead of sticking out past it. */
const ARC_STROKE_WIDTH = 10;
const ARC_RADIUS = DISC_RADIUS - ARC_STROKE_WIDTH / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * ARC_RADIUS;

export interface ProgressRingOptions {
	/** 0 to 1; out-of-range values are clamped rather than trusted. */
	progress: number;
	/** Adds the glowing "reached" styling — the goal met, or a session done. */
	reached?: boolean;
	/** Big text at the centre — a word count, or a countdown like "4:32". */
	valueText: string;
	/** Smaller text under the value, e.g. a unit; omitted when there's none. */
	unitText?: string;
	/** Text above the value, e.g. "Today" / "Goal reached!" / "Remaining". */
	label: string;
}

/**
 * Builds a progress ring (a pale filled disc with a progress arc drawn over
 * it) into `containerEl` — shared by the daily-goal ring and the writing-
 * session countdown so both stay visually identical without duplicating the
 * SVG construction. Returns the wrapping element, in case the caller needs to
 * toggle a class on it later.
 */
export function renderProgressRing(containerEl: HTMLElement, options: ProgressRingOptions): HTMLElement {
	const progress = Math.min(1, Math.max(0, options.progress));

	const wrap = containerEl.createDiv({ cls: "scribe-goal-ring-wrap" });
	wrap.toggleClass("mod-reached", options.reached ?? false);

	const svg = document.createElementNS(SVG_NS, "svg");
	svg.setAttribute("viewBox", "0 0 120 120");
	svg.setAttribute("class", "scribe-goal-ring");
	wrap.appendChild(svg);

	const track = document.createElementNS(SVG_NS, "circle");
	track.setAttribute("cx", "60");
	track.setAttribute("cy", "60");
	track.setAttribute("r", String(DISC_RADIUS));
	track.setAttribute("class", "scribe-goal-ring-track");
	svg.appendChild(track);

	const fill = document.createElementNS(SVG_NS, "circle");
	fill.setAttribute("cx", "60");
	fill.setAttribute("cy", "60");
	fill.setAttribute("r", String(ARC_RADIUS));
	fill.setAttribute("class", "scribe-goal-ring-fill");
	fill.setAttribute("stroke-dasharray", String(RING_CIRCUMFERENCE));
	fill.setAttribute("stroke-dashoffset", String(RING_CIRCUMFERENCE * (1 - progress)));
	svg.appendChild(fill);

	const center = wrap.createDiv({ cls: "scribe-goal-ring-center" });
	center.createDiv({ cls: "scribe-goal-ring-label", text: options.label });
	center.createDiv({ cls: "scribe-goal-ring-value", text: options.valueText });
	if (options.unitText) center.createDiv({ cls: "scribe-goal-ring-unit", text: options.unitText });

	return wrap;
}
