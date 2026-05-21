"use strict";

const { charCount } = require("./normalizeText");
const { REPLY_MIN_CHARS, REPLY_MAX_CHARS } = require("./constants");

/**
 * 按用户手写长度推算 AI 正文字数区间（报告页另有「小麒说：/小麟说：」前缀）
 * @param {string} userText
 * @returns {{ min: number, max: number, tier: string }}
 */
function getReplyLengthBounds(userText) {
  const n = charCount(String(userText || "").trim());
  if (n <= 4) {
    return { min: 28, max: 64, tier: "xs" };
  }
  if (n <= 12) {
    return { min: 48, max: 96, tier: "s" };
  }
  if (n <= 30) {
    return { min: 80, max: 140, tier: "m" };
  }
  if (n <= 80) {
    return { min: 120, max: 200, tier: "l" };
  }
  return { min: REPLY_MIN_CHARS, max: REPLY_MAX_CHARS, tier: "xl" };
}

module.exports = { getReplyLengthBounds };
