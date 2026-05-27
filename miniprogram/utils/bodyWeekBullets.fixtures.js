/**
 * 阶段 2 单测样例周（自然周 2025-05-19 周一～05-25 周日）
 */
"use strict";

function makeRec(dateKey, sleep, sport, signal) {
  return {
    dateKey,
    sleep,
    sport,
    signal,
    createdAt: `${dateKey}T12:00:00`,
  };
}

const WEEK_DAYS = ["2025-05-19", "2025-05-20", "2025-05-21", "2025-05-22", "2025-05-23"];

/** 满格、无极值、无降档 */
const FULL_GRID_NO_EXTREME = WEEK_DAYS.map((d) => makeRec(d, "睡得香", "动了点", "没事"));

/** 满格基线 + 同日≥2 类极值 → 降一档（好日用动够了抬高均分，仍进 100–120） */
const FULL_WITH_DOWNGRADE = [
  makeRec("2025-05-19", "睡得香", "动够了", "没事"),
  makeRec("2025-05-20", "睡得香", "动够了", "没事"),
  makeRec("2025-05-21", "睡得香", "动够了", "没事"),
  makeRec("2025-05-22", "睡得香", "动够了", "没事"),
  makeRec("2025-05-23", "睡不着", "动了点", "疼了"),
];

/** 状态平稳档（均分约 80） */
const STEADY_WEEK = [
  makeRec("2025-05-19", "睡得香", "动了点", "累了"),
  makeRec("2025-05-20", "睡得香", "没咋动", "累了"),
  makeRec("2025-05-21", "睡得香", "动了点", "累了"),
  makeRec("2025-05-22", "睡得香", "动了点", "累了"),
];

/** 稀疏 1 天 */
const SPARSE_ONE_DAY = [makeRec("2025-05-21", "睡得香", "动了点", "没事")];

module.exports = {
  makeRec,
  FULL_GRID_NO_EXTREME,
  FULL_WITH_DOWNGRADE,
  STEADY_WEEK,
  SPARSE_ONE_DAY,
};
