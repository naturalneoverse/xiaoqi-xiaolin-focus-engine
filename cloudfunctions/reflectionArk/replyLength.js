"use strict";

const { charCount } = require("./normalizeText");
const { REPLY_MIN_CHARS, REPLY_MAX_CHARS } = require("./constants");

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
 * @param {string} text
 * @param {number} minChars
 * @param {number} maxChars
 * @returns {string}
 */
function padToMinLength(text, minChars, maxChars) {
  const max = maxChars > 0 ? maxChars : REPLY_MAX_CHARS;
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

/** 短档不硬垫套话，避免与「精炼回应」冲突 */
const NO_PAD_TIERS = new Set(["xs", "s"]);

/**
 * 字数后处理（支持按用户输入动态 min/max）
 * @param {string} raw
 * @param {{ min?: number, max?: number, tier?: string }} [bounds]
 * @returns {string}
 */
function enforceReplyLength(raw, bounds) {
  const minChars = bounds && bounds.min != null ? bounds.min : REPLY_MIN_CHARS;
  const maxChars = bounds && bounds.max != null ? bounds.max : REPLY_MAX_CHARS;
  const tier = bounds && bounds.tier ? String(bounds.tier) : "";
  const skipPad = NO_PAD_TIERS.has(tier);
  let text = String(raw || "").replace(/\s+/g, " ").trim();
  if (charCount(text) > maxChars) {
    text = truncateToCompleteSentence(text, maxChars);
  }
  if (!skipPad && charCount(text) < minChars) {
    text = padToMinLength(text, minChars, maxChars);
  }
  if (charCount(text) > maxChars) {
    text = truncateToCompleteSentence(text, maxChars);
  }
  return text;
}

/**
 * @param {string} text
 * @param {{ min?: number, max?: number }} [bounds]
 * @returns {{ ok: boolean, reason?: string }}
 */
function validateReplyLengthRange(text, bounds) {
  const minChars = bounds && bounds.min != null ? bounds.min : REPLY_MIN_CHARS;
  const maxChars = bounds && bounds.max != null ? bounds.max : REPLY_MAX_CHARS;
  const tier = bounds && bounds.tier ? String(bounds.tier) : "";
  const n = charCount(text);
  if (!NO_PAD_TIERS.has(tier) && n < minChars) return { ok: false, reason: "TOO_SHORT" };
  if (n > maxChars + 2) return { ok: false, reason: "TOO_LONG" };
  if (NO_PAD_TIERS.has(tier) && n < 1) return { ok: false, reason: "TOO_SHORT" };
  return { ok: true };
}

module.exports = {
  enforceReplyLength,
  validateReplyLengthRange,
  truncateToCompleteSentence,
  padToMinLength,
};
