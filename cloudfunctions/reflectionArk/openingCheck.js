"use strict";

const { getAgentKeyword, getPersonaSystem, isValidAgentType } = require("./personas");
const { enforceReplyLength, validateReplyLengthRange } = require("./replyLength");
const { getReplyLengthBounds } = require("./replyLengthPolicy");
const { charCount } = require("./normalizeText");
const { stripLegacyOpening } = require("./stripLegacyOpening");

/** system 提示词必须包含的章节锚点 */
const PERSONA_REQUIRED_SECTIONS = ["思想根基", "报告展示", "输出硬性要求"];

/**
 * 校验 personas.js 完整性与角色关键词
 * @param {"xiaoqi"|"xiaolin"|string} [agentType]
 * @returns {{ ok: boolean, reason?: string }}
 */
function validatePersonaSystem(agentType) {
  const types = agentType ? [String(agentType).toLowerCase()] : ["xiaoqi", "xiaolin"];
  for (let i = 0; i < types.length; i++) {
    const t = types[i];
    if (!isValidAgentType(t)) return { ok: false, reason: "INVALID_AGENT" };
    const sys = getPersonaSystem(t);
    if (!sys || charCount(sys) < 200) {
      return { ok: false, reason: "SYSTEM_TOO_SHORT" };
    }
    const keyword = getAgentKeyword(t);
    if (sys.indexOf(keyword) < 0) {
      return { ok: false, reason: "SYSTEM_MISSING_KEYWORD" };
    }
    for (let j = 0; j < PERSONA_REQUIRED_SECTIONS.length; j++) {
      const sec = PERSONA_REQUIRED_SECTIONS[j];
      if (sys.indexOf(sec) < 0) {
        return { ok: false, reason: `SYSTEM_MISSING_${sec}` };
      }
    }
    if (sys.indexOf("emoji") < 0 && sys.indexOf("禁止") < 0) {
      return { ok: false, reason: "SYSTEM_MISSING_OUTPUT_RULES" };
    }
  }
  return { ok: true };
}

/**
 * 后处理：剥离开篇套话 + 按用户输入长度约束正文字数
 * @param {string} raw
 * @param {"xiaoqi"|"xiaolin"|string} agentType
 * @param {string} [userText]
 * @returns {string}
 */
function finalizeReplyContent(raw, agentType, userText) {
  const bounds = getReplyLengthBounds(userText);
  let text = stripLegacyOpening(String(raw || ""), agentType);
  text = enforceReplyLength(text, bounds);
  if (!validateReplyLengthRange(text, bounds).ok) {
    text = enforceReplyLength(text, bounds);
  }
  return text;
}

module.exports = {
  PERSONA_REQUIRED_SECTIONS,
  validatePersonaSystem,
  finalizeReplyContent,
};
