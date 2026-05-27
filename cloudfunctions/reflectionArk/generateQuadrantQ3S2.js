"use strict";

const { loadArkEnv, isArkEnvReady, isQ2DeepEnvReady } = require("./env");
const { resolveArkModelId } = require("./arkModel");
const { callArkResponses } = require("./arkClient");
const { buildTextHash } = require("./textHash");
const { finalizeAndAssessReply } = require("./openingCheck");
const { assessArkReplyForCard } = require("./replyCompleteness");
const {
  getQ3PersonaSystem,
  buildStageAUserContent,
  buildStageBUserContent,
} = require("./q3Prompts");
const { parseStageBMarkers } = require("./generateQuadrantQ2S2");
const { findCache, upsertCache } = require("./cache");
const { validateGenerateQuadrantBatchParams } = require("./validate");
const { logEvent } = require("./logger");
const {
  ARK_BATCH_WALL_BUDGET_MS,
  ARK_MAX_OUTPUT_TOKENS_Q3_STAGE_A,
  ARK_MAX_OUTPUT_TOKENS_Q3_STAGE_B,
  QUADRANT_Q3_ID,
  Q3_STAGE_A_TIMEOUT_MS,
  Q3_STAGE_B_TIMEOUT_MAX_MS,
  Q2_WALL_RESERVE_MS,
} = require("./constants");

const TRANSPORT_RETRY_CODES = new Set([
  "ARK_TIMEOUT",
  "ARK_EMPTY_OUTPUT",
  "ARK_NETWORK",
]);

const Q3_ASSESSMENT_RETRY_REASONS = new Set([
  "REPLY_INCOMPLETE",
  "NO_SENTENCE_END",
  "NO_TERMINAL_END",
  "DANGLING_ENDING",
  "UNCLOSED_QUOTE",
  "TOO_SHORT_DISPLAY",
  "TRUNCATE_NO_SENTENCE_END",
  "TOO_LONG",
  "Q2_PARSE_FAILED",
  "Q3_PARSE_FAILED",
]);

function shouldRetryQ3Assessment(errCode) {
  return Q3_ASSESSMENT_RETRY_REASONS.has(String(errCode || ""));
}

function indexQ3Items(items) {
  const byField = Object.create(null);
  (items || []).forEach((item) => {
    if (item && item.cardField) byField[String(item.cardField)] = item;
  });
  if (!byField.c0 || !byField.c1 || !byField.c2) return null;
  return byField;
}

async function loadValidCache(db, taskId, cardField, userText) {
  const { normalized, hash } = buildTextHash(userText);
  const cached = await findCache(db, {
    taskId,
    quadrantId: QUADRANT_Q3_ID,
    cardField,
    textHash: hash,
  });
  if (!cached || !cached.replyContent) return null;
  const check = assessArkReplyForCard(QUADRANT_Q3_ID, cardField, cached.replyContent);
  if (!check.ok) return null;
  return {
    ok: true,
    replyContent: cached.replyContent,
    fromCache: true,
    fallback: false,
    textHash: hash,
    errCode: "",
  };
}

function failRow(cardField, textHash, errCode) {
  return {
    cardField,
    ok: false,
    replyContent: "",
    fromCache: false,
    fallback: false,
    textHash: textHash || "",
    errCode: errCode || "Q3_FAILED",
  };
}

function okRow(cardField, replyContent, textHash, fromCache) {
  return {
    cardField,
    ok: true,
    replyContent,
    fromCache: !!fromCache,
    fallback: false,
    textHash,
    errCode: "",
  };
}

async function saveCache(db, taskId, row) {
  try {
    await upsertCache(db, {
      taskId,
      quadrantId: QUADRANT_Q3_ID,
      cardField: row.cardField,
      textHash: row.textHash,
      agentType: row.agentType || "xiaoqi",
      replyContent: row.replyContent,
      createdAt: new Date(),
    });
    return true;
  } catch (e) {
    logEvent({
      level: "error",
      action: "generateQuadrantQ3S2",
      phase: "cache_write",
      errCode: "CACHE_WRITE_FAIL",
      quadrantId: QUADRANT_Q3_ID,
      cardField: row.cardField || "",
    });
    return false;
  }
}

function pickPrimaryErrCode(replies) {
  const row = (replies || []).find((r) => r && !r.ok);
  return row && row.errCode ? String(row.errCode) : "";
}

function wrapQ3BatchResult(replies, extra) {
  return Object.assign(
    {
      ok: true,
      replies,
      fallbackCount: 0,
      batchMode: "q3_s2",
      primaryErrCode: pickPrimaryErrCode(replies),
    },
    extra || {},
  );
}

async function callStageAArk(env, opts) {
  const instructions = getQ3PersonaSystem();
  const userContent = buildStageAUserContent(opts.taskTitle, opts.question, opts.userText);
  const { hash } = buildTextHash(opts.userText);
  return callArkResponses(
    env,
    {
      instructions,
      userContent,
      meta: {
        quadrantId: QUADRANT_Q3_ID,
        cardField: "c0",
        textHash: hash,
        phase: "q3_a",
      },
    },
    {
      timeoutMs: opts.timeoutMs,
      modelId: resolveArkModelId(env, QUADRANT_Q3_ID, "stage_a"),
      maxOutputTokens: ARK_MAX_OUTPUT_TOKENS_Q3_STAGE_A,
    },
  );
}

async function callStageBArk(env, opts) {
  const instructions = getQ3PersonaSystem();
  const userContent = buildStageBUserContent(opts.taskTitle, opts.byField);
  return callArkResponses(
    env,
    {
      instructions,
      userContent,
      meta: {
        quadrantId: QUADRANT_Q3_ID,
        cardField: "c1_c2",
        phase: "q3_b",
      },
    },
    {
      timeoutMs: opts.timeoutMs,
      modelId: resolveArkModelId(env, QUADRANT_Q3_ID, "stage_b"),
      maxOutputTokens: ARK_MAX_OUTPUT_TOKENS_Q3_STAGE_B,
    },
  );
}

function canRetryStage(attempt, maxAttempts, wallEnd, minRemainMs) {
  if (attempt >= maxAttempts) return false;
  if (!wallEnd) return true;
  return Date.now() < wallEnd - (minRemainMs || 12000);
}

async function runStageA(db, env, ctx) {
  const item = ctx.byField.c0;
  const cached = await loadValidCache(db, ctx.taskId, "c0", item.userText);
  if (cached) return cached;

  const maxAttempts = 2;
  let lastErr = "REPLY_INCOMPLETE";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ark = await callStageAArk(env, {
      taskTitle: ctx.taskTitle,
      question: item.question,
      userText: item.userText,
      timeoutMs: ctx.stageATimeoutMs,
    });

    if (!ark.ok || !ark.text) {
      lastErr = ark.errCode || "ARK_FAILED";
      if (
        canRetryStage(attempt, maxAttempts, ctx.wallEnd, 12000) &&
        TRANSPORT_RETRY_CODES.has(lastErr)
      ) {
        continue;
      }
      return failRow("c0", buildTextHash(item.userText).hash, lastErr);
    }

    const assessed = finalizeAndAssessReply(
      ark.text,
      "xiaoqi",
      item.userText,
      QUADRANT_Q3_ID,
      "c0",
    );
    if (assessed.ok) {
      const { hash } = buildTextHash(item.userText);
      const saved = await saveCache(db, ctx.taskId, {
        cardField: "c0",
        textHash: hash,
        agentType: item.agentType,
        replyContent: assessed.text,
      });
      if (!saved) {
        return failRow("c0", hash, "CACHE_WRITE_FAIL");
      }
      return okRow("c0", assessed.text, hash, false);
    }

    lastErr = assessed.reason || "REPLY_INCOMPLETE";
    if (canRetryStage(attempt, maxAttempts, ctx.wallEnd, 12000) && shouldRetryQ3Assessment(lastErr)) {
      continue;
    }
    break;
  }

  return failRow("c0", buildTextHash(item.userText).hash, lastErr);
}

async function runStageB(db, env, ctx) {
  const itemC1 = ctx.byField.c1;
  const itemC2 = ctx.byField.c2;
  const hashC1 = buildTextHash(itemC1.userText).hash;
  const hashC2 = buildTextHash(itemC2.userText).hash;

  const cachedC1 = await loadValidCache(db, ctx.taskId, "c1", itemC1.userText);
  const cachedC2 = await loadValidCache(db, ctx.taskId, "c2", itemC2.userText);
  if (cachedC1 && cachedC2) {
    return {
      c1: okRow("c1", cachedC1.replyContent, hashC1, true),
      c2: okRow("c2", cachedC2.replyContent, hashC2, true),
    };
  }

  const maxAttempts = 2;
  let lastErr = "Q3_PARSE_FAILED";
  const wallEnd = ctx.wallEnd || 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ark = await callStageBArk(env, {
      taskTitle: ctx.taskTitle,
      byField: ctx.byField,
      timeoutMs: ctx.stageBTimeoutMs,
    });

    if (!ark.ok || !ark.text) {
      lastErr = ark.errCode || "ARK_FAILED";
      if (canRetryStage(attempt, maxAttempts, wallEnd, 15000) && TRANSPORT_RETRY_CODES.has(lastErr)) {
        continue;
      }
      return {
        c1: failRow("c1", hashC1, lastErr),
        c2: failRow("c2", hashC2, lastErr),
      };
    }

    const parsed = parseStageBMarkers(ark.text);
    if (!parsed.ok) {
      lastErr = parsed.errCode || "Q3_PARSE_FAILED";
      if (canRetryStage(attempt, maxAttempts, wallEnd, 15000)) {
        continue;
      }
      return {
        c1: failRow("c1", hashC1, lastErr),
        c2: failRow("c2", hashC2, lastErr),
      };
    }

    const assessedC1 = finalizeAndAssessReply(
      parsed.c1,
      "xiaoqi",
      itemC1.userText,
      QUADRANT_Q3_ID,
      "c1",
    );
    const assessedC2 = finalizeAndAssessReply(
      parsed.c2,
      "xiaoqi",
      itemC2.userText,
      QUADRANT_Q3_ID,
      "c2",
    );

    if (assessedC1.ok && assessedC2.ok) {
      const saved1 = await saveCache(db, ctx.taskId, {
        cardField: "c1",
        textHash: hashC1,
        agentType: itemC1.agentType,
        replyContent: assessedC1.text,
      });
      const saved2 = await saveCache(db, ctx.taskId, {
        cardField: "c2",
        textHash: hashC2,
        agentType: itemC2.agentType,
        replyContent: assessedC2.text,
      });
      if (!saved1 || !saved2) {
        const err = "CACHE_WRITE_FAIL";
        return {
          c1: failRow("c1", hashC1, err),
          c2: failRow("c2", hashC2, err),
        };
      }
      return {
        c1: okRow("c1", assessedC1.text, hashC1, false),
        c2: okRow("c2", assessedC2.text, hashC2, false),
      };
    }

    lastErr = assessedC1.reason || assessedC2.reason || "REPLY_INCOMPLETE";
    if (canRetryStage(attempt, maxAttempts, wallEnd, 15000) && shouldRetryQ3Assessment(lastErr)) {
      continue;
    }
    break;
  }

  return {
    c1: failRow("c1", hashC1, lastErr),
    c2: failRow("c2", hashC2, lastErr),
  };
}

function buildAllFailedReplies(byField, errCode) {
  return ["c0", "c1", "c2"].map((field) => {
    const item = byField[field];
    const hash = item ? buildTextHash(item.userText).hash : "";
    return failRow(field, hash, errCode);
  });
}

function prepareQ3Context(event) {
  const v = validateGenerateQuadrantBatchParams(event);
  if (!v.ok) {
    return { ok: false, errCode: v.errCode };
  }
  const { taskId, items, taskTitle } = v.payload;
  const byField = indexQ3Items(items);
  if (!byField) {
    return { ok: false, errCode: "Q3_INCOMPLETE_ITEMS" };
  }
  const env = loadArkEnv();
  if (!isArkEnvReady(env)) {
    return { ok: false, errCode: "ARK_ENV_MISSING", byField };
  }
  if (!isQ2DeepEnvReady(env)) {
    return { ok: false, errCode: "ARK_Q2_DEEP_MISSING", byField };
  }
  return {
    ok: true,
    env,
    payload: { taskId, items, taskTitle: taskTitle || "未命名任务" },
    byField,
  };
}

async function handleGenerateQuadrantQ3StageA(db, event) {
  const prep = prepareQ3Context(event);
  if (!prep.ok) {
    return { ok: false, errCode: prep.errCode || "Q3_PREP_FAILED" };
  }
  const { env, payload, byField } = prep;
  const batchStarted = Date.now();
  const wallEnd = batchStarted + ARK_BATCH_WALL_BUDGET_MS;
  const ctx = {
    taskId: payload.taskId,
    taskTitle: payload.taskTitle,
    byField,
    stageATimeoutMs: Q3_STAGE_A_TIMEOUT_MS,
    wallEnd,
  };

  logEvent({
    action: "generateQuadrantQ3StageA",
    phase: "start",
    quadrantId: QUADRANT_Q3_ID,
    cardField: "c0",
  });

  const c0Row = await runStageA(db, env, ctx);
  logEvent({
    action: "generateQuadrantQ3StageA",
    phase: "done",
    quadrantId: QUADRANT_Q3_ID,
    errCode: c0Row.ok ? "OK" : c0Row.errCode || "FAIL",
    durationMs: Date.now() - batchStarted,
  });

  return {
    ok: !!c0Row.ok,
    reply: c0Row,
    primaryErrCode: c0Row.ok ? "" : c0Row.errCode || "Q3_STAGE_A_FAILED",
    batchMode: "q3_s2_stage_a",
  };
}

async function handleGenerateQuadrantQ3StageB(db, event) {
  const prep = prepareQ3Context(event);
  if (!prep.ok) {
    return { ok: false, errCode: prep.errCode || "Q3_PREP_FAILED" };
  }
  const { env, payload, byField } = prep;
  const batchStarted = Date.now();
  const wallEnd = batchStarted + ARK_BATCH_WALL_BUDGET_MS;
  const ctx = {
    taskId: payload.taskId,
    taskTitle: payload.taskTitle,
    byField,
    stageBTimeoutMs: Q3_STAGE_B_TIMEOUT_MAX_MS,
    wallEnd,
  };

  logEvent({
    action: "generateQuadrantQ3StageB",
    phase: "start",
    quadrantId: QUADRANT_Q3_ID,
    cardField: "c1_c2",
  });

  const stageB = await runStageB(db, env, ctx);
  const replies = [stageB.c1, stageB.c2];
  const allOk = replies.every((r) => r && r.ok);
  const primaryErrCode = pickPrimaryErrCode(replies);

  logEvent({
    action: "generateQuadrantQ3StageB",
    phase: "done",
    quadrantId: QUADRANT_Q3_ID,
    errCode: allOk ? "OK" : primaryErrCode || "Q3_STAGE_B_FAILED",
    durationMs: Date.now() - batchStarted,
  });

  return Object.assign(wrapQ3BatchResult(replies, { batchMode: "q3_s2_stage_b" }), {
    ok: allOk,
  });
}

async function handleGenerateQuadrantQ3S2(db, event) {
  const prep = prepareQ3Context(event);
  if (!prep.ok) {
    return { ok: false, errCode: prep.errCode };
  }
  const { env, payload, byField } = prep;
  const batchStarted = Date.now();
  const wallEnd = batchStarted + ARK_BATCH_WALL_BUDGET_MS;
  const ctx = {
    taskId: payload.taskId,
    taskTitle: payload.taskTitle,
    byField,
    stageATimeoutMs: Q3_STAGE_A_TIMEOUT_MS,
    wallEnd,
  };

  logEvent({
    action: "generateQuadrantQ3S2",
    phase: "start",
    quadrantId: QUADRANT_Q3_ID,
    cardField: "3",
  });

  const c0Row = await runStageA(db, env, ctx);
  if (!c0Row.ok) {
    return wrapQ3BatchResult(
      buildAllFailedReplies(byField, c0Row.errCode || "Q3_STAGE_A_FAILED"),
    );
  }

  const remaining = wallEnd - Date.now() - Q2_WALL_RESERVE_MS;
  ctx.stageBTimeoutMs = Math.min(Q3_STAGE_B_TIMEOUT_MAX_MS, Math.max(5000, remaining));

  const stageB = await runStageB(db, env, ctx);
  const replies = [c0Row, stageB.c1, stageB.c2];
  const allOk = replies.every((r) => r && r.ok);

  logEvent({
    action: "generateQuadrantQ3S2",
    phase: "done",
    quadrantId: QUADRANT_Q3_ID,
    errCode: allOk ? "OK" : "Q3_STAGE_B_FAILED",
    durationMs: Date.now() - batchStarted,
  });

  return wrapQ3BatchResult(replies, { stageBTimeoutMs: ctx.stageBTimeoutMs });
}

module.exports = {
  handleGenerateQuadrantQ3S2,
  handleGenerateQuadrantQ3StageA,
  handleGenerateQuadrantQ3StageB,
};
