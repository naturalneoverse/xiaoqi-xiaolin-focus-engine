"use strict";

const rs = require("./reminderSchedule");

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

const noon = new Date(2026, 4, 27, 12, 0, 0, 0).getTime();

assert(rs.normalizeReminderFrequency("不重复") === rs.FREQ_SINGLE, "legacy 不重复");
assert(rs.reminderFrequencyIndex("起止各一次") === 1, "index start-end");

const singleFuture = rs.computeSingleReminderDayYMD("2026-06-01", "2026-06-10", "09:00", noon);
assert(singleFuture === "2026-06-01", "single prefers start");

const singleFallbackEnd = rs.computeSingleReminderDayYMD("2026-05-20", "2026-06-10", "09:00", noon);
assert(singleFallbackEnd === "2026-06-10", "single falls back to end");

const pair = rs.computeStartEndPairReminderDays("2026-06-01", "2026-06-10", "09:00", noon);
assert(pair.length === 2, "start-end pair count");
assert(pair[0] === "2026-06-01" && pair[1] === "2026-06-10", "start-end days");

const pairSame = rs.computeStartEndPairReminderDays("2026-06-01", "2026-06-01", "09:00", noon);
assert(pairSame.length === 1, "same day merges");

const preview = rs.computeReminderPreview("2026-06-01", "2026-06-10", "09:00", "起止各一次", "进行中", noon);
assert(preview.label.indexOf("、") > 0, "preview multi-day label");

assert(
  rs.formatReminderSummaryLine({
    reminderStartDate: "2026-06-17",
    reminderEndDate: "2026-06-21",
    reminderTime: "15:22",
    reminderFrequency: "每天",
    statusText: "进行中",
  }) === "提醒：每天 15:22 · 6/17–6/21",
  "summary daily range",
);
assert(
  rs.formatReminderSummaryLine({ statusText: "已完成", reminderTime: "15:22" }) === "提醒：已停止",
  "summary stopped",
);
assert(rs.formatReminderSummaryLine({ statusText: "进行中" }) === "提醒：未设置", "summary unset");

console.log("[reminderSchedule.test] OK");
