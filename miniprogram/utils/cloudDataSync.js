/**
 * 本地任务 / 身体记录写成功后的云端异步同步（不阻塞、不改本地读写删语义）。
 * 全量 / 增量游标：CLOUD_FULL_SYNCED、LAST_SYNC_TASK_AT、LAST_SYNC_BODY_AT。
 */
const STORAGE_KEYS = require("../config/storageKeys");

let _startupQueued = false;
let _lastStartupWall = 0;
let _lastIncrementalRun = 0;
const INCREMENTAL_DEBOUNCE_MS = 4500;
const STARTUP_DEBOUNCE_MS = 2800;

function isCloudAvailable() {
  const app = getApp();
  return !!(
    wx.cloud &&
    typeof wx.cloud.callFunction === "function" &&
    app &&
    app.globalData &&
    app.globalData.cloudInitOk === true
  );
}

/** 内存 hasLoggedIn 可能与存储不一致（如仅写了 storage），以「任一为真」为准 */
function isLoggedIn() {
  try {
    if (wx.getStorageSync(STORAGE_KEYS.HAS_LOGGED_IN)) return true;
  } catch (e) {
    /* ignore */
  }
  const app = getApp();
  if (app && app.globalData && typeof app.globalData.hasLoggedIn === "boolean") {
    return !!app.globalData.hasLoggedIn;
  }
  return false;
}

function checkOnline() {
  return new Promise((resolve) => {
    wx.getNetworkType({
      success(res) {
        const t = (res && res.networkType) || "";
        resolve(t !== "none" && t !== "offline");
      },
      fail() {
        resolve(true);
      },
    });
  });
}

function readTasks() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEYS.TASKS_DATA);
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    return [];
  }
}

function readBodies() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEYS.BODY_RECORDS);
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    return [];
  }
}

function parseCreatedToMs(taskOrRecord) {
  const s = String((taskOrRecord && (taskOrRecord.createdAt || taskOrRecord.timeText)) || "")
    .trim()
    .replace(/\//g, "-");
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return 0;
  const t = new Date(+m[1], +m[2] - 1, +m[3], m[4] != null ? +m[4] : 0, m[5] != null ? +m[5] : 0, 0, 0);
  const ms = t.getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/** 用于与 lastSync* 严格大于比较：优先 updatedAt，否则回退 createdAt 解析 */
function getTaskEffectiveMs(task) {
  if (task && Number.isFinite(Number(task.updatedAt)) && Number(task.updatedAt) > 0) {
    return Number(task.updatedAt);
  }
  return parseCreatedToMs(task) || 0;
}

function getBodyEffectiveMs(record) {
  if (record && Number.isFinite(Number(record.updatedAt)) && Number(record.updatedAt) > 0) {
    return Number(record.updatedAt);
  }
  return parseCreatedToMs(record) || 0;
}

function ensureTaskForCloud(task) {
  const u = Number(task.updatedAt);
  if (Number.isFinite(u) && u > 0) return { ...task, updatedAt: u };
  const fallback = parseCreatedToMs(task) || Date.now();
  return { ...task, updatedAt: fallback };
}

function ensureBodyForCloud(record) {
  const u = Number(record.updatedAt);
  if (Number.isFinite(u) && u > 0) return { ...record, updatedAt: u };
  const fallback = parseCreatedToMs(record) || Date.now();
  return { ...record, updatedAt: fallback };
}

function logCloudFail(op, res, err) {
  const r = res && res.result;
  const msg = (r && r.errMsg) || (res && res.errMsg) || (err && (err.errMsg || err.message)) || "";
  console.warn(`[cloudDataSync] ${op} 失败`, msg || err || res);
}

async function pushTaskToCloud(task) {
  /* 不因 cloudInitOk / 登录态拦截；仅保留 API 存在性 */
  if (!wx.cloud || typeof wx.cloud.callFunction !== "function") {
    console.warn("[cloudDataSync] saveTask 跳过：wx.cloud 不可用");
    return false;
  }
  const payload = ensureTaskForCloud(task);
  try {
    const res = await wx.cloud.callFunction({
      name: "quickstartFunctions",
      data: { type: "saveTask", taskDoc: payload },
    });
    let raw = res && res.result;
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch (e) {
        /* ignore */
      }
    }
    const ok = !!(raw && (raw.success === true || raw.success === "true"));
    if (!ok) {
      logCloudFail("saveTask", res, null);
      try {
        console.warn("[cloudDataSync] saveTask 返回体", JSON.stringify(raw != null ? raw : res).slice(0, 800));
      } catch (e2) {
        console.warn("[cloudDataSync] saveTask 返回体(无法序列化)", raw, res);
      }
    }
    return ok;
  } catch (e) {
    logCloudFail("saveTask", null, e);
    return false;
  }
}

async function pushBodyToCloud(record) {
  /* 不因 cloudInitOk / 登录态拦截；仅保留 API 存在性 */
  if (!wx.cloud || typeof wx.cloud.callFunction !== "function") {
    console.warn("[cloudDataSync] saveBodyRecord 跳过：wx.cloud 不可用");
    return false;
  }
  const payload = ensureBodyForCloud(record);
  try {
    const res = await wx.cloud.callFunction({
      name: "quickstartFunctions",
      data: { type: "saveBodyRecord", record: payload },
    });
    let raw = res && res.result;
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch (_) {}
    }
    const ok = !!(raw && (raw.success === true || raw.success === "true"));
    if (!ok) {
      try {
        const s = JSON.stringify(raw);
        console.warn(
          "[cloudDataSync] saveBodyRecord 返回体",
          s && s.length > 800 ? s.slice(0, 800) + "…" : s
        );
      } catch (_) {}
      logCloudFail("saveBodyRecord", res, null);
    }
    return ok;
  } catch (e) {
    logCloudFail("saveBodyRecord", null, e);
    return false;
  }
}

async function afterTaskSaved(task) {
  if (!task) return;
  await pushTaskToCloud(task);
}

async function afterBodySaved(record) {
  if (!record) return;
  await pushBodyToCloud(record);
}

function readFullSynced() {
  try {
    return !!wx.getStorageSync(STORAGE_KEYS.CLOUD_FULL_SYNCED);
  } catch (e) {
    return false;
  }
}

function writeFullSynced(v) {
  try {
    wx.setStorageSync(STORAGE_KEYS.CLOUD_FULL_SYNCED, !!v);
  } catch (e) {
    /* ignore */
  }
}

function readLastTaskAt() {
  try {
    const n = Number(wx.getStorageSync(STORAGE_KEYS.LAST_SYNC_TASK_AT));
    return Number.isFinite(n) ? n : 0;
  } catch (e) {
    return 0;
  }
}

function readLastBodyAt() {
  try {
    const n = Number(wx.getStorageSync(STORAGE_KEYS.LAST_SYNC_BODY_AT));
    return Number.isFinite(n) ? n : 0;
  } catch (e) {
    return 0;
  }
}

function writeLastTaskAt(ms) {
  try {
    wx.setStorageSync(STORAGE_KEYS.LAST_SYNC_TASK_AT, ms);
  } catch (e) {
    /* ignore */
  }
}

function writeLastBodyAt(ms) {
  try {
    wx.setStorageSync(STORAGE_KEYS.LAST_SYNC_BODY_AT, ms);
  } catch (e) {
    /* ignore */
  }
}

async function runFullSyncIfNeeded() {
  if (readFullSynced()) return;
  if (!isCloudAvailable() || !isLoggedIn()) return;
  if (!(await checkOnline())) return;

  const tasks = readTasks();
  const bodies = readBodies();

  if (!tasks.length && !bodies.length) {
    writeFullSynced(true);
    writeLastTaskAt(0);
    writeLastBodyAt(0);
    return;
  }

  let maxTask = 0;
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (!t || !t.id) continue;
    const ok = await pushTaskToCloud(t);
    if (!ok) return;
    maxTask = Math.max(maxTask, ensureTaskForCloud(t).updatedAt);
  }

  let maxBody = 0;
  for (let j = 0; j < bodies.length; j++) {
    const b = bodies[j];
    if (!b || !b.dateKey) continue;
    const ok = await pushBodyToCloud(b);
    if (!ok) return;
    maxBody = Math.max(maxBody, ensureBodyForCloud(b).updatedAt);
  }

  writeFullSynced(true);
  writeLastTaskAt(maxTask);
  writeLastBodyAt(maxBody);
}

async function runIncrementalSync() {
  if (!readFullSynced()) return;
  if (!isCloudAvailable() || !isLoggedIn()) return;
  if (!(await checkOnline())) return;

  const lastT = readLastTaskAt();
  const lastB = readLastBodyAt();
  const tasks = readTasks();
  const bodies = readBodies();

  let maxTask = lastT;
  let maxBody = lastB;

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (!t || !t.id) continue;
    const eff = getTaskEffectiveMs(t);
    if (eff > lastT) {
      const ok = await pushTaskToCloud(t);
      if (!ok) return;
      maxTask = Math.max(maxTask, eff);
    }
  }

  for (let j = 0; j < bodies.length; j++) {
    const b = bodies[j];
    if (!b || !b.dateKey) continue;
    const eff = getBodyEffectiveMs(b);
    if (eff > lastB) {
      const ok = await pushBodyToCloud(b);
      if (!ok) return;
      maxBody = Math.max(maxBody, eff);
    }
  }

  writeLastTaskAt(maxTask);
  writeLastBodyAt(maxBody);
}

function runStartupSync() {
  const wall = Date.now();
  if (wall - _lastStartupWall < STARTUP_DEBOUNCE_MS) return;
  _lastStartupWall = wall;
  if (_startupQueued) return;
  _startupQueued = true;
  setTimeout(() => {
    _startupQueued = false;
    Promise.resolve()
      .then(() => runFullSyncIfNeeded())
      .then(() => runIncrementalSync())
      .then(() => {
        const archiveCloud = require("./bodyWeekArchiveCloud");
        return archiveCloud.pullAndMergeFromCloud();
      })
      .catch((e) => console.warn("[cloudDataSync] runStartupSync", e));
  }, 400);
}

function runIncrementalDebounced() {
  const now = Date.now();
  if (now - _lastIncrementalRun < INCREMENTAL_DEBOUNCE_MS) return;
  _lastIncrementalRun = now;
  runIncrementalSync().catch((e) => console.warn("[cloudDataSync] runIncrementalSync", e));
}

module.exports = {
  afterTaskSaved,
  afterBodySaved,
  runStartupSync,
  runIncrementalSync,
  runIncrementalDebounced,
  getTaskEffectiveMs,
  getBodyEffectiveMs,
};
