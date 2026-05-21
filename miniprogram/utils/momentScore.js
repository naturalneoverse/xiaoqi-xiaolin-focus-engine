/**
 * 真我时刻加权（内部按「分」累加，1 分 = 展示 1「次」）与自然周统计，
 * 供「我的 / 时间编织图 / 周报 / 海报」共用。
 *
 * 计分：不二 +3 可叠加；为何维度 合一 +3 > 真我 +1 > 生计/职责 0（真我与合一互斥，仅看 tags[2]）。
 *
 * 「本周」真我时刻：进行中、已延期（非已取消）不论哪周创建，加上本周内标记完成（completedAt 在本周）的任务；
 * 每条任务每周只计 1 次；已取消不参与。
 *
 * 「历史周」回看：仅用该周内标记完成的任务计分（不还原当时进行中）。
 */

const TAG_PRIORITY = 0;
const TAG_FOR_WHOM = 1;
const TAG_WHY = 2;

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toDateKeyLocal(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** 自然周：周一 00:00:00 本地 */
function getIsoWeekMonday(date) {
  const dt = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = dt.getDay();
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  dt.setDate(dt.getDate() - daysFromMonday);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

/** 该周周日 23:59:59.999 本地 */
function getIsoWeekSundayEnd(monday) {
  const end = new Date(monday);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function parseLooseDateTime(str) {
  if (!str) return null;
  const s = String(str).trim().replace(/\//g, "-");
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return null;
  const y = +m[1];
  const mo = +m[2] - 1;
  const day = +m[3];
  const hh = m[4] != null ? +m[4] : 0;
  const mm = m[5] != null ? +m[5] : 0;
  return new Date(y, mo, day, hh, mm, 0, 0);
}

function getTagText(tags, index) {
  if (!Array.isArray(tags) || !tags[index]) return "";
  return String(tags[index].text || "").trim();
}

function taskDedupeKey(task) {
  if (task && task.id != null && task.id !== "") return String(task.id);
  return `k_${String(task.createdAt || task.timeText || "")}_${String(task.title || "")}`;
}

/** 单条任务的真我时刻加权值（分）；UI 展示为同等数值的「次」。 */
function computeTaskMomentScore(task) {
  const whom = getTagText(task.tags, TAG_FOR_WHOM);
  const why = getTagText(task.tags, TAG_WHY);
  let whyScore = 0;
  if (why === "合一") whyScore = 3;
  else if (why === "真我") whyScore = 1;
  else whyScore = 0;
  const buerScore = whom === "不二" ? 3 : 0;
  return whyScore + buerScore;
}

function isCompletedInWeek(task, weekMonday) {
  if (!task || task.statusText !== "已完成") return false;
  const at = parseLooseDateTime(task.completedAt);
  if (!at || Number.isNaN(at.getTime())) return false;
  const start = weekMonday.getTime();
  const end = getIsoWeekSundayEnd(weekMonday).getTime();
  const t = at.getTime();
  return t >= start && t <= end;
}

function isCreatedInWeek(task, weekMonday) {
  const at = parseLooseDateTime(task.createdAt || task.timeText);
  if (!at || Number.isNaN(at.getTime())) return false;
  const start = weekMonday.getTime();
  const end = getIsoWeekSundayEnd(weekMonday).getTime();
  const t = at.getTime();
  return t >= start && t <= end;
}

function weekMondayKey(monday) {
  return toDateKeyLocal(monday);
}

/** 解析 `YYYY-MM-DD` 周一起点；非法则返回 null */
function mondayDateFromKey(key) {
  const raw = (key || "").trim();
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const [y, m, d] = raw.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** 任意起止「日历日」：同年为「M月D日—M月D日」（两段都带月）；跨年为「Y年M月D日—Y年M月D日」 */
function formatCalendarRangeChinese(start, end) {
  const a = start instanceof Date ? start : new Date(start);
  const b = end instanceof Date ? end : new Date(end);
  const y1 = a.getFullYear();
  const y2 = b.getFullYear();
  const m1 = a.getMonth() + 1;
  const d1 = a.getDate();
  const m2 = b.getMonth() + 1;
  const d2 = b.getDate();
  if (y1 !== y2) {
    return `${y1}年${m1}月${d1}日—${y2}年${m2}月${d2}日`;
  }
  return `${m1}月${d1}日—${m2}月${d2}日`;
}

function formatWeekRangeChinese(monday) {
  const sun = new Date(monday);
  sun.setDate(sun.getDate() + 6);
  return formatCalendarRangeChinese(monday, sun);
}

function formatWeekRangeShort(monday) {
  const sun = new Date(monday);
  sun.setDate(sun.getDate() + 6);
  const y1 = monday.getFullYear();
  const y2 = sun.getFullYear();
  const m1 = monday.getMonth() + 1;
  const d1 = monday.getDate();
  const m2 = sun.getMonth() + 1;
  const d2 = sun.getDate();
  if (y1 !== y2) {
    return `${y1}.${m1}.${d1}-${y2}.${m2}.${d2}`;
  }
  return `${m1}.${d1}-${m2}.${d2}`;
}

/** 海报周期：如「5.5 — 5.11」，跨年周同理用 em dash */
function formatWeekRangePoster(monday) {
  return formatWeekRangeShort(monday).replace(/-/g, " — ");
}

/**
 * 某自然周内：「做完了」= 本周内标记完成的任务数；
 * 「真我时刻」：当前自然周含进行中/已延期 + 本周完成；历史自然周仅本周完成。
 */
function aggregateMomentScoreForWeek(tasks, weekMonday, refDate) {
  const list = Array.isArray(tasks) ? tasks : [];
  const ref = refDate || new Date();
  const refMonday = getIsoWeekMonday(ref);
  const isCurrentWeek = weekMondayKey(weekMonday) === weekMondayKey(refMonday);

  const doneCount = list.filter((t) => isCompletedInWeek(t, weekMonday)).length;

  if (!isCurrentWeek) {
    const doneTasks = list.filter((t) => t && t.statusText === "已完成" && isCompletedInWeek(t, weekMonday));
    let momentScore = 0;
    doneTasks.forEach((t) => {
      momentScore += computeTaskMomentScore(t);
    });
    return { doneCount, momentScore, distTasks: doneTasks };
  }

  const byKey = new Map();
  list.forEach((task) => {
    if (!task) return;
    if (task.statusText === "已取消") return;

    const key = taskDedupeKey(task);

    if (task.statusText === "已完成") {
      if (isCompletedInWeek(task, weekMonday)) {
        byKey.set(key, task);
      }
      return;
    }

    if (task.statusText === "进行中" || task.statusText === "已延期") {
      byKey.set(key, task);
    }
  });

  let momentScore = 0;
  const distTasks = [];
  byKey.forEach((t) => {
    momentScore += computeTaskMomentScore(t);
    distTasks.push(t);
  });

  return { doneCount, momentScore, distTasks };
}

/** 某自然周内创建的任务数（任意状态） */
function countCreatedInWeek(tasks, weekMonday) {
  const list = Array.isArray(tasks) ? tasks : [];
  let n = 0;
  list.forEach((task) => {
    if (isCreatedInWeek(task, weekMonday)) n += 1;
  });
  return n;
}

const PRIORITY_KEYS = ["重要且紧急", "重要不紧急", "紧急不重要", "不重要不紧急"];
const WHOM_KEYS = ["自己", "至亲挚友", "外缘", "不二"];

function normalizeForWhomTag(text) {
  if (text === "至亲") return "至亲挚友";
  return text;
}
const WHY_KEYS = ["生计", "职责", "真我", "合一"];

function distributionRatios(tasksInWeekDone) {
  const list = Array.isArray(tasksInWeekDone) ? tasksInWeekDone : [];
  const n = list.length;
  const pct = (count) => (n ? Math.round((count / n) * 100) : 0);

  const countKey = (keys, index) => {
    const map = {};
    keys.forEach((k) => {
      map[k] = 0;
    });
    list.forEach((task) => {
      let t = getTagText(task.tags, index);
      if (index === TAG_FOR_WHOM) t = normalizeForWhomTag(t);
      if (map[t] !== undefined) map[t] += 1;
    });
    return keys.map((k) => ({ key: k, count: map[k], percent: pct(map[k]) }));
  };

  return {
    total: n,
    priority: countKey(PRIORITY_KEYS, TAG_PRIORITY),
    whom: countKey(WHOM_KEYS, TAG_FOR_WHOM),
    why: countKey(WHY_KEYS, TAG_WHY),
  };
}

function getCompletionStreakDays(tasks, endDate) {
  const list = Array.isArray(tasks) ? tasks : [];
  const done = list.filter((t) => t && t.statusText === "已完成");
  const daySet = new Set();
  done.forEach((t) => {
    const at = parseLooseDateTime(t.completedAt);
    if (!at) return;
    daySet.add(toDateKeyLocal(at));
  });
  let streak = 0;
  const cursor = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  for (;;) {
    const k = toDateKeyLocal(cursor);
    if (daySet.has(k)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/**
 * 按「完成所在周的周一」分组已完成任务，周从新到旧排序。
 * @returns {{ weekMonday: Date, weekMondayKey: string, rangeLabel: string, rangeShort: string, doneTasks: object[], momentScore: number, doneCount: number, createdCount: number, dist: object }[]}
 */
function buildWeekSummaries(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];
  const done = list.filter((t) => t && t.statusText === "已完成");
  const byWeek = {};
  done.forEach((task) => {
    const at = parseLooseDateTime(task.completedAt);
    if (!at) return;
    const mon = getIsoWeekMonday(at);
    const key = weekMondayKey(mon);
    if (!byWeek[key]) {
      byWeek[key] = { monday: mon, tasks: [] };
    }
    byWeek[key].tasks.push(task);
  });
  const keys = Object.keys(byWeek).sort((a, b) => (a < b ? 1 : -1));
  return keys.map((key) => {
    const monday = byWeek[key].monday;
    const doneTasks = byWeek[key].tasks;
    let momentScore = 0;
    doneTasks.forEach((t) => {
      momentScore += computeTaskMomentScore(t);
    });
    const createdCount = countCreatedInWeek(list, monday);
    return {
      weekMonday: monday,
      weekMondayKey: key,
      rangeLabel: formatWeekRangeChinese(monday),
      rangeShort: formatWeekRangeShort(monday),
      doneTasks,
      momentScore,
      doneCount: doneTasks.length,
      createdCount,
      dist: distributionRatios(doneTasks),
    };
  });
}

/** 当前自然周（含无完成数据时占位） */
function getCurrentWeekSummary(tasks, now) {
  const ref = now || new Date();
  const monday = getIsoWeekMonday(ref);
  const agg = aggregateMomentScoreForWeek(tasks, monday, ref);
  const createdCount = countCreatedInWeek(tasks, monday);
  const list = Array.isArray(tasks) ? tasks : [];
  const doneThisWeek = list.filter((t) => isCompletedInWeek(t, monday));
  return {
    weekMonday: monday,
    weekMondayKey: weekMondayKey(monday),
    rangeLabel: formatWeekRangeChinese(monday),
    rangeShort: formatWeekRangeShort(monday),
    doneCount: agg.doneCount,
    momentScore: agg.momentScore,
    createdCount,
    dist: distributionRatios(agg.distTasks || []),
    doneTasks: doneThisWeek,
  };
}

module.exports = {
  TAG_PRIORITY,
  TAG_FOR_WHOM,
  TAG_WHY,
  getIsoWeekMonday,
  getIsoWeekSundayEnd,
  parseLooseDateTime,
  computeTaskMomentScore,
  isCompletedInWeek,
  isCreatedInWeek,
  weekMondayKey,
  mondayDateFromKey,
  formatWeekRangeChinese,
  formatWeekRangeShort,
  formatWeekRangePoster,
  formatCalendarRangeChinese,
  aggregateMomentScoreForWeek,
  countCreatedInWeek,
  distributionRatios,
  getCompletionStreakDays,
  buildWeekSummaries,
  getCurrentWeekSummary,
};
