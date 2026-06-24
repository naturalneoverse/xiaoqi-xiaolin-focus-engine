/**
 * 任务创建流程：本地落库 + reLaunch 任务详情（draft 幂等、清空问卷栈）
 */

const taskStorage = require("./taskStorage");
const { goSleepHome } = require("./goTabHome");
const reminderRegistry = require("./reminderRegistry");

function newLocalTaskId() {
  const r = Math.floor(Math.random() * 1e9)
    .toString(36)
    .padStart(6, "0");
  return `t_${Date.now()}_${r}`;
}

function resolveTaskId(draftTaskId) {
  const draft = String(draftTaskId || "").trim();
  return draft || newLocalTaskId();
}

/**
 * @param {object} task 完整任务对象（含 id）
 * @returns {{ ok: boolean }}
 */
function writeTaskToStorage(task, draftTaskId) {
  const taskId = task && task.id;
  if (!taskId) return { ok: false };
  const draft = String(draftTaskId || "").trim();
  if (draft && draft !== taskId) {
    reminderRegistry.migrateRecord(draft, taskId);
  }
  let prevTasks = [];
  try {
    prevTasks = taskStorage.readTasks();
  } catch (e) {
    console.error("[taskCreatePersist] readTasks", e);
    return { ok: false };
  }
  const nextTasks = [
    {
      ...task,
      updatedAt: Number(task.updatedAt) > 0 ? Number(task.updatedAt) : Date.now(),
    },
    ...prevTasks.filter((t) => t && t.id !== taskId),
  ];
  if (!taskStorage.writeTasks(nextTasks)) {
    return { ok: false };
  }
  try {
    const subtaskUtil = require("./subtask");
    if (subtaskUtil.isTopLevelTask(task)) {
      subtaskUtil.syncParentTagsToSubtasks(task.id);
    }
  } catch (e) {
    /* ignore */
  }
  return { ok: true };
}

/**
 * @param {object} task
 * @param {{ logTag?: string }} [opts]
 */
function reLaunchTaskDetailSuccess(task, opts) {
  const tag = (opts && opts.logTag) || "taskCreatePersist";
  const taskId = task && task.id;
  const redirectUrl = `/pages/task-detail/index?taskId=${encodeURIComponent(taskId)}&showSuccess=1`;
  const doRedirect = () => {
    wx.reLaunch({
      url: redirectUrl,
      fail: (err) => {
        console.error(`[${tag}] reLaunch task-detail`, err);
        wx.showToast({ title: "打开详情失败，任务已保存", icon: "none" });
        setTimeout(() => goSleepHome(), 800);
      },
    });
  };
  try {
    const cloudDataSync = require("./cloudDataSync");
    Promise.resolve(cloudDataSync.afterTaskSaved(task))
      .catch(() => {})
      .finally(doRedirect);
  } catch (e) {
    console.warn(`[${tag}] cloudDataSync`, e);
    doRedirect();
  }
}

/**
 * @param {object} task
 * @param {{ logTag?: string, onFail?: () => void }} [opts]
 * @returns {boolean} 是否已开始跳转
 */
function persistTaskAndOpenDetail(task, opts) {
  const written = writeTaskToStorage(task, opts && opts.draftTaskId);
  if (!written.ok) {
    if (opts && opts.onFail) opts.onFail();
    else wx.showToast({ title: "保存失败", icon: "none" });
    return false;
  }
  reLaunchTaskDetailSuccess(task, { logTag: opts && opts.logTag });
  return true;
}

module.exports = {
  newLocalTaskId,
  resolveTaskId,
  writeTaskToStorage,
  persistTaskAndOpenDetail,
};
