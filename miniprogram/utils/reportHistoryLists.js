/**
 * 「我的」→ 时间/身体 往期列表：只含已过去自然周、有数据、倒序（不含本周）
 */

const momentScore = require("./momentScore");
const bodyStats = require("./bodyStats");

function presenceTierName(doneCount, createdCount) {
  if (!createdCount || createdCount <= 0) return "暂无";
  const rate = (doneCount / createdCount) * 100;
  if (rate >= 80) return "沉浸";
  if (rate >= 60) return "专注";
  if (rate >= 30) return "铺展";
  return "酝酿";
}

/**
 * @param {object[]} tasks
 * @returns {{ weekMondayKey: string, title: string, subtitle: string }[]}
 */
function buildPastWeeklyReportRows(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];
  const curKey = momentScore.weekMondayKey(momentScore.getIsoWeekMonday(new Date()));
  const summaries = momentScore.buildWeekSummaries(list);
  return summaries
    .filter((s) => s && s.weekMondayKey && s.weekMondayKey !== curKey && s.doneCount > 0)
    .map((s) => {
      const createdCount = momentScore.countCreatedInWeek(list, s.weekMonday);
      const presence = presenceTierName(s.doneCount, createdCount);
      return {
        weekMondayKey: s.weekMondayKey,
        title: s.rangeLabel,
        subtitle: `真我时刻 ${s.momentScore}次 · 完成 ${s.doneCount}件 · 当下质地 ${presence}`,
      };
    });
}

function weekMondayKeyFromBodyDateKey(dateKey) {
  const d = bodyStats.parseDateKeyToDate(dateKey);
  if (!d) return "";
  const mon = momentScore.getIsoWeekMonday(d);
  return momentScore.weekMondayKey(mon);
}

/**
 * @param {object[]} allRecords body_records
 * @returns {{ weekMondayKey: string, title: string, subtitle: string }[]}
 */
function buildPastBodyReportRows(allRecords) {
  const records = Array.isArray(allRecords) ? allRecords : [];
  const curKey = momentScore.weekMondayKey(momentScore.getIsoWeekMonday(new Date()));
  const keyToMonday = new Map();

  records.forEach((r) => {
    if (!r || !r.dateKey) return;
    const key = weekMondayKeyFromBodyDateKey(r.dateKey);
    if (!key || key === curKey) return;
    if (!keyToMonday.has(key)) {
      const mon = momentScore.mondayDateFromKey(key);
      if (mon) keyToMonday.set(key, mon);
    }
  });

  const keys = Array.from(keyToMonday.keys()).sort((a, b) => (a < b ? 1 : -1));

  return keys
    .map((key) => {
      const monday = keyToMonday.get(key);
      const end = new Date(monday);
      end.setDate(monday.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      const rep = bodyStats.buildWeekReportPayload(records, monday, end);
      if (!rep || !rep.hasRecords) return null;
      return {
        weekMondayKey: key,
        title: momentScore.formatWeekRangeChinese(monday),
        subtitle: `记录 ${rep.dayCount} 天 · ${rep.finalStatusTitle || "本周状态"}`,
      };
    })
    .filter(Boolean);
}

module.exports = {
  buildPastWeeklyReportRows,
  buildPastBodyReportRows,
};
