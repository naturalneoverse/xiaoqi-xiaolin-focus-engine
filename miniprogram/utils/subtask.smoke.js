/**
 * node miniprogram/utils/subtask.smoke.js
 */
const path = require("path");

require.cache[path.resolve(__dirname, "dailyCheckIn.js")] = {
  exports: { recordDailyCheckIn: () => {} },
};
require.cache[path.resolve(__dirname, "cloudDataSync.js")] = {
  exports: {
    afterTaskSaved: () => {},
    deleteTaskFromCloud: () => {},
    markTaskDeleted: () => {},
  },
};

const STORAGE_KEYS = require("../config/storageKeys");
const subtask = require("./subtask");

const parentId = "p1";
let tasks = [
  {
    id: parentId,
    title: "父",
    statusText: "进行中",
    tags: [{ text: "真我" }, { text: "自己" }, { text: "合一" }],
    subtaskProgress: { total: 0, done: 0 },
  },
];

let treeExpanded = {};

global.wx = {
  getStorageSync: (key) => {
    if (key === STORAGE_KEYS.TASKS_DATA) return tasks;
    if (key === STORAGE_KEYS.SUBTASK_TREE_EXPANDED) return treeExpanded;
    return null;
  },
  setStorageSync: (key, v) => {
    if (key === STORAGE_KEYS.TASKS_DATA) tasks = v;
    if (key === STORAGE_KEYS.SUBTASK_TREE_EXPANDED) treeExpanded = v;
  },
};

const created = subtask.createSubtask(parentId, { title: "步骤1" });
if (!created.ok) throw new Error("create failed: " + (created.message || ""));
if (!created.subtask.parentTaskId) throw new Error("parentTaskId");
if (created.subtask.tags.length !== 3) throw new Error("tags copy");

const toggled = subtask.toggleSubtaskDone(created.subtask.id);
if (!toggled.ok) throw new Error("toggle: " + (toggled.message || ""));
if (toggled.subtask.statusText !== "已完成") throw new Error("toggle status");
if (toggled.parent.subtaskProgress.done !== 1) throw new Error("progress done");

tasks = subtask.readTasks();
tasks = tasks.map((t) =>
  t.id === parentId
    ? {
        ...t,
        tags: [{ text: "重要且紧急" }, { text: "不二" }, { text: "真我" }],
      }
    : t,
);
subtask.writeTasks(tasks);
const synced = subtask.syncParentTagsToSubtasks(parentId);
if (!synced.ok) throw new Error("sync tags");
if (synced.updated.length !== 1) throw new Error("sync count");
if (synced.updated[0].tags[0].text !== "重要且紧急") throw new Error("sync tag text");

subtask.toggleTreeExpanded(parentId);
const rows = subtask.buildSleepTreeRows(
  [tasks.find((t) => t.id === parentId)],
  tasks,
  subtask.readTreeExpandedMap(),
);
if (rows.length < 2) throw new Error("tree rows");
if (rows[1].rowType !== "subtask" || rows[1].treePrefix !== "└") throw new Error("tree prefix");

const detached = subtask.detachSubtaskAsIndependent(created.subtask.id);
if (!detached.ok) throw new Error("detach");
if (subtask.isSubtask(detached.task)) throw new Error("still subtask");
if (detached.parent.subtaskProgress.total !== 0) throw new Error("detach progress");

const created2 = subtask.createSubtask(parentId, { title: "步骤2" });
if (!created2.ok) throw new Error("create2");

const cascade = subtask.deleteParentTaskCascade(parentId);
if (!cascade.ok) throw new Error("cascade delete");
if (cascade.deletedSubtaskCount !== 1) throw new Error("cascade count");
if (subtask.findTaskById(subtask.readTasks(), parentId)) throw new Error("parent remains");
if (subtask.findTaskById(subtask.readTasks(), created2.subtask.id)) throw new Error("sub remains");
if (!subtask.findTaskById(subtask.readTasks(), detached.task.id)) throw new Error("detached gone");

const orphanTasks = [
  { id: "p-orphan", title: "父", statusText: "进行中", subtaskProgress: { total: 1, done: 0 } },
  { id: "s-orphan", title: "悬", parentTaskId: "p-gone", statusText: "进行中" },
  { id: "p-stale", title: "父2", statusText: "进行中", subtaskProgress: { total: 9, done: 9 } },
  { id: "s1", title: "步", parentTaskId: "p-stale", statusText: "已完成" },
];
const rec = subtask.reconcileSubtasksAfterMerge(orphanTasks);
if (!rec.changed) throw new Error("reconcile changed");
if (rec.tasks.some((t) => t.id === "s-orphan")) throw new Error("orphan remain");
const staleParent = rec.tasks.find((t) => t.id === "p-stale");
if (!staleParent || staleParent.subtaskProgress.total !== 1 || staleParent.subtaskProgress.done !== 1) {
  throw new Error("reconcile progress");
}

const parentDone = { id: "p-done", title: "父", statusText: "进行中", subtaskProgress: { total: 1, done: 1 } };
const subDone = { id: "s-done", title: "步", parentTaskId: "p-done", statusText: "已完成" };
if (!subtask.isAllSubtasksDone(parentDone, [parentDone, subDone])) throw new Error("all done");
if (!subtask.shouldShowSubtaskAllDoneHint(parentDone, [parentDone, subDone])) throw new Error("hint show");
if (subtask.shouldShowSubtaskAllDoneHint({ ...parentDone, statusText: "已完成" }, [parentDone, subDone])) {
  throw new Error("hint hidden when parent done");
}

console.log("[subtask smoke] OK");
