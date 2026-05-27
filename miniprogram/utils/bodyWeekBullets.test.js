/**
 * 运行：node miniprogram/utils/bodyWeekBullets.test.js
 */
"use strict";

const assert = require("assert");
const bodyStats = require("./bodyStats");
const bullets = require("./bodyWeekBullets");
const C = require("../config/bodyWeekArchiveConstants");
const {
  FULL_GRID_NO_EXTREME,
  FULL_WITH_DOWNGRADE,
  STEADY_WEEK,
  SPARSE_ONE_DAY,
  makeRec,
} = require("./bodyWeekBullets.fixtures");
const stats = require("./mascotCopyStats");

const WEEK_START = new Date(2025, 4, 19, 0, 0, 0, 0);
const WEEK_END = new Date(2025, 4, 25, 23, 59, 59, 999);

function weekRep(records) {
  return bodyStats.buildWeekReportPayload(records, WEEK_START, WEEK_END);
}

function types(list) {
  return list.map((b) => b.type);
}

const fullRep = weekRep(FULL_GRID_NO_EXTREME);
assert.strictEqual(fullRep.finalStatusTitle, "身心满格");
const prevWeekRecords = [
  makeRec("2025-05-12", "睡得香", "动了点", "没事"),
  makeRec("2025-05-13", "睡得香", "动了点", "没事"),
];
const allForTrend = FULL_GRID_NO_EXTREME.concat(prevWeekRecords);
const weekStats = stats.buildBodyWeekStats(allForTrend, WEEK_START, WEEK_END);
const prevStart = new Date(WEEK_START);
prevStart.setDate(prevStart.getDate() - 7);
const prevEnd = new Date(WEEK_END);
prevEnd.setDate(prevEnd.getDate() - 7);
const prevRep = bodyStats.buildWeekReportPayload(allForTrend, prevStart, prevEnd);
const fullBullets = bullets.buildBodyWeekBullets(fullRep, weekStats, prevRep);
assert(fullBullets.length >= 3 && fullBullets.length <= 10, `count ${fullBullets.length}`);
assert(types(fullBullets).includes("TREND"), "trend when prev week valid");
assert(types(fullBullets).includes("BAND"));
assert(types(fullBullets).includes("EXTREME_NONE"));
assert(!types(fullBullets).includes("DOWNGRADE"));
assert(!types(fullBullets).some((t) => t.startsWith("EXTREME_") && t !== "EXTREME_NONE"));
const fullCopy = bullets.validateBulletsForUserCopy(fullBullets);
assert(fullCopy.ok, fullCopy.errors);

const downRep = weekRep(FULL_WITH_DOWNGRADE);
assert(downRep.baseStatusTitle === "身心满格" && downRep.finalStatusTitle === "状态平稳", "downgrade titles");
const downBullets = bullets.buildBodyWeekBullets(downRep);
assert(types(downBullets).includes("DOWNGRADE"));
assert(types(downBullets).includes("EXTREME_SLEEP"));
assert(types(downBullets).includes("EXTREME_SIGNAL"));
assert(!types(downBullets).includes("EXTREME_NONE"));

const steadyRep = weekRep(STEADY_WEEK);
assert.strictEqual(steadyRep.finalStatusTitle, "状态平稳");
const steadyBullets = bullets.buildBodyWeekBullets(steadyRep);
assert(steadyBullets.some((b) => b.type === "BAND" && b.text.includes("状态平稳")));

const sparseRep = weekRep(SPARSE_ONE_DAY);
assert.strictEqual(sparseRep.dayCount, 1);
assert.deepStrictEqual(bullets.buildBodyWeekBullets(sparseRep), []);

const h1 = bullets.buildBodyWeekStatsHash(fullRep);
const h2 = bullets.buildBodyWeekStatsHash(fullRep);
assert.strictEqual(h1, h2);
const tweaked = weekRep(FULL_GRID_NO_EXTREME.slice(0, 4));
const h3 = bullets.buildBodyWeekStatsHash(tweaked);
assert.notStrictEqual(h1, h3);

console.log("[bodyWeekBullets.test] OK", {
  full: types(fullBullets),
  downgrade: types(downBullets).filter((t) => t.startsWith("EXTREME") || t === "DOWNGRADE"),
  steadyBand: steadyBullets.find((b) => b.type === "BAND").text.slice(0, 24),
  hashPrefix: h1.slice(0, 12),
});
