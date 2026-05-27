/**
 * 方舟解读展示/读缓存验收（须与 cloudfunctions/reflectionArk/replyCompleteness.js 规则同步）
 */

/** 与 cloud constants ARK_DISPLAY_MIN_CHARS 一致 */
const ARK_DISPLAY_MIN_CHARS = 20;

/** 与 cloud constants 一致 */
const QUADRANT_Q1_ID = 1;
const QUADRANT_Q2_ID = 2;
const Q1_STRICT_TERMINAL_CARD = "c2";

const SENTENCE_END_RE = /[。！？；.!?;]/;

/** 悬尾：长短语优先匹配 */
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

function charCount(text) {
  return Array.from(String(text || "")).length;
}

function countChar(text, ch) {
  let n = 0;
  Array.from(String(text || "")).forEach((c) => {
    if (c === ch) n += 1;
  });
  return n;
}

function hasSentenceEnd(text) {
  return Array.from(String(text || "")).some((ch) => SENTENCE_END_RE.test(ch));
}

function endsWithTerminalPunctuation(text) {
  const t = normalizeForCheck(text);
  if (!t) return false;
  const chars = Array.from(t);
  const last = chars[chars.length - 1];
  return SENTENCE_END_RE.test(last);
}

/**
 * 按象限+卡字段（须与 cloud replyCompleteness.js 同步）
 * @param {number} [quadrantId]
 * @param {string} [cardField]
 * @returns {{ strictTerminal?: boolean }|undefined}
 */
function completenessOptionsForCard(quadrantId, cardField) {
  const q = Number(quadrantId);
  const field = String(cardField || "").trim();
  if (q === QUADRANT_Q2_ID) return { strictTerminal: true };
  if (q === QUADRANT_Q1_ID && field === Q1_STRICT_TERMINAL_CARD) {
    return { strictTerminal: true };
  }
  return undefined;
}

/** @deprecated 报告拼装请用 completenessOptionsForCard(quadrantId, cardField) */
function completenessOptionsForQuadrant(quadrantId) {
  return completenessOptionsForCard(quadrantId);
}

/**
 * @param {number} quadrantId
 * @param {string} cardField
 * @param {string} text
 * @returns {{ ok: boolean, reason?: string }}
 */
function assessArkReplyForCard(quadrantId, cardField, text) {
  return isArkReplyAcceptable(text, completenessOptionsForCard(quadrantId, cardField));
}

function normalizeForCheck(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

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

function hasUnclosedQuotes(text) {
  const t = String(text || "");
  for (let i = 0; i < QUOTE_PAIRS.length; i++) {
    const pair = QUOTE_PAIRS[i];
    if (!pair || pair.length < 2) continue;
    if (countChar(t, pair[0]) !== countChar(t, pair[1])) return true;
  }
  return false;
}

/**
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
  if (findDanglingSuffix(t).hit) {
    return { ok: false, reason: "DANGLING_ENDING" };
  }
  if (hasUnclosedQuotes(t)) {
    return { ok: false, reason: "UNCLOSED_QUOTE" };
  }
  return { ok: true };
}

module.exports = {
  ARK_DISPLAY_MIN_CHARS,
  QUADRANT_Q1_ID,
  QUADRANT_Q2_ID,
  Q1_STRICT_TERMINAL_CARD,
  isArkReplyAcceptable,
  completenessOptionsForCard,
  completenessOptionsForQuadrant,
  assessArkReplyForCard,
  endsWithTerminalPunctuation,
};
