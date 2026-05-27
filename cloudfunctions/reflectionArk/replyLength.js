"use strict";

const { charCount } = require("./normalizeText");
const {
  ARK_PROMPT_MAX_SHORT,
  ARK_Q2_SOFT_MAX,
  ARK_DISPLAY_MIN_CHARS,
  REPLY_MIN_CHARS,
  REPLY_MAX_CHARS,
} = require("./constants");

const SENTENCE_END_RE = /[。！？；.!?;]/;
const PAD_CLAUSES = [
  "愿您在觉察里寻得一份安稳与笃定，把感受轻轻安放。",
  "这一路并不孤单，每一次书写都在为内心留出余地。",
  "请把温柔也留给此刻的自己，不必急于给出答案。",
  "当心绪渐平，答案会在从容中浮现，您已做得很好。",
  "且将今日所得化作明日的分寸，步履不必匆忙。",
];

/**
 * @param {string} text
 * @returns {number}
 */
function lastSentenceEndIndex(text) {
  const chars = Array.from(text);
  for (let i = chars.length - 1; i >= 0; i--) {
    if (SENTENCE_END_RE.test(chars[i])) return i;
  }
  return -1;
}

/**
 * @param {string} text
 * @param {number} maxChars
 * @returns {string}
 */
function truncateToCompleteSentence(text, maxChars) {
  const chars = Array.from(text);
  if (chars.length <= maxChars) return text;
  let slice = chars.slice(0, maxChars).join("");
  const endIdx = lastSentenceEndIndex(slice);
  if (endIdx > 0 && endIdx >= Math.floor(maxChars * 0.6)) {
    return slice.slice(0, endIdx + 1);
  }
  return slice;
}

/**
 * 观心明己：超上限时优先在句末符处截断（补丁 P3 / 软上限 P9）
 * @param {string} text
 * @param {number} maxChars
 * @returns {{ ok: boolean, text?: string, reason?: string }}
 */
function truncateToCompleteSentenceStrict(text, maxChars) {
  const chars = Array.from(text);
  if (chars.length <= maxChars) {
    return { ok: true, text: String(text || "") };
  }
  const slice = chars.slice(0, maxChars).join("");
  const endIdx = lastSentenceEndIndex(slice);
  if (endIdx >= 0) {
    return { ok: true, text: slice.slice(0, endIdx + 1) };
  }
  return { ok: false, reason: "TRUNCATE_NO_SENTENCE_END" };
}

/**
 * 观心明己软截断：≤max 原样；max+1–softMax 容忍；>softMax 在 softMax 内句末截断，禁止整段作废
 * @param {string} raw
 * @param {{ min?: number, max?: number }} bounds
 * @returns {{ ok: boolean, text: string, reason?: string }}
 */
function enforceReplyLengthQ2Soft(raw, bounds) {
  const maxChars = bounds && bounds.max != null ? bounds.max : ARK_PROMPT_MAX_SHORT;
  const softMax =
    bounds && bounds.softMax != null ? Number(bounds.softMax) : ARK_Q2_SOFT_MAX;
  let text = String(raw || "").replace(/\s+/g, " ").trim();
  const n = charCount(text);
  if (n <= maxChars) {
    return { ok: true, text };
  }
  if (n <= softMax) {
    return { ok: true, text };
  }
  const strict = truncateToCompleteSentenceStrict(text, softMax);
  if (strict.ok && strict.text) {
    return { ok: true, text: strict.text };
  }
  const relaxed = truncateToCompleteSentence(text, softMax);
  if (charCount(relaxed) >= ARK_DISPLAY_MIN_CHARS) {
    return { ok: true, text: relaxed };
  }
  return { ok: false, text: "", reason: "TRUNCATE_NO_SENTENCE_END" };
}

/** @deprecated 使用 enforceReplyLengthQ2Soft */
function enforceReplyLengthQ2Strict(raw, bounds) {
  return enforceReplyLengthQ2Soft(raw, bounds);
}

/**
 * @param {string} text
 * @param {number} minChars
 * @param {number} maxChars
 * @returns {string}
 */
function padToMinLength(text, minChars, maxChars) {
  const max = maxChars > 0 ? maxChars : ARK_PROMPT_MAX_SHORT;
  let out = String(text || "");
  let guard = 0;
  while (charCount(out) < minChars && guard < 24) {
    out += PAD_CLAUSES[guard % PAD_CLAUSES.length];
    guard += 1;
  }
  if (charCount(out) > max) {
    out = truncateToCompleteSentence(out, max);
  }
  return out;
}

/**
 * 字数后处理：规范化空白 + 超 max 截断；合格与否由 replyCompleteness 判定（步骤 4）
 * @param {string} raw
 * @param {{ min?: number, max?: number, tier?: string }} [bounds]
 * @param {{ neverPad?: boolean }} [options]
 * @returns {string}
 */
function enforceReplyLength(raw, bounds, options) {
  const maxChars = bounds && bounds.max != null ? bounds.max : ARK_PROMPT_MAX_SHORT;
  const minChars = bounds && bounds.min != null ? bounds.min : REPLY_MIN_CHARS;
  const neverPad = !!(options && options.neverPad);
  let text = String(raw || "").replace(/\s+/g, " ").trim();
  if (charCount(text) > maxChars) {
    text = truncateToCompleteSentence(text, maxChars);
  }
  if (!neverPad && charCount(text) < minChars) {
    text = padToMinLength(text, minChars, maxChars);
  }
  if (charCount(text) > maxChars) {
    text = truncateToCompleteSentence(text, maxChars);
  }
  return text;
}

/**
 * @param {string} text
 * @param {{ min?: number, max?: number, tier?: string }} [bounds]
 * @param {{ neverPad?: boolean }} [options]
 * @returns {{ ok: boolean, reason?: string }}
 */
function validateReplyLengthRange(text, bounds, options) {
  const maxChars = bounds && bounds.max != null ? bounds.max : ARK_PROMPT_MAX_SHORT;
  const minChars = bounds && bounds.min != null ? bounds.min : REPLY_MIN_CHARS;
  const neverPad = !!(options && options.neverPad);
  const n = charCount(text);
  if (n < 1) return { ok: false, reason: "EMPTY" };
  if (n > maxChars + 2) return { ok: false, reason: "TOO_LONG" };
  if (!neverPad && n < minChars) return { ok: false, reason: "TOO_SHORT" };
  return { ok: true };
}

module.exports = {
  enforceReplyLength,
  enforceReplyLengthQ2Soft,
  enforceReplyLengthQ2Strict,
  validateReplyLengthRange,
  truncateToCompleteSentence,
  truncateToCompleteSentenceStrict,
  padToMinLength,
};
