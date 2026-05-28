"use strict";

const { getPersonaSystem } = require("./personas");
const { getReplyLengthBounds } = require("./replyLengthPolicy");
const { desensitize } = require("./desensitize");
const { buildTextHash } = require("./textHash");

/** 观心明己 · 防幻觉与输出底线（叠加小麟人设，优先级高于扩写倾向） */
const Q2_CORE_RULES = `【观心明己·硬性约束·最高优先级】
1. 信息边界：仅依据用户当前题目下的手写原文、任务标题、本题题干作答。禁止脑补身份、年龄、场景、对话、他人具体言行、过往经历、未提及的情绪与动机。禁止「您一定」「您多半」「想必」「孩子大概」等揣测句式。
2. 输出形态：哲思复盘报告文风，温暖陪伴、适度正式；一段成文。禁止自问自答、「对吗/是吗」类确认句、禁止「我认为/我的想法」等模型第一人称。称呼用户一律「您」。
3. 建议表述：落地参考 1–3 条均可，若有多条依次以「您可以尝试」「也可以尝试」「或者试着」起句，不重复使用同一句式，不命令、不断言、不替用户做决定。
4. 叙述结构（单段内自然衔接，勿标号）：先承接用户原文关键词→解读已写出的卡点/感受/在意→温和落地参考。
5. 篇幅：严格遵守用户消息中的字数区间；用户写得短则回应同步精简，不凑字、不扩写无关内容。
6. 解读须能对应用户原文实词；无实词支撑的发挥一律禁止。用户未提专业/职业/领域时，不给领域化建议。`;

const Q2_CARD_FOCUS = {
  c0: `【本题重心·c0】回应「哪里卡住了」：客观复述用户已写的显性卡点，温和解读停滞/压力/两难，给 1–3 条最小可行参考（依次以「您可以尝试」「也可以尝试」「或者试着」起句）。禁止编造具体场景画面。`,
  c1: `【本题重心·c1】回应「碰到哪根弦」：基于本题手写中的情绪与感受词做觉察与陪伴，不臆断弦的名称、不编造关系史。禁止引用其他题目手写中的细节。`,
  c2: `【本题重心·c2】回应「真正在意什么」：提炼用户已表达的核心在意/价值，不强行定义、不升华到用户未说的层面。禁止引用其他题目手写中的细节。`,
};

const Q2_STAGE_B_C0_RULES = `【阶段 B·跨题上下文】
下方 c0 仅供理解同一任务背景，勿回应 c0，勿在 c1/c2 正文中重复或引用 c0 独有细节（c0 有而 c1/c2 未出现的词句、场景、人物行为一律不得写入 c1/c2）。c1 仅依据「c1 用户手写」；c2 仅依据「c2 用户手写」。`;

/**
 * @returns {string}
 */
function getQ2PersonaSystem() {
  const base = getPersonaSystem("xiaolin");
  return `${base}\n\n${Q2_CORE_RULES}`;
}

/**
 * @param {string} cardField
 * @returns {string}
 */
function getQ2CardFocus(cardField) {
  return Q2_CARD_FOCUS[String(cardField || "")] || "";
}

/**
 * @param {{ min: number, max: number, tier?: string }} bounds
 * @returns {string}
 */
function formatQ2LengthLine(bounds) {
  return `- 正文字数 ${bounds.min}–${bounds.max} 字（档位的 ${bounds.tier || "q2"}，宜精炼，禁止为凑字数编造细节）`;
}

/**
 * @param {string} taskTitle
 * @param {string} question
 * @param {string} userText
 * @returns {string}
 */
function buildStageAUserContent(taskTitle, question, userText) {
  const { normalized } = buildTextHash(userText);
  const bounds = getReplyLengthBounds(normalized, 2);
  return [
    "【哲思复盘·观心明己·c0】",
    getQ2CardFocus("c0"),
    `【任务】${String(taskTitle || "未命名任务").trim()}`,
    `【题目】${String(question || "").trim()}`,
    "【用户手写】（已脱敏）",
    desensitize(normalized),
    "",
    "【要求】",
    "- 紧扣本题与用户手写，一段成文回应",
    formatQ2LengthLine(bounds),
    "- 语义完整、句号或完整引用收束",
    "- 只输出回应正文，不要标题、列表、JSON、「小麟说：」等前缀",
  ].join("\n");
}

/**
 * @param {string} taskTitle
 * @param {object} byField
 * @returns {string}
 */
function buildStageBUserContent(taskTitle, byField) {
  const c0 = byField.c0;
  const c1 = byField.c1;
  const c2 = byField.c2;
  const c0Norm = buildTextHash(c0.userText).normalized;
  const c1Norm = buildTextHash(c1.userText).normalized;
  const c2Norm = buildTextHash(c2.userText).normalized;
  const boundsC1 = getReplyLengthBounds(c1Norm, 2);
  const boundsC2 = getReplyLengthBounds(c2Norm, 2);

  return [
    "【哲思复盘·观心明己·c1与c2】",
    Q2_STAGE_B_C0_RULES,
    getQ2CardFocus("c1"),
    getQ2CardFocus("c2"),
    `【任务】${String(taskTitle || "未命名任务").trim()}`,
    "",
    `【c0 题目】${String(c0.question || "").trim()}`,
    `【c0 用户手写】${desensitize(c0Norm)}`,
    "（勿回应 c0；c1/c2 禁止引用此处独有细节）",
    "",
    `【c1 题目】${String(c1.question || "").trim()}`,
    `【c1 用户手写】${desensitize(c1Norm)}`,
    "",
    `【c2 题目】${String(c2.question || "").trim()}`,
    `【c2 用户手写】${desensitize(c2Norm)}`,
    "",
    "【输出格式·必须严格遵守】",
    "先输出一行：===c1===",
    `接着 c1 回应正文（一段；${boundsC1.min}–${boundsC1.max} 字，宜精炼，禁止编造细节）`,
    "再输出一行：===c2===",
    `接着 c2 回应正文（一段；${boundsC2.min}–${boundsC2.max} 字，宜精炼，禁止编造细节）`,
    "禁止输出 ===c0===；禁止 JSON；禁止「小麟说：」前缀",
    "",
    "【格式示例·仅结构参考，勿照抄内容】",
    "===c1===",
    "（此处为 c1 回应正文）",
    "===c2===",
    "（此处为 c2 回应正文）",
  ].join("\n");
}

module.exports = {
  Q2_CORE_RULES,
  Q2_STAGE_B_C0_RULES,
  getQ2PersonaSystem,
  getQ2CardFocus,
  buildStageAUserContent,
  buildStageBUserContent,
};
