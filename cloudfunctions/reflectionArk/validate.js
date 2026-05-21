"use strict";

const VALID_CARD_FIELDS = new Set([
  "c0",
  "c1",
  "c2",
  "c2_experience",
  "c2_feeling",
  "c2_decision",
]);

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

  if (!taskId) return { ok: false, errCode: "INVALID_TASK_ID" };
  if (![1, 2, 3, 4].includes(quadrantId)) return { ok: false, errCode: "INVALID_QUADRANT" };
  if (!VALID_CARD_FIELDS.has(cardField)) return { ok: false, errCode: "INVALID_CARD_FIELD" };
  if (!userText.trim()) return { ok: false, errCode: "EMPTY_USER_TEXT" };
  if (agentType !== "xiaoqi" && agentType !== "xiaolin") return { ok: false, errCode: "INVALID_AGENT" };

  return {
    ok: true,
    payload: { taskId, quadrantId, cardField, userText, agentType },
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
    items.push(v.payload);
  }

  return { ok: true, payload: { taskId, quadrantId, items } };
}

module.exports = {
  validateGenerateReplyParams,
  validateGenerateQuadrantBatchParams,
  VALID_CARD_FIELDS,
};
