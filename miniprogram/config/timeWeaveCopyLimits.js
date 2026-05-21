/**
 * 时间编织 · 小麟文案字数定稿（含句号、含逗号，按码点计）
 * 气泡展示：按 ，、； 分行居中，单行约可排 ≥15 字，开场 2 行 + 正文 2 行共 4 行为宜
 */

/** @param {string} text */
function countCopyChars(text) {
  return [...String(text || "").trim()].length;
}

/** 固定开场 4 条（与 timeWeaveOpening.js 下标一致） */
const OPENING_CHAR_LENGTHS = [18, 16, 12, 22];

/** 正文 copyKey → 单条统一字数 */
const BODY_CHAR_LENGTH_BY_KEY = {
  oneSelf: 18,
  depthSlow: 20,
  depthFast: 20,
  connection: 18,
  roleDuty: 20,
  calmBusy: 18,
  calmEasy: 18,
};

/** 气泡分行后，建议单段（逗号前/后）不超过此字数，避免挤版 */
const BUBBLE_LINE_CHAR_HINT = 15;

module.exports = {
  countCopyChars,
  OPENING_CHAR_LENGTHS,
  BODY_CHAR_LENGTH_BY_KEY,
  BUBBLE_LINE_CHAR_HINT,
};
