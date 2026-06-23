/**
 * node miniprogram/utils/timeWeaveWeekStats.smoke.js
 */
const momentScore = require("./momentScore");
const { buildTimeWeaveWeekStats, pickLineIndex } = require("./timeWeaveWeekStats");

const monday = momentScore.getIsoWeekMonday(new Date("2026-05-19"));

const tasks = [
  {
    id: "a",
    statusText: "已完成",
    createdAt: "2026-05-19 09:00",
    completedAt: "2026-05-20 10:00",
    tags: [{ text: "重要不紧急" }, { text: "自己" }, { text: "真我" }],
  },
  {
    id: "b",
    statusText: "已延期",
    createdAt: "2026-04-01 09:00",
    tags: [{ text: "紧急不重要" }, { text: "外缘" }, { text: "生计" }],
  },
];

const s = buildTimeWeaveWeekStats(tasks, monday, new Date("2026-05-20T12:00:00"));
if (s.flowingCount !== 2) throw new Error("flowingCount");
if (s.createdInWeekCount !== 1) throw new Error("createdInWeekCount");
if (s.totalCount !== 2) throw new Error("totalCount");
if (!s.copyKey) throw new Error("copyKey");
if (pickLineIndex("2026-05-19", "oneSelf") < 1) throw new Error("lineIndex");

console.log("[timeWeaveWeekStats smoke] OK", s.copyKey, s.lineIndex);
