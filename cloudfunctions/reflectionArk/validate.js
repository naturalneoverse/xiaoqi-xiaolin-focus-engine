"use strict";

const VALID_CARD_FIELDS = new Set([
  "c0",
  "c1",
  "c2",
  "c2_experience",
  "c2_feeling",
  "c2_decision",
]);

/** 观实归真题干兜底 */
const Q1_DEFAULT_QUESTIONS = {
  c0: "这件事，和你想的一样吗？",
  c1: "做这件事的时候，你在哪里？",
  c2: "这件事，去掉你的评价，还剩下什么？",
};

/** 观心明己题干兜底（客户端未传 question 时，与 reflectionQuadrantCards 一致） */
const Q2_DEFAULT_QUESTIONS = {
  c0: "这件事有什么让你觉得「卡住了」？",
  c1: "这件事，碰到了你心里的哪根弦？",
  c2: "在这件事里，你觉得什么是你真正在意的？",
};

const Q3_DEFAULT_QUESTIONS = {
  c0: "这件事里，哪些是你自己的课题，哪些是别人的？",
  c1: "这件事里，你有没有为了被认可而做？",
  c2: "放下不属于你的，你最想做什么，怎么做？",
};

/** 踏实前行题干兜底 */
const Q4_DEFAULT_QUESTIONS = {
  c0: "如果时间有限，今天最值得你亲自做的一件事是什么？",
  c1: "明天，你打算怎么开始？",
  c2_experience: "带给自己一个经验",
  c2_feeling: "带给自己一个感受",
  c2_decision: "带给自己一个决定",
};

/**
 * @param {object} p
 * @returns {{ ok: boolean, errCode?: string, payload?: object }}
 */
function validateGenerateReplyParams(p) {
  const taskId = String((p && p.taskId) || "").trim();
  const quadrantId = Number(p && p.quadrantId);
  const cardField = String((p && p.cardField) || "").trim();
  const userText = String((p && p.userText) || "");
  const agentType = String((p && p.agentType) || "").toLowerCase();
  const taskTitle =
    p && p.taskTitle != null ? String(p.taskTitle).trim() || "未命名任务" : "";
  const question = p && p.question != null ? String(p.question).trim() : "";

  if (!taskId) return { ok: false, errCode: "INVALID_TASK_ID" };
  if (![1, 2, 3, 4].includes(quadrantId)) return { ok: false, errCode: "INVALID_QUADRANT" };
  if (!VALID_CARD_FIELDS.has(cardField)) return { ok: false, errCode: "INVALID_CARD_FIELD" };
  if (!userText.trim()) return { ok: false, errCode: "EMPTY_USER_TEXT" };
  if (agentType !== "xiaoqi" && agentType !== "xiaolin") return { ok: false, errCode: "INVALID_AGENT" };

  return {
    ok: true,
    payload: { taskId, quadrantId, cardField, userText, agentType, taskTitle, question },
  };
}

/**
 * @param {object} event
 * @returns {{ ok: boolean, errCode?: string, payload?: object }}
 */
function validateGenerateQuadrantBatchParams(event) {
  const taskId = String((event && event.taskId) || "").trim();
  const quadrantId = Number(event && event.quadrantId);
  const rawItems = event && event.items;

  if (!taskId) return { ok: false, errCode: "INVALID_TASK_ID" };
  if (![1, 2, 3, 4].includes(quadrantId)) return { ok: false, errCode: "INVALID_QUADRANT" };
  if (!Array.isArray(rawItems) || !rawItems.length) return { ok: false, errCode: "EMPTY_ITEMS" };

  const isQ1 = quadrantId === 1;
  const isQ2 = quadrantId === 2;
  const isQ3 = quadrantId === 3;
  const isQ4 = quadrantId === 4;
  const needsMeta = isQ1 || isQ2 || isQ3 || isQ4;
  const taskTitle = needsMeta
    ? String((event && event.taskTitle) || "").trim() || "未命名任务"
    : "";
  const defaultQuestions = isQ1
    ? Q1_DEFAULT_QUESTIONS
    : isQ2
      ? Q2_DEFAULT_QUESTIONS
      : isQ3
        ? Q3_DEFAULT_QUESTIONS
        : isQ4
          ? Q4_DEFAULT_QUESTIONS
          : null;

  const items = [];
  for (let i = 0; i < rawItems.length; i++) {
    const row = rawItems[i] || {};
    const v = validateGenerateReplyParams({
      taskId,
      quadrantId,
      cardField: row.cardField,
      userText: row.userText,
      agentType: row.agentType,
    });
    if (!v.ok) return { ok: false, errCode: v.errCode || "INVALID_ITEM" };
    const payload = Object.assign({}, v.payload);
    if (needsMeta && defaultQuestions) {
      let q = String(row.question || "").trim();
      if (!q) {
        q = defaultQuestions[payload.cardField] || "";
      }
      if (!q) return { ok: false, errCode: "INVALID_ITEM" };
      payload.question = q;
    }
    if (needsMeta) {
      payload.taskTitle = taskTitle;
    }
    items.push(payload);
  }

  const forceRegenerate = !!(event && event.forceRegenerate);
  const payload = { taskId, quadrantId, items, forceRegenerate };
  if (needsMeta) {
    payload.taskTitle = taskTitle;
  }

  return { ok: true, payload };
}

module.exports = {
  validateGenerateReplyParams,
  validateGenerateQuadrantBatchParams,
  VALID_CARD_FIELDS,
  Q1_DEFAULT_QUESTIONS,
  Q2_DEFAULT_QUESTIONS,
  Q3_DEFAULT_QUESTIONS,
  Q4_DEFAULT_QUESTIONS,
};
