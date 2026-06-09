/**

 * 哲思象限作答：pull / push / purge（云函数 Step2 API）

 */

const reflectionManager = require("./reflectionManager");

const { isValidQuadrantId, QUADRANT_IDS } = require("../config/reflectionRecordSchema");

const { aggregateQuadrantDocsToRecords } = require("./reflectionQuadrantAggregate");



function parseCloudResult(res) {

  let raw = res && res.result;

  if (typeof raw === "string") {

    try {

      raw = JSON.parse(raw);

    } catch (e) {

      /* ignore */

    }

  }

  return raw && typeof raw === "object" ? raw : null;

}



async function callQuickstart(type, data) {

  if (!wx.cloud || typeof wx.cloud.callFunction !== "function") return null;

  try {

    const res = await wx.cloud.callFunction({

      name: "quickstartFunctions",

      data: Object.assign({ type }, data || {}),

    });

    return parseCloudResult(res);

  } catch (e) {

    console.warn("[reflectionCloudSync]", type, e);

    return null;

  }

}



async function ensureCloudCallable() {

  try {

    const cloudDataSync = require("./cloudDataSync");

    if (cloudDataSync && typeof cloudDataSync.ensureCloudCallable === "function") {

      return cloudDataSync.ensureCloudCallable();

    }

  } catch (e) {

    /* ignore */

  }

  return !!(wx.cloud && typeof wx.cloud.callFunction === "function");

}



function isLoggedIn() {

  try {

    const STORAGE_KEYS = require("../config/storageKeys");

    if (wx.getStorageSync(STORAGE_KEYS.HAS_LOGGED_IN)) return true;

  } catch (e) {

    /* ignore */

  }

  const app = getApp();

  return !!(app && app.globalData && app.globalData.hasLoggedIn);

}



/** 修复旧数据缺 completedAtMs，避免 push / 列表判定失败 */

function repairLocalReflectionForSync() {

  const list = reflectionManager.readAll();

  let dirty = false;

  const next = list.map((record) => {

    if (!record || !record.taskId) return record;

    const quadrants = { ...(record.quadrants || {}) };

    QUADRANT_IDS.forEach((qid) => {

      const key = String(qid);

      const entry = quadrants[key];

      if (!entry) return;

      const hasContent =

        (Array.isArray(entry.cardResponses) && entry.cardResponses.length > 0) ||

        (entry.completedAt && String(entry.completedAt).trim());

      if (!hasContent) return;

      if (!entry.completedAtMs || entry.completedAtMs <= 0) {

        quadrants[key] = {

          ...entry,

          completedAtMs: Number(record.updatedAt) || Date.now(),

        };

        dirty = true;

      }

    });

    return dirty ? { ...record, quadrants } : record;

  });

  if (dirty) {

    reflectionManager.writeAll(next);

  }

  return dirty;

}



/**

 * @param {object} record ReflectionRecord

 * @param {number} quadrantId

 */

async function pushQuadrantRecord(record, quadrantId) {

  if (!record || !isValidQuadrantId(quadrantId)) return false;

  const key = String(quadrantId);

  const entry = record.quadrants && record.quadrants[key];

  if (!entry || !entry.completedAtMs) return false;

  const raw = await callQuickstart("saveReflectionQuadrant", {

    taskId: record.taskId,

    quadrantId: Number(quadrantId),

    taskTitle: record.taskTitle || "未命名任务",

    cardResponses: entry.cardResponses || [],

    completedAt: entry.completedAt || "",

    completedAtMs: entry.completedAtMs,

    recordCreatedAt: record.createdAt,

    recordUpdatedAt: record.updatedAt,

    latestCompletedAt: record.latestCompletedAt,

    latestCompletedAtMs: record.latestCompletedAtMs,

  });

  return !!(raw && raw.success);

}



function schedulePushQuadrant(taskId, record, quadrantId) {

  if (!isLoggedIn()) return;

  if (!wx.cloud || typeof wx.cloud.callFunction !== "function") return;

  pushQuadrantRecord(record, quadrantId)

    .then((ok) => {

      if (!ok) return;

      try {

        require("./syncConflict").refreshBaseAfterReflectionSave(taskId, quadrantId, record);

      } catch (e) {

        /* ignore */

      }

    })

    .catch(() => {});

}



async function pushAllLocalQuadrantsToCloud() {

  const stats = { pushed: 0, failed: 0, skipped: 0 };

  if (!isLoggedIn()) return stats;

  if (!(await ensureCloudCallable())) return stats;

  repairLocalReflectionForSync();

  const records = reflectionManager.readAll();

  for (let i = 0; i < records.length; i++) {

    const record = records[i];

    if (!record || !record.taskId) continue;

    for (let q = 0; q < QUADRANT_IDS.length; q++) {

      const qid = QUADRANT_IDS[q];

      const key = String(qid);

      const entry = record.quadrants && record.quadrants[key];

      if (!entry || !entry.completedAtMs) {

        stats.skipped += 1;

        continue;

      }

      const ok = await pushQuadrantRecord(record, qid);

      if (ok) stats.pushed += 1;

      else stats.failed += 1;

    }

  }

  return stats;

}



/** 客户端直连云库拉取（云函数异常时的兜底） */

async function pullReflectionViaDatabase() {

  if (!wx.cloud || typeof wx.cloud.database !== "function") return [];

  const STORAGE_KEYS = require("../config/storageKeys");

  let openid = "";

  try {

    openid = String(wx.getStorageSync(STORAGE_KEYS.USER_OPENID) || "").trim();

  } catch (e) {

    /* ignore */

  }

  if (!openid) return [];

  try {

    const db = wx.cloud.database();

    const _ = db.command;

    const res = await db

      .collection("reflection_quadrants")

      .where({

        openid,

        status: _.neq("deleted"),

      })

      .limit(500)

      .get();

    return aggregateQuadrantDocsToRecords(res.data || []);

  } catch (e) {

    console.warn("[reflectionCloudSync] pullReflectionViaDatabase", e);

    return [];

  }

}



async function pullAndMergeFromCloud() {

  const out = { merged: false, recordCount: 0, listSource: "" };

  if (!isLoggedIn()) return out;

  if (!(await ensureCloudCallable())) return out;



  let records = [];

  const raw = await callQuickstart("listReflectionRecords");

  if (raw && raw.success && Array.isArray(raw.records)) {

    records = raw.records;

    out.listSource = raw.listSource || "reflection_quadrants";

  } else if (raw && raw.errMsg) {

    console.warn("[reflectionCloudSync] listReflectionRecords", raw.errMsg);

  }



  if (!records.length) {

    const direct = await pullReflectionViaDatabase();

    if (direct.length) {

      records = direct;

      out.listSource = "reflection_quadrants_db";

    }

  }



  if (!records.length) return out;



  const syncConflict = require("./syncConflict");

  const r = syncConflict.mergeReflectionFromCloud(

    records,

    reflectionManager.readAll,

    reflectionManager.writeAll

  );

  out.merged = !!r.merged;

  out.recordCount = records.length;

  return out;

}



/**

 * 哲思报告页：先上推本机，再拉云端合并

 * @returns {Promise<{ ok: boolean, pushed: number, failed: number, recordCount: number, listSource?: string, hadLocal: boolean }>}

 */

async function syncReflectionReportPage() {

  const result = {

    ok: false,

    pushed: 0,

    failed: 0,

    recordCount: 0,

    listSource: "",

    hadLocal: reflectionManager.readAll().some((r) => {

      if (!r || !r.taskId) return false;

      return QUADRANT_IDS.some((qid) => {

        const e = r.quadrants && r.quadrants[String(qid)];

        return !!(e && e.completedAtMs > 0);

      });

    }),

  };

  if (!isLoggedIn()) return result;

  if (!(await ensureCloudCallable())) return result;



  const pushStats = await pushAllLocalQuadrantsToCloud();

  result.pushed = pushStats.pushed;

  result.failed = pushStats.failed;



  const pullStats = await pullAndMergeFromCloud();

  result.recordCount = pullStats.recordCount;

  result.listSource = pullStats.listSource || "";

  result.ok = pullStats.recordCount > 0 || result.hadLocal;



  try {

    require("./syncConflict").seedBaseFromLocalIfEmpty();

  } catch (e) {

    /* ignore */

  }

  return result;

}



function purgeTaskOnCloud(taskId) {

  const id = String(taskId || "").trim();

  if (!id) return;

  callQuickstart("purgeReflectionTask", { taskId: id });

}



module.exports = {

  pullAndMergeFromCloud,

  syncReflectionReportPage,

  schedulePushQuadrant,

  pushQuadrantRecord,

  pushAllLocalQuadrantsToCloud,

  purgeTaskOnCloud,

  repairLocalReflectionForSync,

};


