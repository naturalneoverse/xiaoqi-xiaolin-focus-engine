/**
 * 哲思报告 · 兜底 / 生成中文案入口
 */

const {
  FALLBACK_GLOBAL,
  getFallbackCopyForCard,
  getReportFallbackSetIndex,
  listAllFallbackLines,
} = require("./reflectionFallbackCopy");

const FALLBACK_REPLY = FALLBACK_GLOBAL;

const PENDING_HANDWRITING_REPLY =
  "正在为您整理回应，请稍后再看本页，内容会自动更新。";

/** 观心明己 Q2：报告无缓存时的手写段提示（非六套兜底） */
const Q2_MISSING_HANDWRITING_REPLY = "回响尚未生成，请返回观心明己重新提交。";

const Q1_MISSING_HANDWRITING_REPLY = "回响尚未生成，请返回观实归真重新提交。";

const Q3_MISSING_HANDWRITING_REPLY = "回响尚未生成，请返回自我主宰重新提交。";

const Q4_MISSING_HANDWRITING_REPLY = "回响尚未生成，请返回踏实前行重新提交。";

const FALLBACK_REPLY_SET = new Set(listAllFallbackLines());

/**
 * @param {number} quadrantId
 * @param {string} cardField
 * @param {{ setIndex?: number, taskId?: string, visitSeed?: string }} [opts]
 * @returns {string}
 */
function getFallbackReply(quadrantId, cardField, opts) {
  const field = cardField != null ? String(cardField).trim() : "";
  if (!field) return FALLBACK_GLOBAL;

  let setIndex =
    opts && opts.setIndex != null ? Number(opts.setIndex) : NaN;
  if (Number.isNaN(setIndex)) {
    setIndex = getReportFallbackSetIndex(
      opts && opts.taskId,
      opts && opts.visitSeed,
    );
  }
  return getFallbackCopyForCard(quadrantId, field, setIndex);
}

/**
 * @param {"xiaoqi"|"xiaolin"|string} _agentType
 * @returns {string}
 */
function getPendingHandwritingReply(_agentType) {
  return PENDING_HANDWRITING_REPLY;
}

function getQ2MissingHandwritingReply() {
  return Q2_MISSING_HANDWRITING_REPLY;
}

function getQ1MissingHandwritingReply() {
  return Q1_MISSING_HANDWRITING_REPLY;
}

function getQ3MissingHandwritingReply() {
  return Q3_MISSING_HANDWRITING_REPLY;
}

function getQ4MissingHandwritingReply() {
  return Q4_MISSING_HANDWRITING_REPLY;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function isPendingHandwritingReply(text) {
  return String(text || "").trim() === PENDING_HANDWRITING_REPLY;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function isFallbackReply(text) {
  return FALLBACK_REPLY_SET.has(String(text || "").trim());
}

/**
 * @param {string} taskId
 * @param {string} [visitSeed]
 * @returns {number}
 */
function resolveReportFallbackSetIndex(taskId, visitSeed) {
  return getReportFallbackSetIndex(taskId, visitSeed);
}

module.exports = {
  FALLBACK_REPLY,
  FALLBACK_GLOBAL,
  PENDING_HANDWRITING_REPLY,
  Q2_MISSING_HANDWRITING_REPLY,
  getFallbackReply,
  getPendingHandwritingReply,
  getQ2MissingHandwritingReply,
  getQ1MissingHandwritingReply,
  getQ3MissingHandwritingReply,
  getQ4MissingHandwritingReply,
  isPendingHandwritingReply,
  isFallbackReply,
  resolveReportFallbackSetIndex,
  getReportFallbackSetIndex,
  listAllFallbackLines,
};
