// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

interface ConfettiPiece {
	x: number;
	y: number;
	vx: number;
	vy: number;
	rotation: number;
	rotationSpeed: number;
	size: number;
	color: string;
}

const PARTICLE_COUNT = 300;
/** The plugin's own brand accent alongside a handful of festive colours —
 *  confetti reads as colourful and celebratory regardless of the app's
 *  theme, unlike a UI element, which is why this doesn't go through
 *  `--scribe-accent`-style CSS variables the way everything else does. */
const COLORS = ["#81096b", "#b851a5", "#f4c542", "#4ecdc4", "#ff6b6b"];
const GRAVITY = 0.35;
const DURATION_MS = 3500;
/** Launch speed range (px/frame) — fast enough that the burst visibly
 *  reaches well up the window before gravity pulls each piece back down. */
const MIN_LAUNCH_SPEED = 14;
const MAX_LAUNCH_SPEED = 26;
/** How wide the fan of launch angles is, either side of straight up — a full
 *  spread (near ±90°) would send some pieces out sideways along the bottom
 *  edge instead of up into the window. */
const LAUNCH_SPREAD_RADIANS = Math.PI * 0.35;
/** Once elapsed time passes this fraction of `DURATION_MS`, pieces start
 *  fading out rather than just stopping abruptly at the end. */
const FADE_START_FRACTION = 0.7;

/**
 * A brief confetti fountain — launched from the bottom centre of the window,
 * fanning up and out to either side before gravity brings it back down —
 * celebrating the daily goal being reached. A first-party canvas animation
 * instead of a dependency, for the same reason `bellSound.ts`'s tone is
 * synthesized rather than a bundled audio file: it's a small, self-contained
 * effect, not worth taking on a package for. Skipped entirely if the OS is
 * set to reduce motion, and fails silently on any other error (no canvas
 * support, …) — the toast and status-bar item already announce the goal
 * being reached, so a missing celebration effect isn't worth surfacing
 * further.
 */
export function playConfettiBurst(): void {
	try {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

		const canvas = document.createElement("canvas");
		canvas.addClass("scribe-confetti-canvas");
		canvas.width = window.innerWidth;
		canvas.height = window.innerHeight;
		document.body.appendChild(canvas);

		const ctx = canvas.getContext("2d");
		if (!ctx) {
			canvas.remove();
			return;
		}

		// A fountain from the bottom centre, fanning up and out to either side —
		// not pieces already falling from random points across the top.
		const originX = canvas.width / 2;
		const originY = canvas.height;
		const pieces: ConfettiPiece[] = Array.from({ length: PARTICLE_COUNT }, () => {
			// 0 radians = straight up; positive/negative spread left and right of it.
			const angle = (Math.random() - 0.5) * LAUNCH_SPREAD_RADIANS;
			const speed = MIN_LAUNCH_SPEED + Math.random() * (MAX_LAUNCH_SPEED - MIN_LAUNCH_SPEED);
			return {
				x: originX,
				y: originY,
				vx: Math.sin(angle) * speed,
				vy: -Math.cos(angle) * speed,
				rotation: Math.random() * 360,
				rotationSpeed: (Math.random() - 0.5) * 10,
				size: Math.random() * 6 + 4,
				color: COLORS[Math.floor(Math.random() * COLORS.length)],
			};
		});

		const startTime = performance.now();
		let animationId = 0;
		let done = false;

		const cleanup = () => {
			if (done) return;
			done = true;
			cancelAnimationFrame(animationId);
			canvas.remove();
		};

		const step = (now: number) => {
			if (done) return;
			const elapsed = now - startTime;
			ctx.clearRect(0, 0, canvas.width, canvas.height);

			const fadeStart = DURATION_MS * FADE_START_FRACTION;
			const opacity = elapsed > fadeStart ? Math.max(0, 1 - (elapsed - fadeStart) / (DURATION_MS - fadeStart)) : 1;

			for (const piece of pieces) {
				piece.x += piece.vx;
				piece.y += piece.vy;
				piece.vy += GRAVITY;
				piece.rotation += piece.rotationSpeed;

				ctx.save();
				ctx.globalAlpha = opacity;
				ctx.translate(piece.x, piece.y);
				ctx.rotate((piece.rotation * Math.PI) / 180);
				ctx.fillStyle = piece.color;
				ctx.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2);
				ctx.restore();
			}

			if (elapsed < DURATION_MS) {
				animationId = requestAnimationFrame(step);
			} else {
				cleanup();
			}
		};

		animationId = requestAnimationFrame(step);
		// Safety net: requestAnimationFrame pauses while the window is out of
		// focus, so without this a burst interrupted that way could leave the
		// canvas sitting in the DOM until the window regains focus.
		window.setTimeout(cleanup, DURATION_MS + 500);
	} catch {
		// See doc comment above — a failed celebration effect is not worth surfacing further.
	}
}
