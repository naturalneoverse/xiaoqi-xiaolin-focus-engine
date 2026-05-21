/**
 * 哲思报告页专用温和兜底（与云函数 reflectionArkFallback 一致）
 */

const { getQuadrantMeta } = require("./reflectionTheme");

const FALLBACK_REPLY = "用心觉察自我，安然面对日常点滴。";

/**
 * @param {"xiaoqi"|"xiaolin"|string} agentType
 * @returns {string}
 */
function getFallbackReply(agentType) {
  return FALLBACK_REPLY;
}

/**
 * @param {number} quadrantId
 * @returns {string}
 */
function getFallbackReplyForQuadrant(quadrantId) {
  const meta = getQuadrantMeta(quadrantId);
  return getFallbackReply(meta && meta.agent ? meta.agent : "xiaolin");
}

module.exports = {
  FALLBACK_REPLY,
  getFallbackReply,
  getFallbackReplyForQuadrant,
};
