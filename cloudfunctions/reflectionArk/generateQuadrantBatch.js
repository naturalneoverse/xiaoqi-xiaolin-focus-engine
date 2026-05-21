"use strict";

const { handleGenerateReply } = require("./generateReply");
const { validateGenerateQuadrantBatchParams } = require("./validate");
const { logEvent } = require("./logger");
const {
  ARK_TIMEOUT_MS,
  ARK_BATCH_WALL_BUDGET_MS,
  ARK_BATCH_PARALLEL_SIZE,
} = require("./constants");

/**
 * 多卡时单卡方舟超时
 * @param {number} itemCount
 * @returns {number}
 */
function computeBatchCardTimeoutMs(itemCount) {
  const n = Math.max(1, Number(itemCount) || 1);
  if (n <= ARK_BATCH_PARALLEL_SIZE) return ARK_TIMEOUT_MS;
  return Math.min(ARK_TIMEOUT_MS, Math.max(8000, Math.floor(ARK_BATCH_WALL_BUDGET_MS / n)));
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
    },
    {
      arkTimeoutMs: ctx.arkTimeoutMs,
      allowRetryOnce: ctx.items.length === 1,
    },
  );
}

/**
 * 单象限多卡：2 张并行（各 25s），3 张及以上串行
 * @param {object} db
 * @param {object} event
 */
async function handleGenerateQuadrantBatch(db, event) {
  const v = validateGenerateQuadrantBatchParams(event);
  if (!v.ok) {
    return { ok: false, errCode: v.errCode };
  }

  const { taskId, quadrantId, items } = v.payload;
  const arkTimeoutMs = computeBatchCardTimeoutMs(items.length);
  const useParallel = items.length === ARK_BATCH_PARALLEL_SIZE;
  const batchMode = useParallel ? "parallel" : "serial";
  const batchStarted = Date.now();

  logEvent({
    action: "generateQuadrantBatch",
    phase: "start",
    quadrantId,
    cardField: String(items.length),
    errCode: batchMode,
  });

  const ctx = { taskId, quadrantId, items, arkTimeoutMs };
  let rows;

  if (useParallel) {
    rows = await Promise.all(items.map((item) => runOneCard(db, item, ctx)));
  } else {
    rows = [];
    for (let i = 0; i < items.length; i++) {
      rows.push(await runOneCard(db, items[i], ctx));
    }
  }

  const replies = rows.map((row, idx) => {
    const item = items[idx];
    return {
      cardField: item.cardField,
      ok: !!(row && row.ok),
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
    batchMode,
    arkTimeoutMs,
  };
}

module.exports = { handleGenerateQuadrantBatch, computeBatchCardTimeoutMs };
