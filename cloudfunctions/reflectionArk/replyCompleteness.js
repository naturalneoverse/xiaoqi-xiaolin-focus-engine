"use strict";

const { charCount } = require("./normalizeText");
const {
  ARK_DISPLAY_MIN_CHARS,
  QUADRANT_Q1_ID,
  QUADRANT_Q2_ID,
  QUADRANT_Q3_ID,
  Q1_STRICT_TERMINAL_CARD,
} = require("./constants");

const SENTENCE_END_RE = /[。！？；.!?;]/;

/** 悬尾：话术未收束（长短语优先匹配） */
const DANGLING_SUFFIXES = [
  "生于毫末",
  "遥不可及的虚",
  "您执念里预设",
  "预设",
  "生于",
  "毫末",
  "之外",
  "之内",
  "之后",
  "之前",
  "而言",
  "来说",
  "方面",
  "虚",
  "的",
  "了",
  "在",
  "与",
  "而",
  "及",
  "或",
  "但",
  "且",
  "所",
  "之",
  "其",
  "着",
  "过",
  "等",
  "把",
  "被",
  "让",
  "向",
  "从",
  "对",
  "为",
  "以",
  "将",
  "很",
  "较",
  "更",
  "最",
];

const QUOTE_PAIRS = [
  ["《", "》"],
  ["「", "」"],
  ["『", "』"],
  ["“", "”"],
  ["\"", "\""],
];

/**
 * @param {string} text
 * @param {string} ch
 * @returns {number}
 */
function countChar(text, ch) {
  let n = 0;
  Array.from(String(text || "")).forEach((c) => {
    if (c === ch) n += 1;
  });
  return n;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function hasSentenceEnd(text) {
  return Array.from(String(text || "")).some((ch) => SENTENCE_END_RE.test(ch));
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function endsWithTerminalPunctuation(text) {
  const t = normalizeForCheck(text);
  if (!t) return false;
  const chars = Array.from(t);
  const last = chars[chars.length - 1];
  return SENTENCE_END_RE.test(last);
}

/**
 * @param {string} text
 * @returns {string}
 */
function normalizeForCheck(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

/**
 * @param {string} text
 * @returns {{ hit: boolean, suffix?: string }}
 */
function findDanglingSuffix(text) {
  const t = normalizeForCheck(text);
  if (!t) return { hit: false };
  for (let i = 0; i < DANGLING_SUFFIXES.length; i++) {
    const suffix = DANGLING_SUFFIXES[i];
    if (suffix && t.endsWith(suffix)) {
      return { hit: true, suffix };
    }
  }
  return { hit: false };
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function hasUnclosedQuotes(text) {
  const t = String(text || "");
  for (let i = 0; i < QUOTE_PAIRS.length; i++) {
    const pair = QUOTE_PAIRS[i];
    if (!pair || pair.length < 2) continue;
    const open = pair[0];
    const close = pair[1];
    if (countChar(t, open) !== countChar(t, close)) return true;
  }
  return false;
}

/**
 * 方舟解读是否可入库/展示（六套兜底句不走此函数）
 * @param {string} text
 * @param {{ strictTerminal?: boolean }} [options] 观心明己补丁：末字须为句末符
 * @returns {{ ok: boolean, reason?: string }}
 */
function isArkReplyAcceptable(text, options) {
  const strictTerminal = !!(options && options.strictTerminal);
  const t = normalizeForCheck(text);
  const n = charCount(t);

  if (n < ARK_DISPLAY_MIN_CHARS) {
    return { ok: false, reason: "TOO_SHORT_DISPLAY" };
  }
  if (!hasSentenceEnd(t)) {
    return { ok: false, reason: "NO_SENTENCE_END" };
  }
  if (strictTerminal && !endsWithTerminalPunctuation(t)) {
    return { ok: false, reason: "NO_TERMINAL_END" };
  }
  const dangling = findDanglingSuffix(t);
  if (dangling.hit) {
    return { ok: false, reason: "DANGLING_ENDING" };
  }
  if (hasUnclosedQuotes(t)) {
    return { ok: false, reason: "UNCLOSED_QUOTE" };
  }
  return { ok: true };
}

/**
 * 按象限+卡字段决定是否末字须句末符（Q2 全卡；Q1 仅 c2）
 * @param {number} [quadrantId]
 * @param {string} [cardField]
 * @returns {{ strictTerminal?: boolean }|undefined}
 */
function completenessOptionsForCard(quadrantId, cardField) {
  const q = Number(quadrantId);
  const field = String(cardField || "").trim();
  if (q === QUADRANT_Q2_ID || q === QUADRANT_Q3_ID) return { strictTerminal: true };
  if (q === QUADRANT_Q1_ID && field === Q1_STRICT_TERMINAL_CARD) {
    return { strictTerminal: true };
  }
  return undefined;
}

/**
 * 读缓存 / 入库前终检：按象限+卡字段验收（R2 统一入口）
 * @param {number} quadrantId
 * @param {string} cardField
 * @param {string} text
 * @returns {{ ok: boolean, reason?: string }}
 */
function assessArkReplyForCard(quadrantId, cardField, text) {
  return isArkReplyAcceptable(text, completenessOptionsForCard(quadrantId, cardField));
}

/**
 * strictTerminal 场景：正文够长且缺末字句末符时补「。」（R1/Q2，避免整段作废）
 * @param {string} text
 * @param {{ strictTerminal?: boolean }} [options]
 * @returns {string}
 */
function patchStrictTerminalEnd(text, options) {
  const strictTerminal = !!(options && options.strictTerminal);
  if (!strictTerminal) return String(text || "");
  const t = normalizeForCheck(text);
  if (!t || endsWithTerminalPunctuation(t)) return t;
  if (charCount(t) < ARK_DISPLAY_MIN_CHARS) return t;
  if (!hasSentenceEnd(t)) return t;
  if (findDanglingSuffix(t).hit || hasUnclosedQuotes(t)) return t;
  return `${t}。`;
}

module.exports = {
  isArkReplyAcceptable,
  completenessOptionsForCard,
  assessArkReplyForCard,
  patchStrictTerminalEnd,
  hasSentenceEnd,
  endsWithTerminalPunctuation,
  findDanglingSuffix,
  hasUnclosedQuotes,
};
