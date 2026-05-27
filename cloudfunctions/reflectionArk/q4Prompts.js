"use strict";

const { getPersonaSystem } = require("./personas");
const { getReplyLengthBounds } = require("./replyLengthPolicy");
const { desensitize } = require("./desensitize");
const { buildTextHash } = require("./textHash");

const Q4_CORE_RULES = `【踏实前行·硬性约束·最高优先级】
1. 信息边界：仅依据用户当前题目下的原文、任务标题、本题题干作答。禁止脑补身份、场景、对话、他人言行、未提及的动机。禁止「您一定」「您多半」「想必」等揣测句式。
2. 输出形态：哲思复盘报告文风，利落正向、沉稳接地气；可带一点小麒式轻松幽默（一句生活化比喻或半句调侃即可，温而不油、短而有味，勿段子化、勿低俗），一段成文。禁止自问自答、禁止模型第一人称。称呼用户一律「您」。
3. 建议表述：落地参考 1–3 条均可，每条以「您可以尝试」起句，步子要小、可执行，不命令、不断言。
4. 叙述结构（单段内自然衔接，勿标号）：先承接用户原文关键词→点出「值得做/明天第一步/带走的经验·感受·决定」→温和落地参考。
5. 篇幅：严格遵守用户消息中的字数区间；用户写得短则回应同步精简，禁止为凑字数编造细节。
6. 解读须紧扣用户原文实词；无实词支撑的发挥一律禁止。`;

const Q4_CARD_FOCUS = {
  c0: `【本题重心·c0】回应「时间有限，今天最值得亲自做的一件事」：帮用户锚定优先级，基于原文，不编造日程与他人安排。`,
  c1: `【本题重心·c1】回应「明天，打算怎么开始」：承接用户写下的第一步，1–3 条极轻量「您可以尝试」，禁止长篇方法论。`,
  c2_experience: `【本题重心·c2·经验】紧扣用户写下的经验收获，禁止与感受/决定混写成鸡汤。`,
  c2_feeling: `【本题重心·c2·感受】紧扣用户写下的难忘感受，禁止编造场景细节。`,
  c2_decision: `【本题重心·c2·决定】紧扣用户写下的决定，禁止断言「您一定能」。`,
};

function getQ4PersonaSystem() {
  return `${getPersonaSystem("xiaoqi")}\n\n${Q4_CORE_RULES}`;
}

function getQ4CardFocus(cardField) {
  return Q4_CARD_FOCUS[String(cardField || "")] || "";
}

function formatLengthLine(bounds) {
  return `- 正文字数 ${bounds.min}–${bounds.max} 字（${bounds.tier || "q4"}，宜精炼，禁止编造细节）`;
}

/**
 * @param {string} taskTitle
 * @param {string} question
 * @param {string} userText
 * @param {string} cardField
 */
function buildQ4CardUserContent(taskTitle, question, userText, cardField) {
  const { normalized } = buildTextHash(userText);
  const bounds = getReplyLengthBounds(normalized, 4);
  return [
    "【哲思复盘·踏实前行】",
    getQ4CardFocus(cardField),
    `【任务】${String(taskTitle || "未命名任务").trim()}`,
    `【题目】${String(question || "").trim()}`,
    "【用户手写】（已脱敏）",
    desensitize(normalized),
    "",
    "【要求】",
    "- 紧扣本题与用户手写，一段成文回应",
    formatLengthLine(bounds),
    "- 语义完整、句号或完整引用收束",
    "- 只输出回应正文，不要标题、列表、JSON、「小麒说：」等前缀",
  ].join("\n");
}

module.exports = {
  getQ4PersonaSystem,
  buildQ4CardUserContent,
};
