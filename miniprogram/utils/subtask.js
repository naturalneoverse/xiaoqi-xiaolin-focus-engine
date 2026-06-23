/**
 * 子任务：两层结构、父任务 subtaskProgress、本地 + 云 saveTask。
 */

const STORAGE_KEYS = require("../config/storageKeys");
const dailyCheckIn = require("./dailyCheckIn");
const { newLocalTaskId } = require("./taskCreatePersist");
const { formatDateTime } = require("./dateFormat");

const MAX_SUBTASKS = 20;
const PARENT_BLOCKED_FOR_ADD = new Set(["已完成", "已取消"]);

function readTasks() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEYS.TASKS_DATA);
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    console.error("[subtask] readTasks", e);
    return [];
  }
}

function writeTasks(tasks) {
  try {
    wx.setStorageSync(STORAGE_KEYS.TASKS_DATA, tasks);
    dailyCheckIn.recordDailyCheckIn();
    return true;
  } catch (e) {
    console.error("[subtask] writeTasks", e);
    return false;
  }
}

function cloudSaveTasks(list) {
  if (!Array.isArray(list) || !list.length) return;
  try {
    const cloudDataSync = require("./cloudDataSync");
    list.forEach((task) => {
      if (task && task.id && typeof cloudDataSync.afterTaskSaved === "function") {
        cloudDataSync.afterTaskSaved(task);
      }
    });
  } catch (e) {
    console.warn("[subtask] cloudSaveTasks", e);
  }
}

function cloudDeleteTask(taskId) {
  try {
    const cloudDataSync = require("./cloudDataSync");
    if (typeof cloudDataSync.deleteTaskFromCloud === "function") {
      cloudDataSync.deleteTaskFromCloud(taskId);
    }
    if (typeof cloudDataSync.markTaskDeleted === "function") {
      cloudDataSync.markTaskDeleted(taskId);
    }
  } catch (e) {
    console.warn("[subtask] cloudDeleteTask", e);
  }
}

function getParentTaskId(task) {
  if (!task) return "";
  const raw = task.parentTaskId;
  if (raw == null) return "";
  return String(raw).trim();
}

function isSubtask(task) {
  return getParentTaskId(task) !== "";
}

function isTopLevelTask(task) {
  return !!task && !isSubtask(task);
}

function cloneTags(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.map((tag) => {
    if (!tag || typeof tag !== "object") return tag;
    return {
      text: tag.text != null ? String(tag.text) : "",
      className: tag.className != null ? String(tag.className) : "",
    };
  });
}

function computeProgress(subtasks) {
  const list = Array.isArray(subtasks) ? subtasks : [];
  const total = list.length;
  const done = list.filter((t) => t && t.statusText === "已完成").length;
  return { total, done };
}

function getSubtasksForParent(tasks, parentId) {
  const pid = String(parentId || "").trim();
  if (!pid) return [];
  return (tasks || []).filter((t) => t && String(getParentTaskId(t)) === pid);
}

function findTaskById(tasks, taskId) {
  const id = String(taskId || "").trim();
  if (!id) return null;
  return (tasks || []).find((t) => t && String(t.id) === id) || null;
}

function upsertTaskInList(tasks, task) {
  if (!task || !task.id) return tasks || [];
  const id = String(task.id);
  const rest = (tasks || []).filter((t) => t && String(t.id) !== id);
  return [{ ...task, updatedAt: Number(task.updatedAt) > 0 ? Number(task.updatedAt) : Date.now() }, ...rest];
}

function recountParentProgress(tasks, parentId) {
  const pid = String(parentId || "").trim();
  if (!pid) return tasks || [];
  const subtasks = getSubtasksForParent(tasks, pid);
  const progress = computeProgress(subtasks);
  return (tasks || []).map((t) => {
    if (!t || String(t.id) !== pid) return t;
    return {
      ...t,
      subtaskProgress: progress,
      updatedAt: Date.now(),
    };
  });
}

function formatSubtaskDateLabel(task) {
  if (!task) return "";
  const start = String(task.startDate || "").trim();
  const end = String(task.endDate || "").trim();
  const dv = String(task.dateValue || "").trim();
  if (start && end && start !== end) return `${start.slice(5)}–${end.slice(5)}`;
  if (start) return start.length >= 10 ? start.slice(5) : start;
  if (dv && dv !== "未设置") return dv.length >= 10 ? dv.slice(5) : dv;
  return "";
}

function toCompletedAt() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function canAddSubtaskToParent(parent, tasks) {
  if (!parent || !parent.id) {
    return { ok: false, message: "任务不存在" };
  }
  if (isSubtask(parent)) {
    return { ok: false, message: "子任务不能再添加子任务" };
  }
  if (PARENT_BLOCKED_FOR_ADD.has(parent.statusText)) {
    return { ok: false, message: "任务已结束，无法添加子任务" };
  }
  const subs = getSubtasksForParent(tasks || readTasks(), parent.id);
  if (subs.length >= MAX_SUBTASKS) {
    return { ok: false, message: "每个任务最多支持 20 个子任务", reason: "limit" };
  }
  return { ok: true };
}

/**
 * @param {string} parentId
 * @param {{ title: string, content?: string, startDate?: string, endDate?: string, dateValue?: string }} fields
 */
function createSubtask(parentId, fields) {
  const pid = String(parentId || "").trim();
  const tasks = readTasks();
  const parent = findTaskById(tasks, pid);
  const gate = canAddSubtaskToParent(parent, tasks);
  if (!gate.ok) {
    return { ok: false, message: gate.message, reason: gate.reason };
  }

  const title = String((fields && fields.title) || "").trim();
  if (!title) {
    return { ok: false, message: "请输入子任务名称" };
  }

  const now = new Date();
  const createdAt = formatDateTime(now);
  const subtask = {
    id: newLocalTaskId(),
    parentTaskId: pid,
    title,
    content: String((fields && fields.content) || "").trim() || "暂无描述",
    timeText: createdAt,
    createdAt,
    updatedAt: Date.now(),
    dateValue: fields.dateValue || "",
    startDate: fields.startDate || "",
    endDate: fields.endDate || "",
    statusText: "进行中",
    done: false,
    completedAt: "",
    reminderDate: "",
    reminderTime: "",
    reminderFrequency: "不重复",
    tags: cloneTags(parent.tags),
  };

  let next = upsertTaskInList(tasks, subtask);
  next = recountParentProgress(next, pid);
  const savedParent = findTaskById(next, pid);
  if (!writeTasks(next)) {
    return { ok: false, message: "保存失败" };
  }
  cloudSaveTasks([subtask, savedParent].filter(Boolean));
  return { ok: true, subtask, parent: savedParent, tasks: next };
}

function toggleSubtaskDone(subtaskId) {
  const id = String(subtaskId || "").trim();
  let tasks = readTasks();
  const sub = findTaskById(tasks, id);
  if (!sub || !isSubtask(sub)) {
    return { ok: false, message: "子任务不存在" };
  }
  const pid = getParentTaskId(sub);
  const nextDone = sub.statusText !== "已完成";
  const patch = {
    ...sub,
    statusText: nextDone ? "已完成" : "进行中",
    done: nextDone,
    completedAt: nextDone ? toCompletedAt() : "",
    updatedAt: Date.now(),
  };
  let next = upsertTaskInList(tasks, patch);
  next = recountParentProgress(next, pid);
  const savedParent = findTaskById(next, pid);
  if (!writeTasks(next)) {
    return { ok: false, message: "保存失败" };
  }
  cloudSaveTasks([patch, savedParent].filter(Boolean));
  return { ok: true, subtask: patch, parent: savedParent };
}

function deleteSubtask(subtaskId) {
  const id = String(subtaskId || "").trim();
  let tasks = readTasks();
  const sub = findTaskById(tasks, id);
  if (!sub || !isSubtask(sub)) {
    return { ok: false, message: "子任务不存在" };
  }
  const pid = getParentTaskId(sub);
  let next = tasks.filter((t) => t && String(t.id) !== id);
  next = recountParentProgress(next, pid);
  const savedParent = findTaskById(next, pid);
  if (!writeTasks(next)) {
    return { ok: false, message: "删除失败" };
  }
  cloudDeleteTask(id);
  if (savedParent) cloudSaveTasks([savedParent]);
  return { ok: true, parent: savedParent };
}

function buildSubtaskListView(parentId, tasks) {
  const list = getSubtasksForParent(tasks || readTasks(), parentId);
  return list
    .slice()
    .sort((a, b) => {
      const ta = Number(a.updatedAt) || 0;
      const tb = Number(b.updatedAt) || 0;
      return tb - ta;
    })
    .map((t) => ({
      id: t.id,
      title: t.title || "未命名",
      done: t.statusText === "已完成",
      dateLabel: formatSubtaskDateLabel(t),
    }));
}

function getSubtaskProgressView(parent) {
  const p = (parent && parent.subtaskProgress) || {};
  const total = Number(p.total) || 0;
  const done = Number(p.done) || 0;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return { total, done, percent };
}

/** 父任务 tags 变更时静默同步全部子任务 */
function syncParentTagsToSubtasks(parentId) {
  const pid = String(parentId || "").trim();
  let tasks = readTasks();
  const parent = findTaskById(tasks, pid);
  if (!parent || isSubtask(parent)) return { ok: false };
  const tags = cloneTags(parent.tags);
  const subs = getSubtasksForParent(tasks, pid);
  if (!subs.length) return { ok: true, updated: [] };
  const updated = [];
  subs.forEach((sub) => {
    const next = { ...sub, tags, updatedAt: Date.now() };
    tasks = upsertTaskInList(tasks, next);
    updated.push(next);
  });
  if (!writeTasks(tasks)) return { ok: false };
  cloudSaveTasks(updated);
  return { ok: true, updated };
}

function readTreeExpandedMap() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEYS.SUBTASK_TREE_EXPANDED);
    return raw && typeof raw === "object" ? raw : {};
  } catch (e) {
    return {};
  }
}

function writeTreeExpandedMap(map) {
  try {
    wx.setStorageSync(STORAGE_KEYS.SUBTASK_TREE_EXPANDED, map || {});
    return true;
  } catch (e) {
    return false;
  }
}

function toggleTreeExpanded(parentId) {
  const pid = String(parentId || "").trim();
  if (!pid) return false;
  const map = readTreeExpandedMap();
  map[pid] = !map[pid];
  writeTreeExpandedMap(map);
  return !!map[pid];
}

function formatListTitle(title) {
  const text = (title || "").trim();
  const chars = Array.from(text);
  if (chars.length <= 10) return text || "未命名";
  return `${chars.slice(0, 10).join("")}...`;
}

function sortSubtasksForTree(list) {
  return (list || []).slice().sort((a, b) => {
    const da = a.statusText === "已完成" ? 1 : 0;
    const db = b.statusText === "已完成" ? 1 : 0;
    if (da !== db) return da - db;
    const ta = Number(a.updatedAt) || 0;
    const tb = Number(b.updatedAt) || 0;
    return tb - ta;
  });
}

/**
 * 时间首页树形行：父任务 + 展开后的子任务（└ 缩进）
 * @param {object[]} topLevelTasks 已过滤的顶层任务
 * @param {object[]} allTasks 全量任务
 * @param {Record<string, boolean>} expandedMap
 */
function buildSleepTreeRows(topLevelTasks, allTasks, expandedMap) {
  const rows = [];
  (topLevelTasks || []).forEach((parent) => {
    if (!parent || !parent.id) return;
    const subs = sortSubtasksForTree(getSubtasksForParent(allTasks, parent.id));
    const progress = computeProgress(subs);
    const expanded = !!expandedMap[parent.id];
    rows.push({
      rowKey: `p-${parent.id}`,
      rowType: "parent",
      id: parent.id,
      parentId: "",
      title: parent.title,
      displayTitle: parent.displayTitle || formatListTitle(parent.title),
      timeText: parent.timeText,
      tags: parent.tags || [],
      typeClass: parent.typeClass || "task-type-default",
      done: parent.done,
      hasSubtasks: subs.length > 0,
      subtaskTotal: progress.total,
      subtaskDone: progress.done,
      expanded,
      treePrefix: "",
    });
    if (subs.length && expanded) {
      subs.forEach((sub, idx) => {
        rows.push({
          rowKey: `s-${sub.id}`,
          rowType: "subtask",
          id: sub.id,
          parentId: parent.id,
          title: sub.title || "未命名",
          displayTitle: formatListTitle(sub.title),
          done: sub.statusText === "已完成",
          dateLabel: formatSubtaskDateLabel(sub),
          treePrefix: "└",
          isLast: idx === subs.length - 1,
        });
      });
    }
  });
  return rows;
}

function deleteParentTaskCascade(parentId) {
  const pid = String(parentId || "").trim();
  let tasks = readTasks();
  const parent = findTaskById(tasks, pid);
  if (!parent || isSubtask(parent)) {
    return { ok: false, message: "任务不存在" };
  }
  const subIds = getSubtasksForParent(tasks, pid).map((t) => String(t.id));
  const deleteIds = new Set([pid, ...subIds]);
  tasks = tasks.filter((t) => t && !deleteIds.has(String(t.id)));
  if (!writeTasks(tasks)) {
    return { ok: false, message: "删除失败" };
  }
  cloudDeleteTask(pid);
  subIds.forEach((id) => cloudDeleteTask(id));
  const map = readTreeExpandedMap();
  if (map[pid]) {
    delete map[pid];
    writeTreeExpandedMap(map);
  }
  return { ok: true, deletedSubtaskCount: subIds.length };
}

function detachSubtaskAsIndependent(subtaskId) {
  const id = String(subtaskId || "").trim();
  let tasks = readTasks();
  const sub = findTaskById(tasks, id);
  if (!sub || !isSubtask(sub)) {
    return { ok: false, message: "子任务不存在" };
  }
  const pid = getParentTaskId(sub);
  const { parentTaskId, ...rest } = sub;
  const detached = {
    ...rest,
    updatedAt: Date.now(),
  };
  let next = tasks.map((t) => (t && String(t.id) === id ? detached : t));
  next = recountParentProgress(next, pid);
  const savedParent = findTaskById(next, pid);
  if (!writeTasks(next)) {
    return { ok: false, message: "操作失败" };
  }
  cloudSaveTasks([detached, savedParent].filter(Boolean));
  return { ok: true, task: detached, parent: savedParent };
}

function isAllSubtasksDone(parent, tasksOpt) {
  if (!parent || isSubtask(parent)) return false;
  const subs = getSubtasksForParent(tasksOpt || readTasks(), parent.id);
  if (!subs.length) return false;
  return subs.every((t) => t && t.statusText === "已完成");
}

function shouldShowSubtaskAllDoneHint(parent, tasksOpt) {
  if (!parent || isSubtask(parent)) return false;
  if (parent.statusText === "已完成" || parent.statusText === "已取消") return false;
  return isAllSubtasksDone(parent, tasksOpt);
}

/**
 * 云 pull / merge 后：剔除悬空子任务、重算父 subtaskProgress（PRD 4.4）
 * @param {object[]} tasks
 * @returns {{ tasks: object[], changed: boolean }}
 */
function reconcileSubtasksAfterMerge(tasks) {
  const input = Array.isArray(tasks) ? tasks.slice() : [];
  let byId = Object.create(null);
  input.forEach((t) => {
    if (t && t.id) byId[String(t.id)] = t;
  });

  let list = input.filter((t) => {
    if (!t || !t.id) return false;
    const pid = getParentTaskId(t);
    if (!pid) return true;
    const parent = byId[pid];
    return !!(parent && !isSubtask(parent));
  });

  list = list.map((t) => {
    if (!t || !isSubtask(t)) return t;
    const { subtaskProgress, ...rest } = t;
    return rest;
  });

  byId = Object.create(null);
  list.forEach((t) => {
    if (t && t.id) byId[String(t.id)] = t;
  });

  const parentIds = new Set();
  list.forEach((t) => {
    if (t && isSubtask(t)) parentIds.add(getParentTaskId(t));
  });
  list.forEach((t) => {
    if (t && !isSubtask(t) && getSubtasksForParent(list, t.id).length > 0) {
      parentIds.add(String(t.id));
    }
  });

  parentIds.forEach((pid) => {
    if (pid) list = recountParentProgress(list, pid);
  });

  list = list.map((t) => {
    if (!t || isSubtask(t)) return t;
    if (getSubtasksForParent(list, t.id).length > 0) return t;
    if (!t.subtaskProgress) return t;
    const { subtaskProgress, ...rest } = t;
    return rest;
  });

  const changed = JSON.stringify(list) !== JSON.stringify(input);
  return { tasks: list, changed };
}

module.exports = {
  MAX_SUBTASKS,
  readTasks,
  writeTasks,
  isSubtask,
  isTopLevelTask,
  getParentTaskId,
  cloneTags,
  getSubtasksForParent,
  findTaskById,
  canAddSubtaskToParent,
  createSubtask,
  toggleSubtaskDone,
  deleteSubtask,
  buildSubtaskListView,
  getSubtaskProgressView,
  computeProgress,
  syncParentTagsToSubtasks,
  formatSubtaskDateLabel,
  recountParentProgress,
  readTreeExpandedMap,
  writeTreeExpandedMap,
  toggleTreeExpanded,
  buildSleepTreeRows,
  deleteParentTaskCascade,
  detachSubtaskAsIndependent,
  isAllSubtasksDone,
  shouldShowSubtaskAllDoneHint,
  reconcileSubtasksAfterMerge,
};
