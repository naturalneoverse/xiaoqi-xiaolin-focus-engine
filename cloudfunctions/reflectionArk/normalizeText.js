"use strict";

/**
 * 哈希前文本归一化（对齐联调文档 §9.3）
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text) {
  let s = String(text || "");
  s = s.trim();
  s = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  s = s.replace(/[ \t\f\v]+/g, " ");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

/** @param {string} text */
function charCount(text) {
  return Array.from(String(text || "")).length;
}

module.exports = { normalizeText, charCount };
