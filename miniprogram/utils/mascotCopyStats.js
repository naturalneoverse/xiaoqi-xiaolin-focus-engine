const momentScore = require("./momentScore");
const bodyStats = require("./bodyStats");

const DATA_SCHEMA_VERSION = "1";

/** 自然周已过天数（含当天）：周一=1 … 周日=7。用于避免周初因有效天数少误触发「记录稀疏」。 */
function isoWeekElapsedDaysInclusive(weekMondayStart, refNow) {
  const ref = refNow || new Date();
  const a = new Date(
    weekMondayStart.getFullYear(),
    weekMondayStart.getMonth(),
    weekMondayStart.getDate(),
    0,
    0,
    0,
    0,
  );
  const b = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
  const diffDays = Math.floor((b.getTime() - a.getTime()) / 86400000);
  const inclusive = diffDays + 1;
  return Math.min(7, Math.max(1, inclusive));
}

/** 达到该「已过天数」后，才允许打 insufficient_data（默认周四起） */
const BODY_WEEK_SPARSE_MIN_ELAPSED = 4;

const WEEKDAY_LABELS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function slotFromHour(hour) {
  if (hour >= 5 && hour < 12) return "上午";
  if (hour >= 12 && hour < 18) return "下午";
  if (hour >= 18 && hour < 22) return "傍晚";
  return "夜间";
}

function parseLooseDateTime(str) {
  if (!str) return null;
  const s = String(str).trim().replace(/\//g, "-");
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], m[4] != null ? +m[4] : 0, m[5] != null ? +m[5] : 0, 0, 0);
}

function tagText(task, index) {
  if (!task || !Array.isArray(task.tags) || !task.tags[index]) return "";
  return String(task.tags[index].text || "").trim();
}

function isDeepWorkTask(task) {
  const why = tagText(task, 2);
  const priority = tagText(task, 0);
  return why === "真我" || why === "合一" || priority === "重要不紧急";
}

function delayHoursForTask(task, refNow) {
  const anchor = parseLooseDateTime(task.endDate || task.reminderDate || task.createdAt || task.timeText);
  if (!anchor) return 0;
  const ref = refNow || new Date();
  const diff = ref.getTime() - anchor.getTime();
  return diff > 0 ? diff / 3600000 : 0;
}

function trendDirection(current, previous) {
  if (current == null || previous == null) return "flat";
  if (current > previous + 0.05) return "up";
  if (current < previous - 0.05) return "down";
  return "flat";
}

function fluctuationLevelFromLabels(labels) {
  const unique = new Set((labels || []).filter(Boolean));
  if (unique.size >= 3) return "high";
  if (unique.size >= 2) return "medium";
  return "low";
}

function sleepTrendDescription(labels, insomniaDays) {
  if (insomniaDays > 0) return "睡眠节奏起伏，中段有过晚睡感";
  if (fluctuationLevelFromLabels(labels) === "high") return "睡眠像在找节奏，深浅交替";
  if (fluctuationLevelFromLabels(labels) === "medium") return "睡眠大体平稳，偶有波动";
  return "睡眠整体较稳";
}

function sportTrendDescription(labels, overloadDays) {
  if (overloadDays > 0) return "运动强度有过猛的时候，也在找恢复";
  if (fluctuationLevelFromLabels(labels) === "high") return "运动节奏变化较多";
  return "运动大体平稳";
}

function signalTrendDescription(deduped) {
  const tired = deduped.filter((r) => r.signal === "累了").length;
  const pain = deduped.filter((r) => r.signal === "疼了").length;
  if (pain > 0 && tired > 0) return "紧张与不适信号较常浮现";
  if (pain > 0) return "不适信号较常浮现";
  if (tired > 0) return "疲劳信号较常浮现";
  return "身体信号大体平稳";
}

function signalClusterLabel(deduped) {
  const tired = deduped.filter((r) => r.signal === "累了").length;
  const pain = deduped.filter((r) => r.signal === "疼了").length;
  if (pain > 0 || tired > 0) return "肩颈与疲劳";
  return "整体平稳";
}

function countNegativeTrends(sleepTrend, sportTrend, signalTrend) {
  let n = 0;
  if (sleepTrend === "down") n += 1;
  if (sportTrend === "down") n += 1;
  if (signalTrend === "down") n += 1;
  return n;
}

function topPreferenceTags(tasks, limit) {
  const counts = {};
  (tasks || []).forEach((task) => {
    const why = tagText(task, 2);
    if (!why) return;
    counts[why] = (counts[why] || 0) + 1;
  });
  return Object.keys(counts)
    .sort((a, b) => counts[b] - counts[a])
    .slice(0, limit || 3);
}

function buildWeeklyTimeStats(tasks, weekMonday, refNow) {
  const ref = refNow || new Date();
  const prevMonday = new Date(weekMonday);
  prevMonday.setDate(prevMonday.getDate() - 7);
  const agg = momentScore.aggregateMomentScoreForWeek(tasks, weekMonday, ref);
  const prevAgg = momentScore.aggregateMomentScoreForWeek(tasks, prevMonday, ref);
  const createdCount = momentScore.countCreatedInWeek(tasks, weekMonday);
  const prevCreated = momentScore.countCreatedInWeek(tasks, prevMonday);
  const completionRate = createdCount > 0 ? agg.doneCount / createdCount : 0;
  const prevCompletionRate = prevCreated > 0 ? prevAgg.doneCount / prevCreated : 0;
  const completionRateWoW =
    prevCreated > 0 && createdCount > 0 ? completionRate - prevCompletionRate : null;

  const weekTasks = (tasks || []).filter((task) => {
    if (!task) return false;
    return momentScore.isCreatedInWeek(task, weekMonday) || momentScore.isCompletedInWeek(task, weekMonday);
  });
  const delayed = weekTasks.filter((task) => task.statusText === "已延期");
  const delayHours = delayed.map((task) => delayHoursForTask(task, ref)).filter((h) => h > 0);
  const avgDelayHours = delayHours.length
    ? delayHours.reduce((a, b) => a + b, 0) / delayHours.length
    : 0;

  const delayTagCounts = {};
  delayed.forEach((task) => {
    const key = tagText(task, 2) || tagText(task, 0) || "未分类";
    delayTagCounts[key] = (delayTagCounts[key] || 0) + 1;
  });
  let mostDelayedTag = "";
  let maxDelayTag = 0;
  Object.keys(delayTagCounts).forEach((key) => {
    if (delayTagCounts[key] > maxDelayTag) {
      maxDelayTag = delayTagCounts[key];
      mostDelayedTag = key;
    }
  });
  const delayTagShare = delayed.length ? maxDelayTag / delayed.length : 0;

  const deepWorkCount = weekTasks.filter((task) => isDeepWorkTask(task)).length;
  const deepWorkShare = weekTasks.length ? deepWorkCount / weekTasks.length : 0;

  const coreGoalTags = topPreferenceTags(weekTasks, 2);
  const hasTimeLogs = createdCount > 0 || agg.doneCount > 0 || agg.momentScore > 0;

  const hits = [];
  if (!hasTimeLogs) hits.push("no_time_logs");
  if (agg.momentScore >= 5) hits.push("moment_high");
  if (agg.momentScore <= 0 && hasTimeLogs) hits.push("moment_zero");
  if (delayTagShare >= 0.6 && delayed.length > 0) hits.push("delay_cluster");
  if (deepWorkShare < 0.1 && weekTasks.length >= 3) hits.push("deep_work_low");

  return {
    dataSchemaVersion: DATA_SCHEMA_VERSION,
    weekKey: momentScore.weekMondayKey(weekMonday),
    hasTimeLogs,
    momentCount: agg.momentScore,
    completionRate,
    completionRateWoW,
    avgDelayHours,
    mostDelayedTag,
    coreGoalTags,
    deepWorkShare,
    delayTagShare,
    insufficientSample: weekTasks.length < 2,
    hits,
  };
}

function buildBodyWeekStats(allRecords, weekStart, weekEnd) {
  const rep = bodyStats.buildWeekReportPayload(allRecords, weekStart, weekEnd);
  const prevStart = new Date(weekStart);
  prevStart.setDate(prevStart.getDate() - 7);
  const prevEnd = new Date(weekEnd);
  prevEnd.setDate(prevEnd.getDate() - 7);
  const prevRep = bodyStats.buildWeekReportPayload(allRecords, prevStart, prevEnd);

  const deduped = rep.deduped || [];
  const prevDeduped = prevRep.deduped || [];
  const sleepLabels = deduped.map((r) => r.sleep);
  const sportLabels = deduped.map((r) => r.sport);
  const insomniaDays = deduped.filter((r) => r.sleep === "睡不着").length;
  const overloadDays = deduped.filter((r) => r.sport === "动过头了").length;

  const sleepScore = rep.hasRecords ? rep.averageScore / 100 : 0;
  const prevSleepScore = prevRep.hasRecords ? prevRep.averageScore / 100 : sleepScore;
  const sleepTrend = trendDirection(sleepScore, prevSleepScore);
  const sportTrend = trendDirection(
    deduped.filter((r) => r.sport === "动够了" || r.sport === "动了点").length / Math.max(deduped.length, 1),
    prevDeduped.filter((r) => r.sport === "动够了" || r.sport === "动了点").length /
      Math.max(prevDeduped.length, 1),
  );
  const signalTrend = trendDirection(
    deduped.filter((r) => r.signal === "没事" || r.signal === "有劲").length / Math.max(deduped.length, 1),
    prevDeduped.filter((r) => r.signal === "没事" || r.signal === "有劲").length /
      Math.max(prevDeduped.length, 1),
  );

  const prevCluster = signalClusterLabel(prevDeduped);
  const cluster = signalClusterLabel(deduped);
  const newCategory = rep.hasRecords && prevRep.hasRecords && cluster !== prevCluster && cluster !== "整体平稳";

  const hits = [];
  const elapsed = isoWeekElapsedDaysInclusive(weekStart, new Date());
  const allowSparseHint = elapsed >= BODY_WEEK_SPARSE_MIN_ELAPSED;
  if (allowSparseHint && !rep.hasRecords) hits.push("insufficient_data");
  else if (allowSparseHint && rep.hasRecords && rep.dayCount < 3) hits.push("insufficient_data");
  const multiNegativeTrends = countNegativeTrends(sleepTrend, sportTrend, signalTrend);
  if (multiNegativeTrends >= 2) hits.push("multi_metric_fluctuation");
  if (insomniaDays >= 2 || sleepTrend === "down") hits.push("sleep_persistently_poor");
  if (cluster !== "整体平稳" || newCategory) hits.push("signal_cluster");

  return {
    dataSchemaVersion: DATA_SCHEMA_VERSION,
    weekKey: momentScore.weekMondayKey(momentScore.getIsoWeekMonday(weekStart)),
    validDayCount: rep.dayCount || 0,
    sleep: {
      trend_description: sleepTrendDescription(sleepLabels, insomniaDays),
      fluctuation_level: fluctuationLevelFromLabels(sleepLabels),
      trend_vs_prev: sleepTrend,
    },
    sport: {
      trend_description: sportTrendDescription(sportLabels, overloadDays),
      fluctuation_level: fluctuationLevelFromLabels(sportLabels),
      trend_vs_prev: sportTrend,
    },
    signal: {
      trend_description: signalTrendDescription(deduped),
      cluster,
      trend_vs_prev: signalTrend,
      newCategory,
    },
    multiNegativeTrends,
    sleepPersistentlyPoor: insomniaDays >= 2 || sleepTrend === "down",
    hits,
  };
}

function buildBodyDailyStats(allRecords, dateKey) {
  const hasCheckin = (allRecords || []).some((r) => r && r.dateKey === dateKey);
  return {
    dataSchemaVersion: DATA_SCHEMA_VERSION,
    dateKey,
    hasCheckin,
    hits: hasCheckin ? [] : ["no_checkin"],
  };
}

function buildTaskCreateStats(tasks, taskCategory, now) {
  const ref = now || new Date();
  const weekday = WEEKDAY_LABELS[ref.getDay()];
  const slot = slotFromHour(ref.getHours());
  return {
    dataSchemaVersion: DATA_SCHEMA_VERSION,
    weekday,
    slot,
    preferenceTags: topPreferenceTags(tasks, 3),
    taskCategory: taskCategory || "未分类",
    hits: [],
  };
}

module.exports = {
  DATA_SCHEMA_VERSION,
  buildWeeklyTimeStats,
  buildBodyWeekStats,
  buildBodyDailyStats,
  buildTaskCreateStats,
};
