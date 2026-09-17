// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

/** A single, bright, high-pitched strike — roughly E7, like a small hotel
 *  reception/service bell — rather than a low church bell. */
const FUNDAMENTAL_FREQUENCY = 2600;

/** How many Hz apart the two fundamental partials below sit — close enough
 *  that they don't sound like two separate pitches, just one tone that
 *  audibly "wah"s this many times a second as it rings out. That slow
 *  beating is a hotel bell's most recognizable feature; a single perfectly
 *  clean fundamental decays sounding flatter, more like a tuning fork. */
const BEAT_FREQUENCY_HZ = 4;

/**
 * Each partial that makes up the strike, as an absolute frequency (not a
 * plain ratio of the fundamental, since the first two are only
 * `BEAT_FREQUENCY_HZ` apart on purpose — seeing them as "1× and 1.0015×"
 * would obscure that). The higher three are inharmonic (not whole-number
 * multiples of the fundamental) — what makes a struck metal bell sound
 * metallic rather than like a plain tone — and their much shorter `decay`
 * gives the bright "clang" of the strike itself, separate from the
 * fundamental pair's own longer, shimmering ring. Each `gain` is the *peak*
 * level that partial's own attack ramps up to, not a shared one (see
 * `playBellSound`).
 */
const PARTIALS = [
	{ frequency: FUNDAMENTAL_FREQUENCY, gain: 0.28, decay: 1.6 },
	{ frequency: FUNDAMENTAL_FREQUENCY + BEAT_FREQUENCY_HZ, gain: 0.28, decay: 1.6 },
	{ frequency: FUNDAMENTAL_FREQUENCY * 1.5, gain: 0.2, decay: 0.3 }, // metallic transient
	{ frequency: FUNDAMENTAL_FREQUENCY * 2.6, gain: 0.14, decay: 0.2 },
	{ frequency: FUNDAMENTAL_FREQUENCY * 4.2, gain: 0.09, decay: 0.1 }, // brightest, shortest-lived partial
];

/** How long each partial's attack takes to reach its own peak gain, before
 *  its own decay begins. */
const ATTACK_TIME = 0.005;

/**
 * A short, synthesized single-strike bell — a bright, high-pitched "clang"
 * that fades quickly, under a shimmering fundamental tone that lingers well
 * after it — generated with the Web Audio API instead of shipping an audio
 * file, so there's nothing to bundle, license, or load. Failures (no audio
 * hardware, a stricter autoplay policy, …) are swallowed — the writing
 * session's completion is already announced visually (the `Notice` toast,
 * the ring returning to idle), so a missing sound isn't worth surfacing
 * further.
 */
export function playBellSound(): void {
	try {
		const ctx = new AudioContext();
		const now = ctx.currentTime;

		// Trims the combined level of every overlapping partial below clipping,
		// rather than having to re-balance each one's own gain by hand.
		const masterGain = ctx.createGain();
		masterGain.gain.setValueAtTime(0.6, now);
		masterGain.connect(ctx.destination);

		for (const { frequency, gain, decay } of PARTIALS) {
			const oscillator = ctx.createOscillator();
			const gainNode = ctx.createGain();

			oscillator.type = "sine";
			oscillator.frequency.setValueAtTime(frequency, now);

			// A quick attack up to this partial's own peak, then its own
			// exponential decay to silence — the fundamental pair's decay is far
			// longer than the others', which is what separates the bright
			// initial "clang" from the shimmering tail that rings on after it.
			gainNode.gain.setValueAtTime(0.0001, now);
			gainNode.gain.exponentialRampToValueAtTime(gain, now + ATTACK_TIME);
			gainNode.gain.exponentialRampToValueAtTime(0.0001, now + decay);

			oscillator.connect(gainNode);
			gainNode.connect(masterGain);

			oscillator.start(now);
			oscillator.stop(now + decay);
		}

		const totalDuration = Math.max(...PARTIALS.map((partial) => partial.decay));
		window.setTimeout(() => void ctx.close(), (totalDuration + 0.1) * 1000);
	} catch {
		// See doc comment above — a failed sound is not worth surfacing further.
	}
}
