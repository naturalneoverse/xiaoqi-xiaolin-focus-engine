/**
 * 新建真我向任务保存前守护：活跃清单 ≥ 8 且会增加真我时刻时弹窗提醒。
 */

const STORAGE_KEYS = require("../config/storageKeys");
const momentScore = require("./momentScore");
const subtaskUtil = require("./subtask");

const ACTIVE_THRESHOLD = 8;
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

function isActiveTask(task) {
  if (!task) return false;
  if (subtaskUtil.isSubtask(task)) return false;
  if (task.statusText === "已取消") return false;
  return task.statusText === "进行中" || task.statusText === "已延期";
}

function isMomentOrientedTask(task) {
  return momentScore.computeTaskMomentScore(task) > 0;
}

function excludeDraft(task, excludeTaskId) {
  if (!excludeTaskId) return true;
  if (!task || task.id == null) return true;
  return String(task.id) !== String(excludeTaskId);
}

function countActiveTasks(tasks, excludeTaskId) {
  const list = Array.isArray(tasks) ? tasks : [];
  return list.filter((t) => isActiveTask(t) && excludeDraft(t, excludeTaskId)).length;
}

function countMomentOrientedActive(tasks, excludeTaskId) {
  const list = Array.isArray(tasks) ? tasks : [];
  return list.filter(
    (t) => isActiveTask(t) && excludeDraft(t, excludeTaskId) && isMomentOrientedTask(t),
  ).length;
}

function loadTasksFromStorage() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEYS.TASKS_DATA);
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    console.error("[momentGuardian] getStorageSync", e);
    return [];
  }
}

function getLastPromptAtMs() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEYS.TASK_GUARDIAN_PROMPT_LAST_AT);
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch (e) {
    return 0;
  }
}

function isWithinCooldown() {
  const lastAt = getLastPromptAtMs();
  if (!lastAt) return false;
  return Date.now() - lastAt < COOLDOWN_MS;
}

function markPromptShown() {
  try {
    wx.setStorageSync(STORAGE_KEYS.TASK_GUARDIAN_PROMPT_LAST_AT, Date.now());
  } catch (e) {
    console.error("[momentGuardian] setStorageSync", e);
  }
}

function buildGuardianMessage(x) {
  return `您已有 ${x} 件对自己重要的事在推进。心装得满，路会显得挤。先把手边的安顿好，再迎接新的——小麒一直在这里，等您准备好。`;
}

/**
 * @param {{ id?: string, tags?: object[] }} previewTask 待保存草稿（仅 tags/id 用于判断）
 * @param {string} [excludeTaskId] 排除本次草稿 id
 * @param {object[]} [tasks] 可选任务列表，默认读本地存储
 * @returns {{ shouldShow: boolean, x?: number, message?: string }}
 */
function evaluateForNewTask(previewTask, excludeTaskId, tasks) {
  if (!previewTask || !isMomentOrientedTask(previewTask)) {
    return { shouldShow: false };
  }
  if (isWithinCooldown()) {
    return { shouldShow: false };
  }
  const list = tasks != null ? tasks : loadTasksFromStorage();
  const activeCount = countActiveTasks(list, excludeTaskId);
  if (activeCount < ACTIVE_THRESHOLD) {
    return { shouldShow: false };
  }
  const x = countMomentOrientedActive(list, excludeTaskId);
  return {
    shouldShow: true,
    x,
    message: buildGuardianMessage(x),
  };
}

module.exports = {
  ACTIVE_THRESHOLD,
  COOLDOWN_MS,
  countActiveTasks,
  countMomentOrientedActive,
  evaluateForNewTask,
  markPromptShown,
  isWithinCooldown,
  buildGuardianMessage,
};
