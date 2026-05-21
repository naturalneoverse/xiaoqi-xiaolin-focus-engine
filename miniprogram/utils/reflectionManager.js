const STORAGE_KEYS = require("../config/storageKeys");
const {
  QUADRANT_IDS,
  isValidQuadrantId,
  formatCompletedAt,
  createEmptyRecord,
  normalizeRecord,
  normalizeRecordList,
} = require("../config/reflectionRecordSchema");

function readAll() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEYS.REFLECTION_RECORDS);
    return normalizeRecordList(raw);
  } catch (e) {
    console.warn("[reflectionManager] readAll", e);
    return [];
  }
}

function writeAll(list) {
  const normalized = normalizeRecordList(list);
  wx.setStorageSync(STORAGE_KEYS.REFLECTION_RECORDS, normalized);
  return normalized;
}

function findByTaskId(taskId) {
  const id = String(taskId || "").trim();
  if (!id) return null;
  return readAll().find((r) => r && String(r.taskId).trim() === id) || null;
}

/**
 * 写入或更新某一象限的复盘内容
 * @param {string} taskId
 * @param {string} [taskTitle]
 * @param {number} quadrantId 1-4
 * @param {{ cardResponses: unknown[] }} payload
 */
function upsertQuadrant(taskId, taskTitle, quadrantId, payload) {
  if (!taskId) {
    throw new Error("taskId required");
  }
  if (!isValidQuadrantId(quadrantId)) {
    throw new Error("invalid quadrantId");
  }
  const cardResponses =
    payload && Array.isArray(payload.cardResponses) ? payload.cardResponses : [];

  const list = readAll();
  const id = String(taskId);
  const key = String(quadrantId);
  const now = Date.now();
  const completedAt = formatCompletedAt(now);

  let idx = list.findIndex((r) => r && r.taskId === id);
  let record;
  if (idx >= 0) {
    record = { ...list[idx] };
  } else {
    record = createEmptyRecord(id, taskTitle);
    idx = -1;
  }

  if (taskTitle) {
    record.taskTitle = String(taskTitle);
  }
  record.quadrants = { ...(record.quadrants || {}) };
  record.quadrants[key] = {
    cardResponses,
    completedAt,
    completedAtMs: now,
  };
  record.updatedAt = now;
  record.latestCompletedAt = completedAt;
  record.latestCompletedAtMs = now;

  if (idx >= 0) {
    list.splice(idx, 1);
  }
  list.unshift(record);
  writeAll(list);
  return record;
}

function listRecordsSorted() {
  return readAll()
    .slice()
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function getCompletedQuadrantIds(record) {
  if (!record || !record.quadrants) return [];
  return QUADRANT_IDS.filter((qid) => isQuadrantComplete(record, qid));
}

function isQuadrantComplete(record, quadrantId) {
  if (!isValidQuadrantId(quadrantId)) return false;
  const entry = record && record.quadrants && record.quadrants[String(quadrantId)];
  return !!(entry && entry.completedAtMs > 0);
}

function isAllQuadrantsComplete(record) {
  return getCompletedQuadrantIds(record).length >= QUADRANT_IDS.length;
}

function getQuadrantEntry(record, quadrantId) {
  if (!record || !isValidQuadrantId(quadrantId)) return null;
  return (record.quadrants && record.quadrants[String(quadrantId)]) || null;
}

function removeByTaskId(taskId) {
  const id = String(taskId || "").trim();
  if (!id) return false;
  let list;
  try {
    list = readAll();
  } catch (e) {
    console.warn("[reflectionManager] removeByTaskId readAll", e);
    return false;
  }
  const next = list.filter((r) => !r || String(r.taskId).trim() !== id);
  if (next.length === list.length) return false;
  try {
    writeAll(next);
    return true;
  } catch (e) {
    console.error("[reflectionManager] removeByTaskId writeAll", e);
    return false;
  }
}

module.exports = {
  readAll,
  writeAll,
  findByTaskId,
  upsertQuadrant,
  listRecordsSorted,
  getCompletedQuadrantIds,
  isQuadrantComplete,
  isAllQuadrantsComplete,
  getQuadrantEntry,
  removeByTaskId,
};
