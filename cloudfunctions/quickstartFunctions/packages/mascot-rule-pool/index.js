/**
 * 身体周报 body_week 与时间编织周报 weekly_time 的共用规则池（优先级、命中解析、文案）。
 * 云函数 quickstartFunctions/mascotCopy 与 mascotEngine/rulesBodyWeek|rulesWeekly 均依赖本包，避免双份维护。
 *
 * 云端各函数目录内需自带一份 packages/mascot-rule-pool（微信云安装依赖时无法访问 miniprogram）。
 * 修改本目录后请运行：node scripts/sync-mascot-rule-pool.cjs ，再上传 mascotEngine 与 quickstartFunctions。
 */

"use strict";

const RULE_PRIORITY_BODY_WEEK = Object.freeze([
  "insufficient_data",
  "multi_metric_fluctuation",
  "sleep_persistently_poor",
  "signal_cluster",
]);

const RULE_PRIORITY_WEEKLY_TIME = Object.freeze([
  "insufficient_data",
  "multi_metric_fluctuation",
  "sleep_persistently_poor",
  "signal_cluster",
  "moment_zero",
  "deep_work_low_or_delay_cluster",
]);

const BODY_WEEK_WEEKLY_RULE_TEXT = Object.freeze({
  insufficient_data: "这周的身体记录有点稀疏。没关系，下周从一次呼吸开始就够了。",
  multi_metric_fluctuation: "身体这周有好几处在说话。不用同时回应所有，先顾好睡眠就好。",
  sleep_persistently_poor: "睡眠这周像摇晃的钟摆，身体或许还在找节奏。先留一点空白给休息。",
  signal_cluster: "身体这周有了新的表达。小麟记下了，会帮你留意它的变化。",
  moment_zero: "这周真我时刻很少。也许你在忙别的事，也值得留一点空白给自己。",
  deep_work_low_or_delay_cluster:
    "这周大多是浅层流淌的时间。下周试试给自己留一两个不被打扰的钟头。",
  moment_high: "这周有很多时刻，你完全属于你自己。它们像散落的珍珠，串起了这一周。",
  no_time_logs: "这周没有留下时间的足迹。没记录也不代表这周空白。",
  delay_cluster:
    "有一类事这周总被轻轻绕过。它可能不是不想做，而是需要一种还没到来的能量。",
});

function normalizeHits(hits) {
  if (!Array.isArray(hits)) return [];
  return hits.filter((h) => typeof h === "string" && h);
}

function pickBodyWeekRuleKey(hits) {
  const h = normalizeHits(hits);
  for (let i = 0; i < RULE_PRIORITY_BODY_WEEK.length; i += 1) {
    const key = RULE_PRIORITY_BODY_WEEK[i];
    if (h.indexOf(key) >= 0) return key;
  }
  return "";
}

function pickWeeklyTimeRuleKey(hits) {
  const h = normalizeHits(hits);
  for (let i = 0; i < RULE_PRIORITY_WEEKLY_TIME.length; i += 1) {
    const key = RULE_PRIORITY_WEEKLY_TIME[i];
    if (h.indexOf(key) >= 0) return key;
  }
  if (h.indexOf("moment_high") >= 0) return "moment_high";
  if (h.indexOf("no_time_logs") >= 0) return "no_time_logs";
  if (h.indexOf("delay_cluster") >= 0) return "delay_cluster";
  if (h.indexOf("deep_work_low") >= 0) return "deep_work_low_or_delay_cluster";
  return "";
}

function resolveBodyWeekFromHits(hits) {
  const key = pickBodyWeekRuleKey(hits);
  return key ? BODY_WEEK_WEEKLY_RULE_TEXT[key] || null : null;
}

function resolveWeeklyTimeFromHits(hits) {
  const key = pickWeeklyTimeRuleKey(hits);
  return key ? BODY_WEEK_WEEKLY_RULE_TEXT[key] || null : null;
}

module.exports = {
  RULE_PRIORITY_BODY_WEEK,
  RULE_PRIORITY_WEEKLY_TIME,
  BODY_WEEK_WEEKLY_RULE_TEXT,
  pickBodyWeekRuleKey,
  pickWeeklyTimeRuleKey,
  resolveBodyWeekFromHits,
  resolveWeeklyTimeFromHits,
};
