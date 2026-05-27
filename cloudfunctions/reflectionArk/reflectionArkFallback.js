"use strict";

const ALL_FALLBACK_LINES = require("./reflectionFallbackTexts");

/** API 失败时写入响应的短标记（报告展示以小程序六套表为准） */
const FALLBACK_REPLY = "用心觉察自我，安然面对日常点滴。";

const FALLBACK_SET = new Set(ALL_FALLBACK_LINES);

/**
 * @param {"xiaoqi"|"xiaolin"|string} _agentType
 * @returns {string}
 */
function getFallbackReply(_agentType) {
  return FALLBACK_REPLY;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function isFallbackReply(text) {
  return FALLBACK_SET.has(String(text || "").trim());
}

module.exports = {
  getFallbackReply,
  isFallbackReply,
  FALLBACK_REPLY,
};
