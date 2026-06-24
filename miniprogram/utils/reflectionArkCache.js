/**
 * reflection_ark_cache 只读访问（小程序端不写缓存，由云函数写入）
 */

const { CACHE_COLLECTION } = require("../config/reflectionArkConfig");
const { isFallbackReply } = require("../config/reflectionArkFallback");
const { buildTextHash } = require("./reflectionArkTextHash");
const { assessArkReplyForCard } = require("./reflectionArkReplyQuality");
const { isCloudReady } = require("./cloudCall");

/** 进程内短缓存，减少报告页重复读库 */
const memoryCache = Object.create(null);

function memKey(taskId, quadrantId, cardField, textHash) {
  return `${taskId}|${qId(quadrantId)}|${cardField}|${textHash}`;
}

function qId(quadrantId) {
  return Number(quadrantId);
}

function getDatabase() {
  if (!isCloudReady() || !wx.cloud || !wx.cloud.database) return null;
  return wx.cloud.database();
}

/**
 * @param {object} doc
 * @returns {{ replyContent: string, fromCache: boolean, textHash: string, agentType?: string }|null}
 */
function pickReplyFromDoc(doc) {
  if (!doc || typeof doc.replyContent !== "string") return null;
  return {
    replyContent: doc.replyContent,
    fromCache: true,
    textHash: doc.textHash || "",
    agentType: doc.agentType || "",
  };
}

/**
 * 按唯一键读取一条缓存
 * @param {{ taskId: string, quadrantId: number, cardField: string, userText?: string, textHash?: string }} query
 */
function fetchCacheEntry(query) {
  const taskId = String((query && query.taskId) || "").trim();
  const quadrantId = qId(query && query.quadrantId);
  const cardField = String((query && query.cardField) || "").trim();
  if (!taskId || !cardField || !quadrantId) {
    return Promise.resolve(null);
  }

  let textHash = String((query && query.textHash) || "").trim();
  if (!textHash && query && query.userText) {
    textHash = buildTextHash(query.userText).hash;
  }
  if (!textHash) return Promise.resolve(null);

  const mk = memKey(taskId, quadrantId, cardField, textHash);
  if (memoryCache[mk]) {
    return Promise.resolve(Object.assign({}, memoryCache[mk]));
  }

  const db = getDatabase();
  if (!db) return Promise.resolve(null);

  return db
    .collection(CACHE_COLLECTION)
    .where({ taskId, quadrantId, cardField, textHash })
    .limit(1)
    .get()
    .then((res) => {
      const doc = res.data && res.data[0];
      const picked = pickReplyFromDoc(doc);
      if (picked) memoryCache[mk] = picked;
      return picked;
    })
    .catch(() => null);
}

/**
 * 读取某任务某象限全部缓存行
 * @param {string} taskId
 * @param {number} quadrantId
 */
function fetchQuadrantCacheRows(taskId, quadrantId) {
  const tid = String(taskId || "").trim();
  const q = qId(quadrantId);
  if (!tid || !q) return Promise.resolve([]);

  const db = getDatabase();
  if (!db) return Promise.resolve([]);

  return db
    .collection(CACHE_COLLECTION)
    .where({ taskId: tid, quadrantId: q })
    .get()
    .then((res) => {
      const rows = res.data || [];
      rows.forEach((doc) => {
        const picked = pickReplyFromDoc(doc);
        if (!picked || !doc.textHash) return;
        const mk = memKey(tid, q, doc.cardField, doc.textHash);
        memoryCache[mk] = picked;
      });
      return rows;
    })
    .catch(() => []);
}

/**
 * 构建 cardField+textHash → 回复 映射，供报告页拼装
 * @param {object[]} rows
 * @returns {Record<string, string>}
 */
/**
 * 仅纳入可展示的方舟缓存；无效方舟残句不进入 map（报告走六套兜底）
 * @param {object[]} rows
 * @param {number} [quadrantId] Q2 全卡、Q1 仅 c2 末字须句末符（R3）
 * @returns {Record<string, string>}
 */
function buildReplyMapFromRows(rows, quadrantId) {
  const q = qId(quadrantId);
  const map = Object.create(null);
  (rows || []).forEach((doc) => {
    if (!doc || !doc.cardField || !doc.textHash) return;
    const key = `${doc.cardField}:${doc.textHash}`;
    if (typeof doc.replyContent !== "string") return;
    const content = String(doc.replyContent).trim();
    if (!content) return;
    if (isFallbackReply(content)) {
      map[key] = doc.replyContent;
      return;
    }
    if (assessArkReplyForCard(q, doc.cardField, content).ok) {
      map[key] = doc.replyContent;
    }
  });
  return map;
}

/**
 * @param {string} taskId
 * @param {number} quadrantId
 * @param {string} cardField
 * @param {string} userText
 */
function lookupReplyContent(taskId, quadrantId, cardField, userText) {
  const { hash } = buildTextHash(userText);
  return fetchCacheEntry({ taskId, quadrantId, cardField, textHash: hash }).then((row) => {
    return row ? row.replyContent : "";
  });
}

/**
 * 云函数 generate 成功后写入内存（库已由云函数写入）
 */
function rememberReplyInMemory(taskId, quadrantId, cardField, textHash, replyContent, agentType) {
  const mk = memKey(taskId, quadrantId, cardField, textHash);
  memoryCache[mk] = {
    replyContent: String(replyContent || ""),
    fromCache: false,
    textHash,
    agentType: agentType || "",
  };
}

function clearMemoryCacheForTask(taskId) {
  const prefix = `${String(taskId || "").trim()}|`;
  Object.keys(memoryCache).forEach((k) => {
    if (k.indexOf(prefix) === 0) delete memoryCache[k];
  });
}

/** 象限重新提交后清内存缓存，报告页会重新读库 */
function clearMemoryCacheForQuadrant(taskId, quadrantId) {
  const prefix = `${String(taskId || "").trim()}|${qId(quadrantId)}|`;
  Object.keys(memoryCache).forEach((k) => {
    if (k.indexOf(prefix) === 0) delete memoryCache[k];
  });
}

function clearAllMemoryCache() {
  Object.keys(memoryCache).forEach((k) => {
    delete memoryCache[k];
  });
}

module.exports = {
  fetchCacheEntry,
  fetchQuadrantCacheRows,
  buildReplyMapFromRows,
  lookupReplyContent,
  rememberReplyInMemory,
  clearMemoryCacheForTask,
  clearMemoryCacheForQuadrant,
  clearAllMemoryCache,
  buildTextHash,
};
