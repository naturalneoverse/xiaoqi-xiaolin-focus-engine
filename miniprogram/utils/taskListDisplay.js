const { mapTagClassByText } = require("./taskTagStyles");

const PRIORITY_RANK = Object.freeze({
  重要且紧急: 1,
  重要不紧急: 2,
  紧急不重要: 3,
  不重要不紧急: 4,
});

const WHY_SUMMARY_ORDER = ["真我", "合一", "职责", "生计"];

const INCOMPLETE_PREVIEW_LIMIT = 3;
const PAST_DATE_PREVIEW_LIMIT = 5;

function getPriorityRank(task) {
  const tags = Array.isArray(task && task.tags) ? task.tags : [];
  for (let i = 0; i < tags.length; i++) {
    const text = tags[i] && tags[i].text;
    if (Object.prototype.hasOwnProperty.call(PRIORITY_RANK, text)) {
      return PRIORITY_RANK[text];
    }
  }
  return 99;
}

function sortIncompleteTasks(list, getSortMs) {
  const getMs = typeof getSortMs === "function" ? getSortMs : () => 0;
  return list.slice().sort((a, b) => {
    const timeDiff = getMs(b) - getMs(a);
    if (timeDiff !== 0) return timeDiff;
    const ra = getPriorityRank(a);
    const rb = getPriorityRank(b);
    if (ra !== rb) return ra - rb;
    return String(a.id || "").localeCompare(String(b.id || ""));
  });
}

function getCompletedSortMs(task, getSortMs) {
  const raw = String((task && task.completedAt) || "").replace(/\//g, "-");
  const parsed = Date.parse(raw.length >= 10 ? raw.slice(0, 10) : raw);
  if (Number.isFinite(parsed)) return parsed;
  return typeof getSortMs === "function" ? getSortMs(task) : 0;
}

function sortCompletedTasksNewestFirst(list, getSortMs) {
  return list.slice().sort(
    (a, b) => getCompletedSortMs(b, getSortMs) - getCompletedSortMs(a, getSortMs)
  );
}

function mapTaskTag(tag) {
  const text = (tag && tag.text) || "";
  if (!text) return null;
  return {
    text,
    className: mapTagClassByText(text, tag.className),
    isPriority: /优先/.test(text),
  };
}

function getPastTaskRowTags(task) {
  const tags = Array.isArray(task && task.tags) ? task.tags : [];
  const out = [];
  const circle = tags[1] && mapTaskTag(tags[1]);
  const why = tags[2] && mapTaskTag(tags[2]);
  if (circle) out.push(circle);
  if (why) out.push(why);
  return out;
}

/** 往期任务卡：轻重缓急 + 为谁 + 为何，三标签全展示 */
function getPastTaskAllTags(task) {
  const tags = Array.isArray(task && task.tags) ? task.tags : [];
  return tags
    .slice(0, 3)
    .map(mapTaskTag)
    .filter(Boolean);
}

function summarizeWhyLabels(tasks) {
  const counts = {};
  (tasks || []).forEach((task) => {
    const tags = Array.isArray(task.tags) ? task.tags : [];
    const why = tags[2] && tags[2].text;
    if (!why) return;
    counts[why] = (counts[why] || 0) + 1;
  });
  return WHY_SUMMARY_ORDER.filter((key) => counts[key]).map((key) => `${key}${counts[key]}`);
}

function buildPendingDisplay(allPending, expanded) {
  const total = allPending.length;
  const hiddenCount = Math.max(0, total - INCOMPLETE_PREVIEW_LIMIT);
  const visible = expanded || hiddenCount === 0
    ? allPending
    : allPending.slice(0, INCOMPLETE_PREVIEW_LIMIT);
  return {
    visible,
    hiddenCount,
    showExpand: hiddenCount > 0 && !expanded,
    showCollapse: hiddenCount > 0 && expanded,
  };
}

function buildPastDateDisplay(allGroups, datesExpanded) {
  const total = allGroups.length;
  const hiddenCount = Math.max(0, total - PAST_DATE_PREVIEW_LIMIT);
  const visible = datesExpanded || hiddenCount === 0
    ? allGroups
    : allGroups.slice(0, PAST_DATE_PREVIEW_LIMIT);
  return {
    visible,
    hiddenCount,
    showExpand: hiddenCount > 0 && !datesExpanded,
    showCollapse: hiddenCount > 0 && datesExpanded,
  };
}

function buildDoneTodayDisplay(allDone, expanded) {
  const total = allDone.length;
  if (total === 0) {
    return { visible: [], hiddenCount: 0, showExpand: false, showCollapse: false };
  }
  if (expanded) {
    return {
      visible: allDone,
      hiddenCount: Math.max(0, total - 1),
      showExpand: false,
      showCollapse: total > 1,
    };
  }
  return {
    visible: allDone.slice(0, 1),
    hiddenCount: Math.max(0, total - 1),
    showExpand: total > 1,
    showCollapse: false,
  };
}

module.exports = {
  PRIORITY_RANK,
  INCOMPLETE_PREVIEW_LIMIT,
  PAST_DATE_PREVIEW_LIMIT,
  getPriorityRank,
  sortIncompleteTasks,
  getCompletedSortMs,
  sortCompletedTasksNewestFirst,
  getPastTaskRowTags,
  getPastTaskAllTags,
  summarizeWhyLabels,
  buildPendingDisplay,
  buildPastDateDisplay,
  buildDoneTodayDisplay,
};
