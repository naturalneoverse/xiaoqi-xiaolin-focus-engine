"use strict";

const { handleGenerateReply } = require("./generateReply");
const { handleGenerateQuadrantQ2S2 } = require("./generateQuadrantQ2S2");
const { handleGenerateQuadrantQ3S2 } = require("./generateQuadrantQ3S2");
const { validateGenerateQuadrantBatchParams } = require("./validate");
const { logEvent } = require("./logger");
const {
  ARK_TIMEOUT_MS,
  ARK_BATCH_WALL_BUDGET_MS,
  QUADRANT_Q2_ID,
  QUADRANT_Q3_ID,
} = require("./constants");

/** 观心明己批量层：整卡再跑 1 次（P6，与 ARK_TIMEOUT 并列） */
const Q2_BATCH_INCOMPLETE_RETRY_CODES = new Set([
  "REPLY_INCOMPLETE",
  "TRUNCATE_NO_SENTENCE_END",
  "NO_TERMINAL_END",
  "NO_SENTENCE_END",
  "DANGLING_ENDING",
  "UNCLOSED_QUOTE",
  "TOO_SHORT_DISPLAY",
  "REPLY_BLOCKED_BEFORE_CACHE",
]);

/**
 * 批量串行后是否对该卡再跑一整轮 handleGenerateReply
 * @param {object} [row]
 * @param {number} quadrantId
 * @returns {boolean}
 */
function isBatchCardRetryable(row, quadrantId) {
  if (!row || !row.fallback) return false;
  const code = String(row.errCode || "");
  if (code === "ARK_TIMEOUT") return true;
  if (Number(quadrantId) !== QUADRANT_Q2_ID && Number(quadrantId) !== QUADRANT_Q3_ID) {
    return false;
  }
  return Q2_BATCH_INCOMPLETE_RETRY_CODES.has(code);
}

/**
 * 串行批量：按张数分配单卡超时（总时长须 < 云函数 60s）
 * @param {number} itemCount
 * @returns {number}
 */
function computeBatchCardTimeoutMs(itemCount) {
  const n = Math.max(1, Number(itemCount) || 1);
  const perCard = Math.floor(ARK_BATCH_WALL_BUDGET_MS / n);
  const minPerCard = n >= 4 ? 9000 : 12000;
  return Math.min(ARK_TIMEOUT_MS, Math.max(minPerCard, perCard));
}

/**
 * @param {object} db
 * @param {object} item
 * @param {object} ctx
 */
function runOneCard(db, item, ctx) {
  return handleGenerateReply(
    db,
    {
      taskId: ctx.taskId,
      quadrantId: ctx.quadrantId,
      cardField: item.cardField,
      userText: item.userText,
      agentType: item.agentType,
      taskTitle: item.taskTitle || ctx.taskTitle,
      question: item.question,
    },
    {
      arkTimeoutMs: ctx.arkTimeoutMs,
      allowRetryOnce: false,
    },
  );
}

/**
 * 单象限多卡：串行生成 + 失败卡整卡再试一次
 * - 全象限：ARK_TIMEOUT
 * - 仅观心明己：截断/验收不完整（REPLY_INCOMPLETE 等）
 * - 观实归真 Q1·c2 末字无句号（NO_TERMINAL_END）不在此重试（R2，无 R2b）
 * @param {object} db
 * @param {object} event
 */
async function handleGenerateQuadrantBatch(db, event) {
  const v = validateGenerateQuadrantBatchParams(event);
  if (!v.ok) {
    return { ok: false, errCode: v.errCode };
  }

  const { taskId, quadrantId, items } = v.payload;

  if (Number(quadrantId) === QUADRANT_Q2_ID) {
    return handleGenerateQuadrantQ2S2(db, event);
  }
  if (Number(quadrantId) === QUADRANT_Q3_ID) {
    return handleGenerateQuadrantQ3S2(db, event);
  }

  const arkTimeoutMs = computeBatchCardTimeoutMs(items.length);
  const batchStarted = Date.now();

  logEvent({
    action: "generateQuadrantBatch",
    phase: "start",
    quadrantId,
    cardField: String(items.length),
    errCode: "serial",
  });

  const ctx = { taskId, quadrantId, items, arkTimeoutMs, taskTitle: v.payload.taskTitle };
  const rows = [];

  for (let i = 0; i < items.length; i++) {
    rows.push(await runOneCard(db, items[i], ctx));
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!isBatchCardRetryable(row, quadrantId)) continue;
    if (Date.now() - batchStarted > ARK_BATCH_WALL_BUDGET_MS - 5000) break;
    logEvent({
      action: "generateQuadrantBatch",
      phase: "retry_card",
      quadrantId,
      cardField: items[i] && items[i].cardField ? items[i].cardField : "",
      errCode: row.errCode || "",
    });
    const retry = await runOneCard(db, items[i], ctx);
    if (retry && !retry.fallback) rows[i] = retry;
  }

  const replies = rows.map((row, idx) => {
    const item = items[idx];
    return {
      cardField: item.cardField,
      ok: !!(row && row.ok && !row.fallback && row.replyContent),
      replyContent: row && row.replyContent ? row.replyContent : "",
      fromCache: !!(row && row.fromCache),
      fallback: !!(row && row.fallback),
      textHash: row && row.textHash ? row.textHash : "",
      errCode: row && row.errCode ? row.errCode : "",
    };
  });

  const fallbackCount = replies.filter((r) => r.fallback).length;
  logEvent({
    action: "generateQuadrantBatch",
    phase: "done",
    quadrantId,
    errCode: fallbackCount ? `FALLBACK_${fallbackCount}` : "OK",
    cardField: String(items.length),
    durationMs: Date.now() - batchStarted,
  });

  return {
    ok: true,
    replies,
    fallbackCount,
    batchMode: Number(quadrantId) === 1 || Number(quadrantId) === 4 ? "dashscope" : "serial",
    arkTimeoutMs,
  };
}

module.exports = {
  handleGenerateQuadrantBatch,
  computeBatchCardTimeoutMs,
  isBatchCardRetryable,
  Q2_BATCH_INCOMPLETE_RETRY_CODES,
};
