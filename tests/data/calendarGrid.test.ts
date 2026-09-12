// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCalendar, dayStatus, monthGrid } from "../../src/data/calendarGrid";

test("dayStatus: met at or past the goal, partial below it, none at zero", () => {
	assert.equal(dayStatus(1667, 1667), "met");
	assert.equal(dayStatus(2000, 1667), "met");
	assert.equal(dayStatus(500, 1667), "partial");
	assert.equal(dayStatus(0, 1667), "none");
});

test("dayStatus with no goal set: any writing counts, nothing is 'met'", () => {
	assert.equal(dayStatus(500, 0), "partial");
	assert.equal(dayStatus(0, 0), "none");
});

test("monthGrid pads to full Sunday-first weeks around the month", () => {
	// October 2020 starts on a Thursday and has 31 days — matches the reference layout:
	// Sun 27 28 29 30 Thu 1 Fri 2 Sat 3, ..., ending in a trailing week into November.
	const weeks = monthGrid(2020, 9); // month is 0-based
	assert.equal(weeks[0].length, 7);
	assert.deepEqual(
		weeks[0].map((d) => d.getDate()),
		[27, 28, 29, 30, 1, 2, 3],
	);
	assert.equal(weeks[0][0].getMonth(), 8); // September
	assert.equal(weeks[0][4].getMonth(), 9); // October
	const lastWeek = weeks[weeks.length - 1];
	assert.equal(lastWeek[0].getDate(), 1);
	assert.equal(lastWeek[0].getMonth(), 10); // November
	// Every week is exactly 7 days and the whole grid covers every day of the month.
	for (const week of weeks) assert.equal(week.length, 7);
});

test("monthGrid needs no filler when the month starts on Sunday and ends exactly on Saturday", () => {
	// November 2026 starts on a Sunday and has 30 days -> exactly 5 full weeks and no leading filler.
	const weeks = monthGrid(2026, 10);
	assert.equal(weeks[0][0].getDate(), 1);
	assert.equal(weeks[0][0].getMonth(), 10);
});

test("buildCalendar marks in-month, today, and status per cell", () => {
	const today = new Date(2026, 8, 10); // 2026-09-10
	const written = new Map([
		["2026-09-09", 1667],
		["2026-09-10", 500],
	]);
	const weeks = buildCalendar(2026, 8, today, 1667, (iso) => written.get(iso) ?? 0);
	const flat = weeks.flat();

	const sep9 = flat.find((c) => c.iso === "2026-09-09");
	const sep10 = flat.find((c) => c.iso === "2026-09-10");
	assert.equal(sep9?.status, "met");
	assert.equal(sep10?.status, "partial");
	assert.equal(sep10?.isToday, true);
	assert.equal(sep9?.isToday, false);
	assert.equal(sep9?.written, 1667);
	assert.equal(sep10?.written, 500);

	const noEntry = flat.find((c) => c.iso === "2026-09-08");
	assert.equal(noEntry?.written, 0);

	const outOfMonth = flat.find((c) => !c.inMonth);
	assert.ok(outOfMonth, "expected at least one filler day from an adjacent month");
});
