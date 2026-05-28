/**
 * 哲思复盘 · 手写解读后台生成（先提交象限，报告稍后补齐）
 */

const { collectHandwritingApiTargets } = require("../config/reflectionArkApiMap");
const { getQuadrantCards, applySavedResponses } = require("../config/reflectionQuadrantCards");
const reflectionManager = require("./reflectionManager");
const reflectionArk = require("./reflectionArkClient");
const { isCloudReady } = require("./cloudCall");

const STORAGE_KEY = "reflection_ark_pending_v1";
const FAILED_STORAGE_KEY = "reflection_ark_gen_failed_v1";
const activeJobs = Object.create(null);

const BACKGROUND_GEN_TOAST_OK = "回响正在后台生成，约半分钟后可在报告中查看";
const BACKGROUND_GEN_TOAST_FAIL = "回响生成未完成，请稍后在象限页重试保存";

function jobKey(taskId, quadrantId) {
  return `${String(taskId || "").trim()}:${Number(quadrantId)}`;
}

function readPendingStore() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY);
    return raw && typeof raw === "object" ? raw : {};
  } catch (e) {
    return {};
  }
}

function writePendingStore(store) {
  try {
    wx.setStorageSync(STORAGE_KEY, store);
  } catch (e) {
    /* ignore */
  }
}

/**
 * @param {string} taskId
 * @param {number} quadrantId
 * @param {{ cardField: string }[]} targets
 */
function markPending(taskId, quadrantId, targets, genId) {
  const tid = String(taskId || "").trim();
  if (!tid) return;
  const store = readPendingStore();
  if (!store[tid]) store[tid] = Object.create(null);
  store[tid][String(Number(quadrantId))] = {
    cardFields: (targets || []).map((t) => String(t.cardField || "")).filter(Boolean),
    startedAt: Date.now(),
    genId: genId != null ? genId : 0,
  };
  writePendingStore(store);
}

/**
 * @param {string} taskId
 * @param {number} quadrantId
 */
function clearPending(taskId, quadrantId, genId) {
  const tid = String(taskId || "").trim();
  if (!tid) return;
  const store = readPendingStore();
  if (!store[tid]) return;
  const qKey = String(Number(quadrantId));
  const row = store[tid][qKey];
  if (genId != null && row && row.genId != null && row.genId !== genId) {
    return;
  }
  delete store[tid][qKey];
  if (!Object.keys(store[tid]).length) delete store[tid];
  writePendingStore(store);
}

/**
 * @param {string} taskId
 * @param {number} quadrantId
 * @returns {string[]}
 */
function getPendingCardFields(taskId, quadrantId) {
  const tid = String(taskId || "").trim();
  const store = readPendingStore();
  const row = store[tid] && store[tid][String(Number(quadrantId))];
  return row && Array.isArray(row.cardFields) ? row.cardFields.slice() : [];
}

/**
 * @param {string} taskId
 * @returns {boolean}
 */
function hasPendingForTask(taskId) {
  const tid = String(taskId || "").trim();
  const store = readPendingStore();
  const row = store[tid];
  return !!(row && Object.keys(row).length);
}

function isJobActive(taskId, quadrantId) {
  const slot = activeJobs[jobKey(taskId, quadrantId)];
  return !!(slot && slot.promise);
}

/** 选择页/报告页：是否仍有后台生成在进行 */
function hasGeneratingWorkForTask(taskId) {
  const tid = String(taskId || "").trim();
  if (!tid) return false;
  if (hasPendingForTask(tid)) return true;
  const prefix = `${tid}:`;
  return Object.keys(activeJobs).some((k) => k.indexOf(prefix) === 0);
}

function isQuadrantGenerating(taskId, quadrantId) {
  const tid = String(taskId || "").trim();
  const q = Number(quadrantId);
  if (!tid || !q) return false;
  if (isJobActive(tid, q)) return true;
  return getPendingCardFields(tid, q).length > 0;
}

function readFailedStore() {
  try {
    const raw = wx.getStorageSync(FAILED_STORAGE_KEY);
    return raw && typeof raw === "object" ? raw : {};
  } catch (e) {
    return {};
  }
}

function writeFailedStore(store) {
  try {
    wx.setStorageSync(FAILED_STORAGE_KEY, store);
  } catch (e) {
    /* ignore */
  }
}

function markGenerationFailed(taskId, quadrantId) {
  const tid = String(taskId || "").trim();
  if (!tid) return;
  const store = readFailedStore();
  if (!store[tid]) store[tid] = Object.create(null);
  store[tid][String(Number(quadrantId))] = Date.now();
  writeFailedStore(store);
}

function clearGenerationFailed(taskId, quadrantId) {
  const tid = String(taskId || "").trim();
  if (!tid) return;
  const store = readFailedStore();
  if (!store[tid]) return;
  delete store[tid][String(Number(quadrantId))];
  if (!Object.keys(store[tid]).length) delete store[tid];
  writeFailedStore(store);
}

function notifyBackgroundGenResult(quadrantId, ok) {
  try {
    wx.showToast({
      title: ok ? BACKGROUND_GEN_TOAST_OK : BACKGROUND_GEN_TOAST_FAIL,
      icon: "none",
      duration: ok ? 2800 : 3200,
    });
  } catch (e) {
    /* ignore */
  }
}

/**
 * @param {string} taskId
 * @param {number} quadrantId
 * @param {{ textValues?: object, multiValues?: object, multiExpandValues?: object }} form
 * @param {{ taskTitle?: string, forceRegenerate?: boolean }} [opts]
 * @returns {Promise<object>}
 */
function enqueueQuadrantHandwritingGeneration(taskId, quadrantId, form, opts) {
  const tid = String(taskId || "").trim();
  const q = Number(quadrantId);
  const targets = collectHandwritingApiTargets(q, form || {});
  if (!tid || !q || !targets.length || !isCloudReady()) {
    return Promise.resolve({ ok: true, skipped: true });
  }

  const forceRegenerate = !!(opts && opts.forceRegenerate);
  const key = jobKey(tid, q);
  const existing = activeJobs[key];
  if (existing && existing.promise && !forceRegenerate) {
    return existing.promise;
  }

  const genId = Date.now();
  markPending(tid, q, targets, genId);
  clearGenerationFailed(tid, q);

  const enriched = targets.map((t) =>
    Object.assign({ taskId: tid, quadrantId: q }, t),
  );

  const taskTitle =
    opts && opts.taskTitle != null ? String(opts.taskTitle).trim() : "未命名任务";

  const genOpts = { taskTitle, forceRegenerate };

  const generatePromise =
    q === 2
      ? reflectionArk.generateQ2S2Blocking(tid, enriched, genOpts)
      : q === 3
        ? reflectionArk.generateQ3S2Blocking(tid, enriched, genOpts)
        : reflectionArk.generateQuadrantBatch(tid, q, enriched, null, genOpts);

  const job = generatePromise
    .then((replies) => {
      const list = Array.isArray(replies) ? replies : [];
      const zeroFallback = q === 1 || q === 2 || q === 3 || q === 4;
      if (zeroFallback) {
        const failed = list.filter((r) => r && !r.ok);
        if (failed.length) {
          console.warn(
            `[reflectionArkBackground] Q${q} 回响未全部成功`,
            failed.map((r) => ({ field: r.cardField, errCode: r.errCode })),
          );
          markGenerationFailed(tid, q);
          notifyBackgroundGenResult(q, false);
        } else {
          clearGenerationFailed(tid, q);
          notifyBackgroundGenResult(q, true);
        }
        return { ok: failed.length === 0, replies: list };
      }
      const fallbacks = list.filter((r) => r && r.fallback);
      if (fallbacks.length) {
        console.warn(
          "[reflectionArkBackground] 部分手写兜底",
          fallbacks.length,
          "/",
          list.length,
          "quadrant",
          q,
        );
      }
      return { ok: true, replies: list };
    })
    .catch((err) => {
      console.warn("[reflectionArkBackground] generate failed", q, err);
      if (q === 1 || q === 2 || q === 3 || q === 4) {
        markGenerationFailed(tid, q);
        notifyBackgroundGenResult(q, false);
      }
      return { ok: false };
    })
    .finally(() => {
      const slot = activeJobs[key];
      if (slot && slot.genId === genId) {
        delete activeJobs[key];
      }
      clearPending(tid, q, genId);
    });

  activeJobs[key] = { genId, promise: job };
  return job;
}

/**
 * 小程序被挂起后恢复：根据已存象限重新拉起未完成的生成
 * @param {string} taskId
 */
/**
 * 删除复盘档案：清 pending / 失败标记 / 内存中的进行中任务引用（进行中的云请求仍会结束，但不写回本地记录）
 * @param {string} taskId
 */
function clearAllWorkForTask(taskId) {
  const tid = String(taskId || "").trim();
  if (!tid) return;
  const store = readPendingStore();
  if (store[tid]) {
    delete store[tid];
    writePendingStore(store);
  }
  const failed = readFailedStore();
  if (failed[tid]) {
    delete failed[tid];
    writeFailedStore(failed);
  }
  const prefix = `${tid}:`;
  Object.keys(activeJobs).forEach((k) => {
    if (k.indexOf(prefix) === 0) delete activeJobs[k];
  });
}

function hasGenerationFailed(taskId, quadrantId) {
  const tid = String(taskId || "").trim();
  const store = readFailedStore();
  return !!(store[tid] && store[tid][String(Number(quadrantId))]);
}

function resumePendingGenerationsForTask(taskId) {
  const tid = String(taskId || "").trim();
  if (!tid || !isCloudReady()) return;

  const store = readPendingStore();
  const pending = store[tid];
  if (!pending) return;

  const record = reflectionManager.findByTaskId(tid);
  if (!record) return;

  Object.keys(pending).forEach((qStr) => {
    const quadrantId = Number(qStr);
    if (isJobActive(tid, quadrantId)) return;

    const entry = reflectionManager.getQuadrantEntry(record, quadrantId);
    if (!entry || !Array.isArray(entry.cardResponses)) {
      clearPending(tid, quadrantId);
      return;
    }

    const cards = getQuadrantCards(quadrantId);
    const form = applySavedResponses(cards, entry);
    const taskTitle = record && record.taskTitle ? record.taskTitle : "未命名任务";
    enqueueQuadrantHandwritingGeneration(tid, quadrantId, form, { taskTitle });
  });
}

module.exports = {
  enqueueQuadrantHandwritingGeneration,
  resumePendingGenerationsForTask,
  getPendingCardFields,
  hasPendingForTask,
  hasGeneratingWorkForTask,
  isQuadrantGenerating,
  isJobActive,
  clearPending,
  clearGenerationFailed,
  clearAllWorkForTask,
  hasGenerationFailed,
};
