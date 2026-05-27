/**
 * 运行：node miniprogram/utils/bodyWeekReportCare.test.js
 */
"use strict";

const assert = require("assert");
const bodyStats = require("./bodyStats");
const bodyWeekArchive = require("./bodyWeekArchive");
const { resolveCarePlan } = require("./bodyWeekReportCare");
const C = require("../config/bodyWeekArchiveConstants");
const {
  FULL_GRID_NO_EXTREME,
  FULL_WITH_DOWNGRADE,
  SPARSE_ONE_DAY,
} = require("./bodyWeekBullets.fixtures");

const WEEK_START = new Date(2025, 4, 19, 0, 0, 0, 0);
const WEEK_END = new Date(2025, 4, 25, 23, 59, 59, 999);

function weekRep(records) {
  return bodyStats.buildWeekReportPayload(records, WEEK_START, WEEK_END);
}

const fullRep = weekRep(FULL_GRID_NO_EXTREME);
const planOpen = resolveCarePlan("2025-05-19", fullRep, null, new Date(2025, 4, 21));
assert.strictEqual(planOpen.mode, "refresh_open");

const closedEntry = {
  weekKey: "2025-05-19",
  statsHash: planOpen.statsHash,
  status: C.ARCHIVE_STATUS.CLOSED,
  closedAt: "2025-05-26T08:00:00.000Z",
  bullets: [],
  statusDesc: "这周睡眠多数以睡得香为主，运动以动了点居多，身体信号多为没事；整体节奏在身心满格这一档，没有失眠、过载或疼痛记录，具体分布请看上方三张图哦。",
  careText: "小麟看见：这周睡和信号都偏稳，运动略少一点；您已经照顾得很好，下周若想再进一步，每天多走几分钟就够。",
  source: C.ARCHIVE_SOURCE.MODEL,
  finalStatusTitle: "身心满格",
  validDayCount: 5,
};
const planReadonly = resolveCarePlan("2025-05-19", fullRep, closedEntry, new Date(2025, 4, 28));
assert.strictEqual(planReadonly.mode, "archive_readonly");

const planHit = resolveCarePlan("2025-05-19", fullRep, Object.assign({}, closedEntry, { status: C.ARCHIVE_STATUS.OPEN }), new Date(2025, 4, 21));
assert.strictEqual(planHit.mode, "archive_hit");

const sparseRep = weekRep(SPARSE_ONE_DAY);
const planSparse = resolveCarePlan("2025-05-19", sparseRep, null, new Date(2025, 4, 21));
assert.strictEqual(planSparse.mode, "rule_sparse");

const downRep = weekRep(FULL_WITH_DOWNGRADE);
const planClose = resolveCarePlan("2025-05-19", downRep, null, new Date(2025, 4, 26, 10, 0, 0));
assert.strictEqual(planClose.mode, "close_week");

assert(bodyWeekArchive.shouldCloseWeek("2025-05-19", new Date(2025, 4, 26)));

console.log("[bodyWeekReportCare.test] OK");
