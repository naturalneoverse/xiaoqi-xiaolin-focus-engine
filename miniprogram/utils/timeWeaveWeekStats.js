/**
 * 时间编织报告统一统计：流动清单 / 条形图占比 / 小麟 copyKey
 * 质地基数与真我时刻同源（momentScore.buildFlowingTaskListForWeek）。
 */

const momentScore = require("./momentScore");
const { COPY_KEYS } = require("../config/timeWeaveMascotCopy");

const PRIORITY_IE = new Set(["紧急不重要", "不重要不紧急"]);
const PRIORITY_DEEP = "重要不紧急";
const PRIORITY_IE_ACTIVE = "重要且紧急";

const WHOM_BOND = new Set(["至亲挚友", "不二"]);
const WHOM_SELF = "自己";
const WHOM_OUTER = "外缘";

const WHY_UNITY = new Set(["真我", "合一"]);
const WHY_DUTY = "职责";
const WHY_LIVELIHOOD = "生计";

const THRESHOLD = 0.3;

function getTag(task, index) {
  if (!task || !Array.isArray(task.tags) || !task.tags[index]) return "";
  let t = String(task.tags[index].text || "").trim();
  if (index === momentScore.TAG_FOR_WHOM && t === "至亲") return "至亲挚友";
  return t;
}

function isCancelled(task) {
  return task && task.statusText === "已取消";
}

function buildTotalTaskList(tasks, weekMonday, refNow) {
  return momentScore.buildFlowingTaskListForWeek(tasks, weekMonday, refNow || new Date());
}

function isSecularArchive(task) {
  return getTag(task, momentScore.TAG_WHY) === WHY_LIVELIHOOD && getTag(task, momentScore.TAG_FOR_WHOM) === WHOM_OUTER;
}

function isActivePlanning(task) {
  const why = getTag(task, momentScore.TAG_WHY);
  const whom = getTag(task, momentScore.TAG_FOR_WHOM);
  return WHY_UNITY.has(why) || whom === WHOM_SELF || whom === "不二";
}

function countDistribution(tasks, keys, tagIndex) {
  const map = {};
  keys.forEach((k) => {
    map[k] = 0;
  });
  tasks.forEach((task) => {
    let t = getTag(task, tagIndex);
    if (tagIndex === momentScore.TAG_FOR_WHOM && t === "至亲") t = "至亲挚友";
    if (map[t] !== undefined) map[t] += 1;
  });
  const total = tasks.length;
  const pct = (n) => (total ? Math.round((n / total) * 100) : 0);
  return keys.map((k) => ({ key: k, count: map[k], percent: pct(map[k]) }));
}

function countDimensionNumerators(totalTasks) {
  let unity = 0;
  let deepNotUrgent = 0;
  let deepActiveIe = 0;
  let bond = 0;
  let duty = 0;
  let ieLow = 0;
  let ieRelax = 0;

  totalTasks.forEach((task) => {
    const priority = getTag(task, momentScore.TAG_PRIORITY);
    const whom = getTag(task, momentScore.TAG_FOR_WHOM);
    const why = getTag(task, momentScore.TAG_WHY);

    if (PRIORITY_IE.has(priority)) {
      if (priority === "紧急不重要") ieLow += 1;
      else ieRelax += 1;
      return;
    }
    if (isSecularArchive(task)) return;

    if (why === WHY_DUTY) {
      duty += 1;
      return;
    }

    if (whom === "至亲挚友") {
      bond += 1;
      return;
    }

    if (WHY_UNITY.has(why)) unity += 1;
    if (whom === "不二") bond += 1;

    if (priority === PRIORITY_DEEP) deepNotUrgent += 1;
    if (priority === PRIORITY_IE_ACTIVE && isActivePlanning(task)) deepActiveIe += 1;
  });

  const deep = deepNotUrgent + deepActiveIe;

  return {
    unity,
    deep,
    deepNotUrgent,
    deepActiveIe,
    bond,
    duty,
    ieLow,
    ieRelax,
  };
}

function pct(n, total) {
  return total > 0 ? n / total : 0;
}

function resolveCopyKey(total, nums) {
  const unityP = pct(nums.unity, total);
  const deepP = pct(nums.deep, total);
  const bondP = pct(nums.bond, total);
  const dutyP = pct(nums.duty, total);

  if (unityP >= THRESHOLD) return COPY_KEYS.ONE_SELF;
  if (deepP >= THRESHOLD) {
    return nums.deepNotUrgent >= nums.deepActiveIe ? COPY_KEYS.DEPTH_SLOW : COPY_KEYS.DEPTH_FAST;
  }
  if (bondP >= THRESHOLD) return COPY_KEYS.CONNECTION;
  if (dutyP >= THRESHOLD) return COPY_KEYS.ROLE_DUTY;
  if (nums.ieLow >= nums.ieRelax) return COPY_KEYS.CALM_BUSY;
  return COPY_KEYS.CALM_EASY;
}

/** 稳定 1–6，同周同 key 文案不变 */
function pickLineIndex(weekKey, copyKey) {
  const s = `${weekKey || ""}|${copyKey || ""}`;
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return (h % 6) + 1;
}

/**
 * @param {object[]} tasks
 * @param {Date} weekMonday
 * @param {Date} [refNow]
 */
function buildTimeWeaveWeekStats(tasks, weekMonday, refNow) {
  const ref = refNow || new Date();
  const list = Array.isArray(tasks) ? tasks : [];
  const totalTasks = buildTotalTaskList(list, weekMonday, ref);
  const total = totalTasks.length;
  const flowingCount = total;
  const createdInWeekCount = list.filter(
    (t) => t && !isCancelled(t) && momentScore.isCreatedInWeek(t, weekMonday)
  ).length;

  const nums = countDimensionNumerators(totalTasks);
  const copyKey = total > 0 ? resolveCopyKey(total, nums) : COPY_KEYS.CALM_EASY;
  const weekKey = momentScore.weekMondayKey(weekMonday);
  const lineIndex = pickLineIndex(weekKey, copyKey);

  const priorityKeys = ["重要且紧急", "重要不紧急", "紧急不重要", "不重要不紧急"];
  const whomKeys = ["自己", "至亲挚友", "外缘", "不二"];
  const whyKeys = ["生计", "职责", "真我", "合一"];

  return {
    dataSchemaVersion: "time-weave-2",
    weekKey,
    flowingCount,
    createdInWeekCount,
    totalCount: total,
    totalTasks,
    copyKey,
    lineIndex,
    dimensionCounts: nums,
    dimensionPct: {
      unity: Math.round(pct(nums.unity, total) * 100),
      deep: Math.round(pct(nums.deep, total) * 100),
      bond: Math.round(pct(nums.bond, total) * 100),
      duty: Math.round(pct(nums.duty, total) * 100),
    },
    distPriority: countDistribution(totalTasks, priorityKeys, momentScore.TAG_PRIORITY),
    distWhom: countDistribution(totalTasks, whomKeys, momentScore.TAG_FOR_WHOM),
    distWhy: countDistribution(totalTasks, whyKeys, momentScore.TAG_WHY),
  };
}

module.exports = {
  THRESHOLD,
  buildTimeWeaveWeekStats,
  pickLineIndex,
  buildTotalTaskList,
  resolveCopyKey,
};
