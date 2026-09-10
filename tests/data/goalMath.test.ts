// SPDX-License-Identifier: MIT
// Copyright (C) 2026 aescanes

import assert from "node:assert/strict";
import { test } from "node:test";
import {
	monthlyGoal,
	WEEKDAYS,
	weeklyGoal,
	writingDaysInMonth,
	writingDaysPerWeek,
} from "../../src/data/goalMath";

const EVERY_DAY = [true, true, true, true, true, true, true];
const WEEKDAYS_ONLY = [true, true, true, true, true, false, false]; // Mon–Fri
const NONE = [false, false, false, false, false, false, false];

test("WEEKDAYS is Monday-first and seven long", () => {
	assert.equal(WEEKDAYS.length, 7);
	assert.equal(WEEKDAYS[0], "Monday");
	assert.equal(WEEKDAYS[6], "Sunday");
});

test("writingDaysPerWeek counts the checked days", () => {
	assert.equal(writingDaysPerWeek(EVERY_DAY), 7);
	assert.equal(writingDaysPerWeek(WEEKDAYS_ONLY), 5);
	assert.equal(writingDaysPerWeek(NONE), 0);
});

test("weeklyGoal multiplies the daily goal by writing days", () => {
	assert.equal(weeklyGoal(500, WEEKDAYS_ONLY), 2500);
	assert.equal(weeklyGoal(500, EVERY_DAY), 3500);
	assert.equal(weeklyGoal(500, NONE), 0);
});

test("weeklyGoal rounds and floors the daily goal", () => {
	assert.equal(weeklyGoal(499.6, EVERY_DAY), 3500);
	assert.equal(weeklyGoal(-10, EVERY_DAY), 0);
	assert.equal(weeklyGoal(Number.NaN, EVERY_DAY), 0);
});

test("writingDaysInMonth counts real dates that land on a writing day", () => {
	// July 2026: 31 days, starts on a Wednesday. Every day selected => 31.
	assert.equal(writingDaysInMonth(2026, 6, EVERY_DAY), 31);
	// Mon–Fri only across July 2026 => 23 weekdays.
	assert.equal(writingDaysInMonth(2026, 6, WEEKDAYS_ONLY), 23);
	// February 2026: 28 days, no leap day.
	assert.equal(writingDaysInMonth(2026, 1, EVERY_DAY), 28);
	assert.equal(writingDaysInMonth(2026, 6, NONE), 0);
});

test("writingDaysInMonth handles a leap February", () => {
	assert.equal(writingDaysInMonth(2028, 1, EVERY_DAY), 29);
});

test("monthlyGoal multiplies the daily goal by the month's writing days", () => {
	assert.equal(monthlyGoal(500, WEEKDAYS_ONLY, 2026, 6), 11500);
	assert.equal(monthlyGoal(1000, EVERY_DAY, 2026, 1), 28000);
	assert.equal(monthlyGoal(500, NONE, 2026, 6), 0);
});
