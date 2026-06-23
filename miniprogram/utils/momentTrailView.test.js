"use strict";

const { buildMomentTrailView } = require("./momentTrailView");
const momentScore = require("./momentScore");

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

const tasks = [
  {
    id: "a",
    statusText: "已完成",
    completedAt: "2025-06-20 10:00",
    tags: [{ text: "" }, { text: "不二" }, { text: "真我" }],
  },
  {
    id: "b",
    statusText: "已完成",
    completedAt: "2025-06-13 10:00",
    tags: [{ text: "" }, { text: "不二" }, { text: "合一" }],
  },
];

const trail = buildMomentTrailView(tasks);
assert(trail.currentWeek.displayText, "current week");
assert(trail.historyRows.length >= 1, "history without current week");
assert(!trail.historyRows.some((r) => r.rangeLabel.indexOf("本周") >= 0), "no current week in history");

const foot36 = momentScore.formatMomentScoreFootnote(36);
assert(foot36.length > 0, "36 footnote");
const foot100 = momentScore.formatMomentScoreFootnote(100);
assert(foot100.indexOf("你还好吗") >= 0, "100 footnote");

console.log("[momentTrailView.test] OK");
