/**
 * 哲思复盘列表 · 方案 D 时间分组（本周 / 上周 / 本月 / 按月 + 进行中）
 */

const reflectionManager = require("./reflectionManager");
const momentScore = require("./momentScore");
const { getQuadrantMeta } = require("../config/reflectionTheme");

const SECTION_IN_PROGRESS = "in_progress";
const SECTION_THIS_WEEK = "this_week";
const SECTION_LAST_WEEK = "last_week";
const SECTION_THIS_MONTH = "this_month";

const RELATIVE_SECTION_ORDER = [
  SECTION_IN_PROGRESS,
  SECTION_THIS_WEEK,
  SECTION_LAST_WEEK,
  SECTION_THIS_MONTH,
];

const RELATIVE_TITLES = {
  [SECTION_IN_PROGRESS]: "进行中",
  [SECTION_THIS_WEEK]: "本周",
  [SECTION_LAST_WEEK]: "上周",
  [SECTION_THIS_MONTH]: "本月",
};

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** @param {object} record */
function recordSortMs(record) {
  const latest = Number(record && record.latestCompletedAtMs);
  if (Number.isFinite(latest) && latest > 0) return latest;
  const updated = Number(record && record.updatedAt);
  if (Number.isFinite(updated) && updated > 0) return updated;
  const created = Number(record && record.createdAt);
  return Number.isFinite(created) ? created : 0;
}

function recordProgressMs(record) {
  const updated = Number(record && record.updatedAt);
  if (Number.isFinite(updated) && updated > 0) return updated;
  return recordSortMs(record);
}

/**
 * @param {number} ms
 * @param {string} sectionKey
 * @param {Date} refDate
 */
function formatListCardTime(ms, sectionKey, refDate) {
  if (!ms) return "";
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const ref = refDate instanceof Date ? refDate : new Date();
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  const timePart = `${hh}:${mm}`;
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const y = d.getFullYear();

  if (sectionKey === SECTION_THIS_WEEK || sectionKey === SECTION_LAST_WEEK) {
    return `${m}月${day}日 ${timePart}`;
  }
  if (sectionKey === SECTION_THIS_MONTH) {
    return `${m}月${day}日 ${timePart}`;
  }
  if (sectionKey === SECTION_IN_PROGRESS) {
    if (y === ref.getFullYear()) return `${m}月${day}日 ${timePart}`;
    return `${y}年${m}月${day}日 ${timePart}`;
  }
  if (y === ref.getFullYear() && d.getMonth() === ref.getMonth()) {
    return `${day}日 ${timePart}`;
  }
  if (y === ref.getFullYear()) {
    return `${m}月${day}日 ${timePart}`;
  }
  return `${y}年${m}月${day}日 ${timePart}`;
}

/**
 * @param {number} sortMs
 * @param {Date} refDate
 * @returns {{ sectionKey: string, monthSortKey: string }}
 */
function classifyArchiveBucket(sortMs, refDate) {
  const d = new Date(sortMs);
  const ref = refDate instanceof Date ? refDate : new Date();
  const curMon = momentScore.getIsoWeekMonday(ref);
  const prevMon = new Date(curMon);
  prevMon.setDate(prevMon.getDate() - 7);

  const t = d.getTime();
  const weekStart = curMon.getTime();
  const weekEnd = momentScore.getIsoWeekSundayEnd(curMon).getTime();
  const prevStart = prevMon.getTime();
  const prevEnd = momentScore.getIsoWeekSundayEnd(prevMon).getTime();

  if (t >= weekStart && t <= weekEnd) {
    return { sectionKey: SECTION_THIS_WEEK, monthSortKey: "" };
  }
  if (t >= prevStart && t <= prevEnd) {
    return { sectionKey: SECTION_LAST_WEEK, monthSortKey: "" };
  }
  if (d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth()) {
    return { sectionKey: SECTION_THIS_MONTH, monthSortKey: "" };
  }

  const monthSortKey = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
  return { sectionKey: monthSortKey, monthSortKey };
}

function monthSectionTitle(monthSortKey) {
  const parts = String(monthSortKey || "").split("-");
  if (parts.length !== 2) return monthSortKey;
  const y = Number(parts[0]);
  const m = Number(parts[1]);
  if (!y || !m) return monthSortKey;
  return `${y}年${m}月`;
}

/**
 * @param {object} record
 * @returns {object|null}
 */
function mapRecordToListItem(record) {
  if (!record) return null;
  const completedIds = reflectionManager.getCompletedQuadrantIds(record);
  if (!completedIds.length) return null;

  const allDone = reflectionManager.isAllQuadrantsComplete(record);
  const sortMs = recordSortMs(record);
  const progressMs = recordProgressMs(record);

  return {
    taskId: record.taskId,
    taskTitle: record.taskTitle || "未命名任务",
    reportTime: record.latestCompletedAt || "",
    sortMs,
    progressMs,
    allDone,
    progressLabel: allDone ? "" : `已完成 ${completedIds.length}/4 象限`,
    tags: completedIds.map((id) => {
      const meta = getQuadrantMeta(id);
      return {
        id,
        title: meta ? meta.title : `象限${id}`,
        accent: meta ? meta.accent : "#184061",
      };
    }),
  };
}

/**
 * @param {Date} [refDate]
 * @returns {{ sections: { sectionKey: string, title: string, items: object[] }[], empty: boolean }}
 */
function buildGroupedReflectionList(refDate) {
  const ref = refDate instanceof Date ? refDate : new Date();
  const raw = reflectionManager.listRecordsSorted();
  const inProgress = [];
  const bucketMap = {};

  raw.forEach((record) => {
    const item = mapRecordToListItem(record);
    if (!item) return;

    if (!item.allDone) {
      inProgress.push({
        ...item,
        cardTime: formatListCardTime(item.progressMs, SECTION_IN_PROGRESS, ref),
      });
      return;
    }

    const { sectionKey, monthSortKey } = classifyArchiveBucket(item.sortMs, ref);
    const title =
      RELATIVE_TITLES[sectionKey] || monthSectionTitle(monthSortKey || sectionKey);
    if (!bucketMap[sectionKey]) {
      bucketMap[sectionKey] = { sectionKey, title, monthSortKey: monthSortKey || sectionKey, items: [] };
    }
    bucketMap[sectionKey].items.push({
      ...item,
      cardTime: formatListCardTime(item.sortMs, sectionKey, ref),
    });
  });

  inProgress.sort((a, b) => (b.progressMs || 0) - (a.progressMs || 0));

  Object.keys(bucketMap).forEach((key) => {
    bucketMap[key].items.sort((a, b) => (b.sortMs || 0) - (a.sortMs || 0));
  });

  const sections = [];

  if (inProgress.length) {
    sections.push({
      sectionKey: SECTION_IN_PROGRESS,
      title: RELATIVE_TITLES[SECTION_IN_PROGRESS],
      items: inProgress,
    });
  }

  RELATIVE_SECTION_ORDER.forEach((key) => {
    if (key === SECTION_IN_PROGRESS) return;
    const block = bucketMap[key];
    if (block && block.items.length) sections.push(block);
  });

  const monthKeys = Object.keys(bucketMap)
    .filter((k) => !RELATIVE_TITLES[k])
    .sort((a, b) => (a < b ? 1 : -1));

  monthKeys.forEach((key) => {
    const block = bucketMap[key];
    if (block && block.items.length) sections.push(block);
  });

  const totalItems = sections.reduce((n, sec) => n + sec.items.length, 0);

  return {
    sections,
    empty: totalItems === 0,
  };
}

module.exports = {
  SECTION_IN_PROGRESS,
  SECTION_THIS_WEEK,
  SECTION_LAST_WEEK,
  SECTION_THIS_MONTH,
  recordSortMs,
  classifyArchiveBucket,
  formatListCardTime,
  buildGroupedReflectionList,
};
