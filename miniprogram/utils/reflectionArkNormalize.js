/**
 * 与云函数 normalizeText.js 保持一致（哈希对齐）
 */

function normalizeText(text) {
  let s = String(text || "");
  s = s.trim();
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  s = s.replace(/[ \t\f\v]+/g, " ");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

function charCount(text) {
  return Array.from(String(text || "")).length;
}

module.exports = {
  normalizeText,
  charCount,
};
