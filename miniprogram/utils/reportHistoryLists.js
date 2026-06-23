/**
 * 「我的」→ 时间/身体 往期列表：只含已过去自然周、有数据、倒序（不含本周）
 */

const momentScore = require("./momentScore");
const bodyStats = require("./bodyStats");

function presenceTierName(doneCount, createdCount, activeMomentCount) {
  return momentScore.presenceTierName(doneCount, createdCount, activeMomentCount);
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
      const presence = presenceTierName(s.doneCount, createdCount, 0);
      return {
        weekMondayKey: s.weekMondayKey,
        title: s.rangeLabel,
        subtitle: `真我时刻 ${s.momentScore}次 · 完成 ${s.doneCount}件 · 当下质地 ${presence}`,
      };
    });
}

/**
 * @deprecated 已由 momentTrailView.buildMomentTrailView 替代（真我时刻轨迹页）
 * 「我的」→ 真我时刻历史：本周置顶 + 有数据的往周（倒序）。
 * @param {object[]} tasks
 * @returns {{ weekMondayKey: string, title: string, subtitle: string }[]}
 */
function buildMomentWeekHistoryRows(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];
  const refNow = new Date();
  const curKey = momentScore.weekMondayKey(momentScore.getIsoWeekMonday(refNow));
  const cur = momentScore.getCurrentWeekSummary(list, refNow);
  const rows = [
    {
      weekMondayKey: curKey,
      title: `${cur.rangeLabel}（本周）`,
      subtitle: `真我时刻 ${momentScore.formatMomentScoreWithUnit(cur.momentScore)}`,
    },
  ];

  momentScore.buildWeekSummaries(list).forEach((s) => {
    if (!s || !s.weekMondayKey || s.weekMondayKey === curKey) return;
    if (s.momentScore <= 0 && s.doneCount <= 0) return;
    rows.push({
      weekMondayKey: s.weekMondayKey,
      title: s.rangeLabel,
      subtitle: `真我时刻 ${momentScore.formatMomentScoreWithUnit(s.momentScore)}`,
    });
  });

  return rows;
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
  buildMomentWeekHistoryRows,
  buildPastBodyReportRows,
};
