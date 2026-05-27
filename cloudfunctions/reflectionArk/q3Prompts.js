"use strict";

const { getPersonaSystem } = require("./personas");
const { getReplyLengthBounds } = require("./replyLengthPolicy");
const { desensitize } = require("./desensitize");
const { buildTextHash } = require("./textHash");

/** 自我主宰 · 防幻觉（叠加小麒人设） */
const Q3_CORE_RULES = `【自我主宰·硬性约束·最高优先级】
1. 信息边界：仅依据用户当前题目下的原文（手写或单选选项）、任务标题、本题题干作答。禁止脑补身份、场景、对话、他人言行、过往经历、未提及的动机。禁止「您一定」「您多半」「想必」等揣测句式。
2. 输出形态：哲思复盘报告文风，温暖陪伴、利落正向、适度正式；一段成文。禁止自问自答、「对吗/是吗」、禁止模型第一人称。称呼用户一律「您」。
3. 建议表述：落地参考 1–3 条均可，每条以「您可以尝试」起句（与小麒语气一致），不命令、不断言。
4. 叙述结构（单段内自然衔接，勿标号）：先承接用户原文关键词→解读课题边界/认可动机/行动意图→温和落地参考。
5. 篇幅：严格遵守用户消息中的字数区间；用户写得短则回应同步精简，禁止为凑字数编造细节。
6. 解读须紧扣用户原文实词；无实词支撑的发挥一律禁止。`;

const Q3_CARD_FOCUS = {
  c0: `【本题重心·c0】回应「哪些是你的课题，哪些是别人的」：复述用户已写划分，温和点出边界，1–3 条「您可以尝试」的边界行动参考。禁止编造具体冲突场景。`,
  c1: `【本题重心·c1】回应「是否为被认可而做」：仅依据【用户选择】中的选项含义解读，不假设未选选项，不编造他人评价场景。禁止引用 c0/c2 独有细节。`,
  c2: `【本题重心·c2】回应「放下后最想做什么、怎么做」：承接用户写下的放下与第一步，1–3 条轻量行动参考。禁止编造日程、资源、未提到的他人。禁止引用 c0/c1 独有细节。`,
};

const Q3_STAGE_B_C0_RULES = `【阶段 B·跨题上下文】
下方 c0 仅供理解任务背景，勿回应 c0。c1 仅依据「c1 用户输入」；c2 仅依据「c2 用户手写」。禁止在 c1/c2 中写入 c0 独有词句或场景。`;

function getQ3PersonaSystem() {
  return `${getPersonaSystem("xiaoqi")}\n\n${Q3_CORE_RULES}`;
}

function getQ3CardFocus(cardField) {
  return Q3_CARD_FOCUS[String(cardField || "")] || "";
}

function formatLengthLine(bounds) {
  return `- 正文字数 ${bounds.min}–${bounds.max} 字（${bounds.tier || "q3"}，宜精炼，禁止编造细节）`;
}

function buildStageAUserContent(taskTitle, question, userText) {
  const { normalized } = buildTextHash(userText);
  const bounds = getReplyLengthBounds(normalized, 3);
  return [
    "【哲思复盘·自我主宰·c0】",
    getQ3CardFocus("c0"),
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

function buildStageBUserContent(taskTitle, byField) {
  const c0 = byField.c0;
  const c1 = byField.c1;
  const c2 = byField.c2;
  const c0Norm = buildTextHash(c0.userText).normalized;
  const c1Norm = buildTextHash(c1.userText).normalized;
  const c2Norm = buildTextHash(c2.userText).normalized;
  const boundsC1 = getReplyLengthBounds(c1Norm, 3);
  const boundsC2 = getReplyLengthBounds(c2Norm, 3);

  return [
    "【哲思复盘·自我主宰·c1与c2】",
    Q3_STAGE_B_C0_RULES,
    getQ3CardFocus("c1"),
    getQ3CardFocus("c2"),
    `【任务】${String(taskTitle || "未命名任务").trim()}`,
    "",
    `【c0 题目】${String(c0.question || "").trim()}`,
    `【c0 用户手写】${desensitize(c0Norm)}`,
    "（勿回应 c0；c1/c2 禁止引用此处独有细节）",
    "",
    `【c1 题目】${String(c1.question || "").trim()}`,
    `【c1 用户输入】${desensitize(c1Norm)}`,
    "",
    `【c2 题目】${String(c2.question || "").trim()}`,
    `【c2 用户手写】${desensitize(c2Norm)}`,
    "",
    "【输出格式·必须严格遵守】",
    "先输出一行：===c1===",
    `接着 c1 回应正文（一段；${boundsC1.min}–${boundsC1.max} 字，宜精炼，禁止编造细节）`,
    "再输出一行：===c2===",
    `接着 c2 回应正文（一段；${boundsC2.min}–${boundsC2.max} 字，宜精炼，禁止编造细节）`,
    "禁止输出 ===c0===；禁止 JSON；禁止「小麒说：」前缀",
    "",
    "【格式示例·仅结构参考，勿照抄内容】",
    "===c1===",
    "（此处为 c1 回应正文）",
    "===c2===",
    "（此处为 c2 回应正文）",
  ].join("\n");
}

module.exports = {
  getQ3PersonaSystem,
  buildStageAUserContent,
  buildStageBUserContent,
};
