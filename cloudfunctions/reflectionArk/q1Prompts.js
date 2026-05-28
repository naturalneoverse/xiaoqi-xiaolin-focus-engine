"use strict";

const { getPersonaSystem } = require("./personas");
const { getReplyLengthBounds } = require("./replyLengthPolicy");
const { desensitize } = require("./desensitize");
const { buildTextHash } = require("./textHash");

const Q1_CORE_RULES = `【观实归真·硬性约束·最高优先级】
1. 信息边界：仅依据用户当前题目下的原文（手写或单选选项）、任务标题、本题题干作答。禁止脑补身份、场景、对话、他人言行、过往经历、未提及的动机。禁止「您一定」「您多半」「想必」等揣测句式。
2. 输出形态：哲思复盘报告文风，温润舒缓、向内觉察；一段成文。禁止自问自答、「对吗/是吗」、禁止模型第一人称。称呼用户一律「您」。
3. 建议表述：落地参考 0–2 条即可，若有多条依次以「您可以尝试」「也可以尝试」起句，不重复使用同一句式，温和不命令；观实象限以看见与接纳为主，不必给行动清单。
4. 叙述结构（单段内自然衔接，勿标号）：先承接用户原文关键词→区分事实与解读/看见真实→温和收束。
5. 篇幅：严格遵守用户消息中的字数区间；用户写得短则回应同步精简，禁止为凑字数编造细节。
6. 解读须紧扣用户原文实词；无实词支撑的发挥一律禁止。`;

const Q1_CARD_FOCUS = {
  c0: `【本题重心·c0】回应「这件事，和你想的一样吗」：帮用户看见「预期/以为」与「实际发生」的差异，复述用户已写事实，不替用户下道德判断，不编造未出现的冲突细节。`,
  c1: `【本题重心·c1】回应「做这件事的时候，你在哪里」：仅依据【用户选择】中的选项含义解读其投入状态（全心/按部就班/心不在焉/勉强），不假设未选选项，不编造他人评价。`,
  c2: `【本题重心·c2】回应「去掉你的评价，还剩下什么」：帮用户收束到「还剩下的事实/感受」，禁止替用户归因「您一定是因为…」，禁止引用 c0/c1 独有细节。`,
};

function getQ1PersonaSystem() {
  return `${getPersonaSystem("xiaolin")}\n\n${Q1_CORE_RULES}`;
}

function getQ1CardFocus(cardField) {
  return Q1_CARD_FOCUS[String(cardField || "")] || "";
}

function formatLengthLine(bounds) {
  return `- 正文字数 ${bounds.min}–${bounds.max} 字（${bounds.tier || "q1"}，宜精炼，禁止编造细节）`;
}

/**
 * @param {string} taskTitle
 * @param {string} question
 * @param {string} userText
 * @param {string} cardField
 */
function buildQ1CardUserContent(taskTitle, question, userText, cardField) {
  const focus = getQ1CardFocus(cardField);
  const { normalized } = buildTextHash(userText);
  const bounds = getReplyLengthBounds(normalized, 1);
  return [
    "【哲思复盘·观实归真】",
    focus,
    `【任务】${String(taskTitle || "未命名任务").trim()}`,
    `【题目】${String(question || "").trim()}`,
    "【用户输入】（已脱敏）",
    desensitize(normalized),
    "",
    "【要求】",
    "- 紧扣本题与用户输入，一段成文回应",
    formatLengthLine(bounds),
    "- 语义完整、句号或完整引用收束",
    "- 只输出回应正文，不要标题、列表、JSON、「小麟说：」等前缀",
  ].join("\n");
}

module.exports = {
  getQ1PersonaSystem,
  buildQ1CardUserContent,
};
