/**
 * 运行：node miniprogram/utils/reflectionListGroups.test.js
 */
"use strict";

const assert = require("assert");
const momentScore = require("./momentScore");
const groups = require("./reflectionListGroups");

const REF = new Date(2026, 4, 27, 12, 0, 0, 0);

function msAt(y, m, d, hh, mm) {
  return new Date(y, m, d, hh || 0, mm || 0, 0, 0).getTime();
}

assert.strictEqual(
  groups.classifyArchiveBucket(msAt(2026, 4, 26), REF).sectionKey,
  groups.SECTION_THIS_WEEK,
  "Thu in same ISO week as May 27",
);

const prevMon = momentScore.getIsoWeekMonday(REF);
prevMon.setDate(prevMon.getDate() - 7);
const lastWeekMid = new Date(prevMon);
lastWeekMid.setDate(lastWeekMid.getDate() + 2);
lastWeekMid.setHours(15, 0, 0, 0);
assert.strictEqual(
  groups.classifyArchiveBucket(lastWeekMid.getTime(), REF).sectionKey,
  groups.SECTION_LAST_WEEK,
);

assert.strictEqual(
  groups.classifyArchiveBucket(msAt(2026, 4, 1), REF).sectionKey,
  groups.SECTION_THIS_MONTH,
);

assert.strictEqual(
  groups.classifyArchiveBucket(msAt(2026, 2, 15), REF).sectionKey,
  "2026-03",
);

assert.ok(
  groups.formatListCardTime(msAt(2026, 4, 26, 9, 5), groups.SECTION_THIS_WEEK, REF).includes("9:05"),
);

console.log("[reflectionListGroups.test] OK");
