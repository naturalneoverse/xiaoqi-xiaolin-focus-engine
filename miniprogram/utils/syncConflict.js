/**
 * 多端同步冲突：基准版本、冲突队列、用户选择（按任务 / 按哲思象限）。
 */
const STORAGE_KEYS = require("../config/storageKeys");
const { QUADRANT_IDS, isValidQuadrantId } = require("../config/reflectionRecordSchema");

const QUADRANT_TITLES = {
  1: "观实归真",
  2: "观心明己",
  3: "自我主宰",
  4: "踏实前行",
};

let _promptBusy = false;

function readJson(key, fallback) {
  try {
    const raw = wx.getStorageSync(key);
    return raw && typeof raw === "object" ? raw : fallback;
  } catch (e) {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    wx.setStorageSync(key, value);
    return true;
  } catch (e) {
    console.warn("[syncConflict] writeJson", key, e);
    return false;
  }
}

function stableHash(input) {
  try {
    return JSON.stringify(input);
  } catch (e) {
    return String(input || "");
  }
}

function readBase() {
  const b = readJson(STORAGE_KEYS.SYNC_BASE_V1, {});
  return {
    tasks: b.tasks && typeof b.tasks === "object" ? b.tasks : {},
    reflection:
      b.reflection && typeof b.reflection === "object" ? b.reflection : {},
  };
}

function writeBase(base) {
  writeJson(STORAGE_KEYS.SYNC_BASE_V1, base);
}

function readConflicts() {
  const raw = readJson(STORAGE_KEYS.SYNC_CONFLICTS_V1, { items: [] });
  return Array.isArray(raw.items) ? raw.items : [];
}

function writeConflicts(items) {
  writeJson(STORAGE_KEYS.SYNC_CONFLICTS_V1, { items: Array.isArray(items) ? items : [] });
}

function pushConflict(item) {
  const items = readConflicts();
  const id = String(item && item.id);
  if (!id) return;
  const next = items.filter((x) => x && x.id !== id);
  next.push(item);
  writeConflicts(next);
}

function removeConflict(id) {
  const cid = String(id || "");
  writeConflicts(readConflicts().filter((x) => x && x.id !== cid));
}

function hasConflicts() {
  return readConflicts().length > 0;
}

function readTombstones() {
  const raw = readJson(STORAGE_KEYS.SYNC_TASK_TOMBSTONES_V1, {});
  return raw && typeof raw === "object" ? raw : {};
}

function writeTombstones(map) {
  writeJson(STORAGE_KEYS.SYNC_TASK_TOMBSTONES_V1, map && typeof map === "object" ? map : {});
}

function isTaskTombstoned(taskId) {
  const id = String(taskId || "").trim();
  if (!id) return false;
  return Object.prototype.hasOwnProperty.call(readTombstones(), id);
}

/** 本机删除任务：阻止增量 push 复活，pull 时配合云端列表移除本地副本 */
function markTaskDeleted(taskId) {
  const id = String(taskId || "").trim();
  if (!id) return;
  const tombs = readTombstones();
  tombs[id] = Date.now();
  writeTombstones(tombs);
  const base = readBase();
  if (base.tasks[id]) {
    delete base.tasks[id];
    writeBase(base);
  }
}

function taskSnapshotHash(task) {
  if (!task) return "";
  return stableHash({
    title: task.title,
    statusText: task.statusText,
    done: task.done,
    content: task.content,
    reminderDate: task.reminderDate,
    reminderTime: task.reminderTime,
    reminderFrequency: task.reminderFrequency,
    updatedAt: task.updatedAt,
  });
}

function quadrantSnapshotHash(entry) {
  if (!entry) return "";
  return stableHash(entry.cardResponses || []);
}

function getTaskServerMs(task) {
  const s = Number(task && task.serverUpdatedAtMs);
  if (Number.isFinite(s) && s > 0) return s;
  return Number(task && task.updatedAt) || 0;
}

function getQuadrantServerMs(entry) {
  const s = Number(entry && entry.serverUpdatedAtMs);
  if (Number.isFinite(s) && s > 0) return s;
  return Number(entry && entry.completedAtMs) || 0;
}

function setTaskBase(base, taskId, task) {
  base.tasks[String(taskId)] = {
    hash: taskSnapshotHash(task),
    serverUpdatedAtMs: getTaskServerMs(task),
  };
}

function setQuadrantBase(base, taskId, quadrantId, entry) {
  const tid = String(taskId);
  const q = String(quadrantId);
  if (!base.reflection[tid]) base.reflection[tid] = {};
  base.reflection[tid][q] = {
    hash: quadrantSnapshotHash(entry),
    serverUpdatedAtMs: getQuadrantServerMs(entry),
  };
}

/**
 * @returns {{ merged: boolean, conflicts: number }}
 */
function mergeTasksFromCloud(cloudTasks, readLocal, writeLocal, cloudTaskToLocal, getEffectiveMs) {
  const list = Array.isArray(cloudTasks) ? cloudTasks : [];
  const local = readLocal();
  const byId = Object.create(null);
  local.forEach((t) => {
    if (t && t.id) byId[String(t.id)] = t;
  });
  const base = readBase();
  const tombstones = readTombstones();
  const cloudIds = new Set();
  let changed = false;
  let conflicts = 0;

  list.forEach((ct) => {
    const next = cloudTaskToLocal(ct);
    if (!next || !next.id) return;
    const id = String(next.id);
    cloudIds.add(id);
    if (tombstones[id]) return;
    const prev = byId[id];
    const baseRow = base.tasks[id];

    if (!prev) {
      byId[id] = next;
      setTaskBase(base, id, next);
      changed = true;
      return;
    }

    const localHash = taskSnapshotHash(prev);
    const cloudHash = taskSnapshotHash(next);
    const baseHash = baseRow && baseRow.hash ? baseRow.hash : "";
    const localChanged = baseHash && localHash !== baseHash;
    const cloudChanged = baseHash && cloudHash !== baseHash;
    const localServer = getTaskServerMs(prev);
    const cloudServer = getTaskServerMs(next);

    if (localChanged && cloudChanged && localHash !== cloudHash) {
      pushConflict({
        id: `task:${id}`,
        kind: "task",
        taskId: id,
        taskTitle: prev.title || next.title || "未命名任务",
        localSnapshot: prev,
        cloudSnapshot: next,
      });
      conflicts += 1;
      return;
    }

    if (cloudServer >= localServer && cloudHash !== localHash) {
      byId[id] = next;
      setTaskBase(base, id, next);
      changed = true;
      return;
    }

    setTaskBase(base, id, prev);
  });

  Object.keys(byId).forEach((id) => {
    if (cloudIds.has(id)) return;
    if (!base.tasks[id] && !tombstones[id]) return;
    delete byId[id];
    delete base.tasks[id];
    changed = true;
  });

  writeBase(base);
  const merged = Object.keys(byId).map((k) => byId[k]);
  merged.sort((a, b) => getEffectiveMs(b) - getEffectiveMs(a));
  if (changed) {
    writeLocal(merged);
  }
  return { merged: changed, conflicts };
}

/**
 * @param {object[]} cloudRecords ReflectionRecord[]
 */
function mergeReflectionFromCloud(cloudRecords, readAll, writeAll) {
  const clouds = Array.isArray(cloudRecords) ? cloudRecords : [];
  if (!clouds.length) return { merged: false, conflicts: 0 };

  const list = readAll();
  const byTask = Object.create(null);
  list.forEach((r) => {
    if (r && r.taskId) byTask[String(r.taskId)] = { ...r, quadrants: { ...(r.quadrants || {}) } };
  });
  const base = readBase();
  let changed = false;
  let conflicts = 0;

  clouds.forEach((cloudRec) => {
    if (!cloudRec || !cloudRec.taskId) return;
    const taskId = String(cloudRec.taskId);
    let localRec = byTask[taskId];
    if (!localRec) {
      localRec = {
        taskId,
        taskTitle: cloudRec.taskTitle || "未命名任务",
        quadrants: {},
        createdAt: cloudRec.createdAt || Date.now(),
        updatedAt: cloudRec.updatedAt || Date.now(),
        latestCompletedAt: cloudRec.latestCompletedAt || "",
        latestCompletedAtMs: cloudRec.latestCompletedAtMs || 0,
      };
      byTask[taskId] = localRec;
      changed = true;
    }

    QUADRANT_IDS.forEach((qid) => {
      const key = String(qid);
      const cloudEntry = cloudRec.quadrants && cloudRec.quadrants[key];
      if (!cloudEntry || !cloudEntry.completedAtMs) return;

      const localEntry = localRec.quadrants[key];
      const baseTask = base.reflection[taskId] || {};
      const baseRow = baseTask[key];

      if (!localEntry || !localEntry.completedAtMs) {
        localRec.quadrants[key] = {
          cardResponses: cloudEntry.cardResponses || [],
          completedAt: cloudEntry.completedAt || "",
          completedAtMs: cloudEntry.completedAtMs,
          serverUpdatedAtMs: cloudEntry.serverUpdatedAtMs || 0,
        };
        setQuadrantBase(base, taskId, qid, localRec.quadrants[key]);
        changed = true;
        return;
      }

      const localHash = quadrantSnapshotHash(localEntry);
      const cloudHash = quadrantSnapshotHash(cloudEntry);
      const baseHash = baseRow && baseRow.hash ? baseRow.hash : "";
      const localChanged = baseHash && localHash !== baseHash;
      const cloudChanged = baseHash && cloudHash !== baseHash;

      if (localChanged && cloudChanged && localHash !== cloudHash) {
        pushConflict({
          id: `reflection:${taskId}:${qid}`,
          kind: "reflection_quadrant",
          taskId,
          quadrantId: qid,
          taskTitle: localRec.taskTitle || cloudRec.taskTitle || "未命名任务",
          localSnapshot: {
            cardResponses: localEntry.cardResponses,
            completedAt: localEntry.completedAt,
            completedAtMs: localEntry.completedAtMs,
          },
          cloudSnapshot: {
            cardResponses: cloudEntry.cardResponses,
            completedAt: cloudEntry.completedAt,
            completedAtMs: cloudEntry.completedAtMs,
            serverUpdatedAtMs: cloudEntry.serverUpdatedAtMs || 0,
          },
        });
        conflicts += 1;
        return;
      }

      const localServer = getQuadrantServerMs(localEntry);
      const cloudServer = getQuadrantServerMs(cloudEntry);
      if (cloudServer >= localServer && cloudHash !== localHash) {
        localRec.quadrants[key] = {
          cardResponses: cloudEntry.cardResponses || [],
          completedAt: cloudEntry.completedAt || "",
          completedAtMs: cloudEntry.completedAtMs,
          serverUpdatedAtMs: cloudEntry.serverUpdatedAtMs || 0,
        };
        setQuadrantBase(base, taskId, qid, localRec.quadrants[key]);
        changed = true;
        return;
      }

      setQuadrantBase(base, taskId, qid, localEntry);
    });

    if (cloudRec.taskTitle) localRec.taskTitle = String(cloudRec.taskTitle);
    const lu = Number(localRec.updatedAt) || 0;
    const cu = Number(cloudRec.updatedAt) || 0;
    if (cu > lu) localRec.updatedAt = cu;
    byTask[taskId] = localRec;
  });

  writeBase(base);
  const merged = Object.keys(byTask)
    .map((k) => byTask[k])
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  if (clouds.length > 0) {
    writeAll(merged);
    return { merged: true, conflicts };
  }
  return { merged: changed, conflicts };
}

function applyTaskChoice(conflict, useCloud) {
  const cloudSync = require("./cloudDataSync");
  const id = conflict.taskId;
  const list = cloudSync.readTasks();
  const idx = list.findIndex((t) => t && String(t.id) === String(id));
  const chosen = useCloud
    ? cloudSync.cloudTaskToLocal(conflict.cloudSnapshot)
    : conflict.localSnapshot;
  if (!chosen) return;
  if (idx >= 0) list[idx] = chosen;
  else list.unshift(chosen);
  cloudSync.writeTasks(list);
  const base = readBase();
  setTaskBase(base, id, chosen);
  writeBase(base);
  if (!useCloud) {
    cloudSync.pushTaskToCloud(chosen).then((ok) => {
      if (ok) refreshBaseAfterTaskSave(chosen);
    });
  }
}

function applyReflectionQuadrantChoice(conflict, useCloud) {
  const reflectionManager = require("./reflectionManager");
  const taskId = conflict.taskId;
  const qid = Number(conflict.quadrantId);
  let record = reflectionManager.findByTaskId(taskId);
  if (!record) {
    record = {
      taskId,
      taskTitle: conflict.taskTitle || "",
      quadrants: {},
      updatedAt: Date.now(),
    };
  }
  const key = String(qid);
  const entry = useCloud ? conflict.cloudSnapshot : conflict.localSnapshot;
  record.quadrants = { ...(record.quadrants || {}) };
  record.quadrants[key] = {
    cardResponses: entry.cardResponses || [],
    completedAt: entry.completedAt || "",
    completedAtMs: entry.completedAtMs || Date.now(),
    serverUpdatedAtMs: entry.serverUpdatedAtMs || entry.completedAtMs || 0,
  };
  record.updatedAt = Date.now();
  const list = reflectionManager.readAll().filter((r) => r && String(r.taskId) !== String(taskId));
  list.unshift(record);
  reflectionManager.writeAll(list);
  const base = readBase();
  setQuadrantBase(base, taskId, qid, record.quadrants[key]);
  writeBase(base);
  if (!useCloud) {
    require("./reflectionCloudSync").pushQuadrantRecord(record, qid);
  }
}

function resolveConflictItem(item, useCloud) {
  if (!item) return;
  if (item.kind === "task") {
    applyTaskChoice(item, useCloud);
    return;
  }
  if (item.kind === "reflection_quadrant") {
    applyReflectionQuadrantChoice(item, useCloud);
  }
}

function buildConflictContent(item) {
  if (item.kind === "task") {
    const title = item.taskTitle || "未命名任务";
    return `任务「${title}」在本机和云端都有修改。\n\n请选择要保留的版本。`;
  }
  const qTitle = QUADRANT_TITLES[Number(item.quadrantId)] || `象限${item.quadrantId}`;
  const title = item.taskTitle || "未命名任务";
  return `「${title}」的${qTitle}在本机和云端都有修改。\n\n请选择要保留的版本。`;
}

function tryShowPendingConflicts() {
  if (_promptBusy) return Promise.resolve(false);
  const items = readConflicts();
  if (!items.length) return Promise.resolve(false);
  _promptBusy = true;

  const showOne = (index) => {
    if (index >= items.length) {
      _promptBusy = false;
      return Promise.resolve(true);
    }
    const item = items[index];
    return new Promise((resolve) => {
      wx.showModal({
        title: "同步冲突",
        content: buildConflictContent(item),
        cancelText: "保留本机",
        confirmText: "使用云端",
        confirmColor: "#12598f",
        success: (res) => {
          const useCloud = !!(res && res.confirm);
          resolveConflictItem(item, useCloud);
          removeConflict(item.id);
          resolve();
        },
        fail: () => resolve(),
      });
    }).then(() => showOne(index + 1));
  };

  return showOne(0);
}

/** 本地保存成功后刷新基准（避免误判冲突） */
function refreshBaseAfterTaskSave(task) {
  if (!task || !task.id) return;
  const base = readBase();
  setTaskBase(base, task.id, task);
  writeBase(base);
}

function refreshBaseAfterReflectionSave(taskId, quadrantId, record) {
  if (!record || !isValidQuadrantId(quadrantId)) return;
  const entry = record.quadrants && record.quadrants[String(quadrantId)];
  if (!entry) return;
  const base = readBase();
  setQuadrantBase(base, taskId, quadrantId, entry);
  writeBase(base);
}

/** 升级后首次 pull：无基准时以当前本地快照为基准，避免误报冲突 */
function seedBaseFromLocalIfEmpty() {
  const base = readBase();
  const hasTasks = Object.keys(base.tasks).length > 0;
  const hasRef = Object.keys(base.reflection).length > 0;
  if (hasTasks && hasRef) return;
  let dirty = false;
  if (!hasTasks) {
    const cloudSync = require("./cloudDataSync");
    cloudSync.readTasks().forEach((t) => {
      if (t && t.id) {
        setTaskBase(base, t.id, t);
        dirty = true;
      }
    });
  }
  if (!hasRef) {
    const reflectionManager = require("./reflectionManager");
    reflectionManager.readAll().forEach((r) => {
      if (!r || !r.taskId) return;
      Object.keys(r.quadrants || {}).forEach((qKey) => {
        const qid = Number(qKey);
        const entry = r.quadrants[qKey];
        if (!entry || !isValidQuadrantId(qid)) return;
        setQuadrantBase(base, r.taskId, qid, entry);
        dirty = true;
      });
    });
  }
  if (dirty) writeBase(base);
}

module.exports = {
  mergeTasksFromCloud,
  mergeReflectionFromCloud,
  tryShowPendingConflicts,
  hasConflicts,
  refreshBaseAfterTaskSave,
  refreshBaseAfterReflectionSave,
  seedBaseFromLocalIfEmpty,
  readConflicts,
  markTaskDeleted,
  isTaskTombstoned,
};
