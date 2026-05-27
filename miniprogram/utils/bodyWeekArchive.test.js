/**
 * 运行：node miniprogram/utils/bodyWeekArchive.test.js
 */
"use strict";

const assert = require("assert");
const C = require("../config/bodyWeekArchiveConstants");
const archive = require("./bodyWeekArchive");

const WEEK = "2025-05-19";
const STATUS_DESC =
  "这周睡眠多数以睡得香为主，运动以动了点居多，身体信号多为没事；整体节奏在身心满格这一档，没有失眠、过载或疼痛记录，具体分布请看上方三张图哦。";
const CARE_TEXT =
  "小麟看见：这周睡和信号都偏稳，运动略少一点；您已经照顾得很好，下周若想再进一步，每天多走几分钟就够。";

const sampleEntry = {
  weekKey: WEEK,
  statsHash: "abc123",
  status: C.ARCHIVE_STATUS.OPEN,
  bullets: [{ type: "BAND", text: "BAND: 身心满格" }],
  statusDesc: STATUS_DESC,
  careText: CARE_TEXT,
  source: C.ARCHIVE_SOURCE.MODEL,
  finalStatusTitle: "身心满格",
  validDayCount: 5,
};

const normalized = archive.normalizeEntry(sampleEntry);
assert(normalized && normalized.weekKey === WEEK, "normalizeEntry");

const valid = archive.validateEntry(normalized);
assert(valid.ok, valid.errors);

const bad = archive.validateEntry(
  Object.assign({}, normalized, { careText: "本周得分很高，继续加油。" })
);
assert(!bad.ok && bad.errors.some((e) => e.startsWith("forbidden_")), bad.errors);

const sparse = archive.normalizeEntry({
  weekKey: WEEK,
  statsHash: "sparse1",
  status: C.ARCHIVE_STATUS.CLOSED,
  closedAt: "2025-05-26T08:00:00.000Z",
  bullets: [],
  statusDesc: "",
  careText: "",
  source: C.ARCHIVE_SOURCE.RULE,
  finalStatusTitle: "待生成",
  validDayCount: 1,
});
const sparseValid = archive.validateEntry(sparse);
assert(sparseValid.ok, sparseValid.errors);

const store = archive.normalizeStore({
  version: 1,
  weeks: { [WEEK]: sampleEntry },
});
assert(store.weeks[WEEK].statsHash === "abc123", "normalizeStore weeks");

const legacyFlat = archive.normalizeStore({
  [WEEK]: Object.assign({}, sampleEntry, { statsHash: "legacy" }),
});
assert(legacyFlat.weeks[WEEK].statsHash === "legacy", "legacy flat keys");

assert(archive.isValidWeekKey("2025-05-19"));
assert(!archive.isValidWeekKey("2025/05/19"));

const monAfter = new Date(2025, 4, 26, 8, 0, 0);
assert(archive.shouldCloseWeek(WEEK, monAfter) === true, "should close after next Monday");
const sunBefore = new Date(2025, 4, 25, 23, 59, 59);
assert(archive.shouldCloseWeek(WEEK, sunBefore) === false, "should not close before next Monday");

console.log("[bodyWeekArchive.test] OK");
