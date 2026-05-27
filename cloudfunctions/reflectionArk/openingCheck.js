"use strict";

const { getAgentKeyword, getPersonaSystem, isValidAgentType } = require("./personas");
const { enforceReplyLength, enforceReplyLengthQ2Soft } = require("./replyLength");
const { getReplyLengthBounds } = require("./replyLengthPolicy");
const {
  isArkReplyAcceptable,
  completenessOptionsForCard,
  patchStrictTerminalEnd,
} = require("./replyCompleteness");
const { ARK_Q2_SOFT_MAX } = require("./constants");
const { QUADRANT_Q2_ID } = require("./constants");
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
 * 后处理：剥离开篇套话 + 按档位截断（观心明己用严格截断）
 * @param {string} raw
 * @param {"xiaoqi"|"xiaolin"|string} agentType
 * @param {string} [userText]
 * @param {number} [quadrantId]
 * @returns {string}
 */
function finalizeReplyContent(raw, agentType, userText, quadrantId) {
  const bounds = getReplyLengthBounds(userText, quadrantId);
  let text = stripLegacyOpening(String(raw || ""), agentType);
  if (Number(quadrantId) === QUADRANT_Q2_ID) {
    const soft = enforceReplyLengthQ2Soft(text, bounds);
    return soft.ok ? soft.text : "";
  }
  return enforceReplyLength(text, bounds, { neverPad: true });
}

/**
 * finalize + 完整性验收（供 generateReply 使用）
 * @param {string} raw
 * @param {"xiaoqi"|"xiaolin"|string} agentType
 * @param {string} [userText]
 * @param {number} [quadrantId]
 * @param {string} [cardField] 缺省时不启用 Q1·c2 末字严格（防误伤 c0）
 * @returns {{ text: string, ok: boolean, reason?: string }}
 */
function finalizeAndAssessReply(raw, agentType, userText, quadrantId, cardField) {
  const bounds = getReplyLengthBounds(userText, quadrantId);
  let text = finalizeReplyContent(raw, agentType, userText, quadrantId);
  if (Number(quadrantId) === QUADRANT_Q2_ID && !text) {
    return { text: "", ok: false, reason: "TRUNCATE_NO_SENTENCE_END" };
  }
  const completenessOpts = completenessOptionsForCard(quadrantId, cardField);
  text = patchStrictTerminalEnd(text, completenessOpts);
  if (Number(quadrantId) === QUADRANT_Q2_ID) {
    const softCap =
      bounds.softMax != null ? Number(bounds.softMax) : ARK_Q2_SOFT_MAX;
    if (charCount(text) > softCap + 2) {
      return { text: "", ok: false, reason: "TOO_LONG" };
    }
  }
  const assessment = isArkReplyAcceptable(text, completenessOpts);
  return {
    text,
    ok: assessment.ok,
    reason: assessment.reason,
  };
}

module.exports = {
  PERSONA_REQUIRED_SECTIONS,
  validatePersonaSystem,
  finalizeReplyContent,
  finalizeAndAssessReply,
};
