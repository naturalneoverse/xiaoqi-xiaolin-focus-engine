"use strict";

/** 温和兜底（报告页展示层会加「小麒说：/小麟说：」前缀） */
const FALLBACK_REPLY = "用心觉察自我，安然面对日常点滴。";

/**
 * @param {"xiaoqi"|"xiaolin"|string} agentType
 * @returns {string}
 */
function getFallbackReply(agentType) {
  return FALLBACK_REPLY;
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function isFallbackReply(text) {
  return String(text || "").trim() === FALLBACK_REPLY;
}

module.exports = {
  getFallbackReply,
  isFallbackReply,
  FALLBACK_REPLY,
};
