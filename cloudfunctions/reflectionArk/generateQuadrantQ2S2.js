"use strict";

const { loadArkEnv, isArkEnvReady, isQ2DeepEnvReady } = require("./env");
const { callArkResponses } = require("./arkClient");
const { buildTextHash } = require("./textHash");
const { finalizeAndAssessReply } = require("./openingCheck");
const { assessArkReplyForCard } = require("./replyCompleteness");
const {
  getQ2PersonaSystem,
  buildStageAUserContent,
  buildStageBUserContent,
} = require("./q2Prompts");
const { findCache, upsertCache } = require("./cache");
const { validateGenerateQuadrantBatchParams } = require("./validate");
const { logEvent } = require("./logger");
const {
  ARK_BATCH_WALL_BUDGET_MS,
  ARK_MAX_OUTPUT_TOKENS_Q2_STAGE_A,
  ARK_MAX_OUTPUT_TOKENS_Q2_STAGE_B,
  QUADRANT_Q2_ID,
  Q2_STAGE_A_TIMEOUT_MS,
  Q2_STAGE_B_TIMEOUT_MAX_MS,
  Q2_WALL_RESERVE_MS,
} = require("./constants");

const MARKER_C1 = "===c1===";
const MARKER_C2 = "===c2===";
const MARKER_C1_RE = /={3}\s*c1\s*={3}/gi;
const MARKER_C2_RE = /={3}\s*c2\s*={3}/gi;

/**
 * @param {string} raw
 * @returns {string}
 */
function normalizeStageBRaw(raw) {
  return String(raw || "")
    .replace(/\uFF1D/g, "=")
    .replace(/\r\n/g, "\n")
    .trim();
}

/**
 * @param {string} text
 * @param {RegExp} re
 * @returns {{ index: number, length: number }[]}
 */
function findAllMarkerMatches(text, re) {
  const matches = [];
  const regex = new RegExp(re.source, re.flags);
  let m;
  while ((m = regex.exec(text)) !== null) {
    matches.push({ index: m.index, length: m[0].length });
  }
  return matches;
}

/**
 * @param {string} raw
 * @returns {{ ok: boolean, c1?: string, c2?: string, errCode?: string }}
 */
function parseStageBMarkers(raw) {
  const text = normalizeStageBRaw(raw);
  const c1Matches = findAllMarkerMatches(text, MARKER_C1_RE);
  const c2Matches = findAllMarkerMatches(text, MARKER_C2_RE);
  if (!c1Matches.length || !c2Matches.length) {
    return { ok: false, errCode: "Q2_PARSE_FAILED" };
  }
  const firstC1 = c1Matches[0];
  const lastC2 = c2Matches[c2Matches.length - 1];
  if (lastC2.index <= firstC1.index) {
    return { ok: false, errCode: "Q2_PARSE_FAILED" };
  }
  const c1 = text.slice(firstC1.index + firstC1.length, lastC2.index).trim();
  const c2 = text.slice(lastC2.index + lastC2.length).trim();
  if (!c1 || !c2) {
    return { ok: false, errCode: "Q2_PARSE_FAILED" };
  }
  return { ok: true, c1, c2 };
}

const TRANSPORT_RETRY_CODES = new Set([
  "ARK_TIMEOUT",
  "ARK_EMPTY_OUTPUT",
  "ARK_NETWORK",
]);

/** 验收/解析失败可再打一轮（与 generateQuadrantBatch 观心明己策略一致） */
const Q2_ASSESSMENT_RETRY_REASONS = new Set([
  "REPLY_INCOMPLETE",
  "NO_SENTENCE_END",
  "NO_TERMINAL_END",
  "DANGLING_ENDING",
  "UNCLOSED_QUOTE",
  "TOO_SHORT_DISPLAY",
  "TRUNCATE_NO_SENTENCE_END",
  "TOO_LONG",
  "Q2_PARSE_FAILED",
]);

/**
 * @param {string} errCode
 * @returns {boolean}
 */
function shouldRetryQ2Assessment(errCode) {
  return Q2_ASSESSMENT_RETRY_REASONS.has(String(errCode || ""));
}

/**
 * @param {object[]} items
 * @returns {Record<string, object>|null}
 */
function indexQ2Items(items) {
  const byField = Object.create(null);
  (items || []).forEach((item) => {
    if (item && item.cardField) byField[String(item.cardField)] = item;
  });
  if (!byField.c0 || !byField.c1 || !byField.c2) return null;
  return byField;
}

/**
 * @param {object} db
 * @param {string} taskId
 * @param {string} cardField
 * @param {string} userText
 * @returns {Promise<object|null>}
 */
async function loadValidCache(db, taskId, cardField, userText) {
  const { normalized, hash } = buildTextHash(userText);
  const cached = await findCache(db, {
    taskId,
    quadrantId: QUADRANT_Q2_ID,
    cardField,
    textHash: hash,
  });
  if (!cached || !cached.replyContent) return null;
  const check = assessArkReplyForCard(QUADRANT_Q2_ID, cardField, cached.replyContent);
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
    errCode: errCode || "Q2_FAILED",
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

/**
 * @param {object} db
 * @param {object} row
 */
async function saveCache(db, taskId, row) {
  try {
    await upsertCache(db, {
      taskId,
      quadrantId: QUADRANT_Q2_ID,
      cardField: row.cardField,
      textHash: row.textHash,
      agentType: row.agentType || "xiaolin",
      replyContent: row.replyContent,
      createdAt: new Date(),
    });
    return true;
  } catch (e) {
    logEvent({
      level: "error",
      action: "generateQuadrantQ2S2",
      phase: "cache_write",
      errCode: "CACHE_WRITE_FAIL",
      quadrantId: QUADRANT_Q2_ID,
      cardField: row.cardField || "",
    });
    return false;
  }
}

function pickPrimaryErrCode(replies) {
  const row = (replies || []).find((r) => r && !r.ok);
  return row && row.errCode ? String(row.errCode) : "";
}

function wrapQ2BatchResult(replies, extra) {
  return Object.assign(
    {
      ok: true,
      replies,
      fallbackCount: 0,
      batchMode: "q2_s2",
      primaryErrCode: pickPrimaryErrCode(replies),
    },
    extra || {},
  );
}

/**
 * @param {object} env
 * @param {object} opts
 * @returns {Promise<{ ok: boolean, text?: string, errCode?: string }>}
 */
async function callStageAArk(env, opts) {
  const instructions = getQ2PersonaSystem();
  const userContent = buildStageAUserContent(opts.taskTitle, opts.question, opts.userText);
  const { hash } = buildTextHash(opts.userText);
  return callArkResponses(
    env,
    {
      instructions,
      userContent,
      meta: {
        quadrantId: QUADRANT_Q2_ID,
        cardField: "c0",
        textHash: hash,
        phase: "q2_a",
      },
    },
    {
      timeoutMs: opts.timeoutMs,
      modelId: env.modelId,
      maxOutputTokens: ARK_MAX_OUTPUT_TOKENS_Q2_STAGE_A,
    },
  );
}

/**
 * @param {object} env
 * @param {object} opts
 * @returns {Promise<{ ok: boolean, text?: string, errCode?: string }>}
 */
async function callStageBArk(env, opts) {
  const instructions = getQ2PersonaSystem();
  const userContent = buildStageBUserContent(opts.taskTitle, opts.byField);
  return callArkResponses(
    env,
    {
      instructions,
      userContent,
      meta: {
        quadrantId: QUADRANT_Q2_ID,
        cardField: "c1_c2",
        phase: "q2_b",
      },
    },
    {
      timeoutMs: opts.timeoutMs,
      modelId: env.modelIdQ2Deep,
      maxOutputTokens: ARK_MAX_OUTPUT_TOKENS_Q2_STAGE_B,
    },
  );
}

/**
 * @param {object} db
 * @param {object} env
 * @param {object} ctx
 * @returns {Promise<object>}
 */
async function runStageA(db, env, ctx) {
  const item = ctx.byField.c0;
  const cached = ctx.forceRegenerate
    ? null
    : await loadValidCache(db, ctx.taskId, "c0", item.userText);
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
        logEvent({
          action: "generateQuadrantQ2S2",
          phase: "q2_a_retry_transport",
          errCode: lastErr,
          quadrantId: QUADRANT_Q2_ID,
          cardField: "c0",
        });
        continue;
      }
      return failRow("c0", buildTextHash(item.userText).hash, lastErr);
    }

    const assessed = finalizeAndAssessReply(
      ark.text,
      "xiaolin",
      item.userText,
      QUADRANT_Q2_ID,
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
    logEvent({
      action: "generateQuadrantQ2S2",
      phase: "q2_a_incomplete",
      errCode: lastErr,
      quadrantId: QUADRANT_Q2_ID,
      cardField: "c0",
    });
    if (canRetryStage(attempt, maxAttempts, ctx.wallEnd, 12000) && shouldRetryQ2Assessment(lastErr)) {
      continue;
    }
    break;
  }

  return failRow("c0", buildTextHash(item.userText).hash, lastErr);
}

/**
 * @param {object} db
 * @param {object} env
 * @param {object} ctx
 * @returns {Promise<{ c1: object, c2: object }>}
 */
function canRetryStage(attempt, maxAttempts, wallEnd, minRemainMs) {
  if (attempt >= maxAttempts) return false;
  if (!wallEnd) return true;
  return Date.now() < wallEnd - (minRemainMs || 12000);
}

async function runStageB(db, env, ctx) {
  const itemC1 = ctx.byField.c1;
  const itemC2 = ctx.byField.c2;
  const hashC1 = buildTextHash(itemC1.userText).hash;
  const hashC2 = buildTextHash(itemC2.userText).hash;

  const cachedC1 = ctx.forceRegenerate
    ? null
    : await loadValidCache(db, ctx.taskId, "c1", itemC1.userText);
  const cachedC2 = ctx.forceRegenerate
    ? null
    : await loadValidCache(db, ctx.taskId, "c2", itemC2.userText);
  if (cachedC1 && cachedC2) {
    return {
      c1: okRow("c1", cachedC1.replyContent, hashC1, true),
      c2: okRow("c2", cachedC2.replyContent, hashC2, true),
    };
  }

  const maxAttempts = 2;
  let lastErr = "Q2_PARSE_FAILED";
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
        logEvent({
          action: "generateQuadrantQ2S2",
          phase: "q2_b_retry_transport",
          errCode: lastErr,
          quadrantId: QUADRANT_Q2_ID,
          cardField: "c1_c2",
        });
        continue;
      }
      return {
        c1: failRow("c1", hashC1, lastErr),
        c2: failRow("c2", hashC2, lastErr),
      };
    }

    const parsed = parseStageBMarkers(ark.text);
    if (!parsed.ok) {
      lastErr = parsed.errCode || "Q2_PARSE_FAILED";
      if (canRetryStage(attempt, maxAttempts, wallEnd, 15000)) {
        logEvent({
          action: "generateQuadrantQ2S2",
          phase: "q2_b_retry_parse",
          errCode: lastErr,
          quadrantId: QUADRANT_Q2_ID,
          cardField: "c1_c2",
        });
        continue;
      }
      return {
        c1: failRow("c1", hashC1, lastErr),
        c2: failRow("c2", hashC2, lastErr),
      };
    }

    const assessedC1 = finalizeAndAssessReply(
      parsed.c1,
      "xiaolin",
      itemC1.userText,
      QUADRANT_Q2_ID,
      "c1",
    );
    const assessedC2 = finalizeAndAssessReply(
      parsed.c2,
      "xiaolin",
      itemC2.userText,
      QUADRANT_Q2_ID,
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
    logEvent({
      action: "generateQuadrantQ2S2",
      phase: "q2_b_incomplete",
      errCode: lastErr,
      quadrantId: QUADRANT_Q2_ID,
      cardField: "c1_c2",
    });
    if (
      canRetryStage(attempt, maxAttempts, wallEnd, 15000) &&
      shouldRetryQ2Assessment(lastErr)
    ) {
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

/**
 * @param {object} event
 * @returns {{ ok: boolean, errCode?: string, env?: object, payload?: object, byField?: object }}
 */
function prepareQ2Context(event) {
  const v = validateGenerateQuadrantBatchParams(event);
  if (!v.ok) {
    return { ok: false, errCode: v.errCode };
  }
  const { taskId, items, taskTitle, forceRegenerate } = v.payload;
  const byField = indexQ2Items(items);
  if (!byField) {
    return { ok: false, errCode: "Q2_INCOMPLETE_ITEMS" };
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
    forceRegenerate: !!forceRegenerate,
  };
}

/**
 * Q2 阶段 A 单独云调用（c0·豆包），独享 60s 预算
 * @param {object} db
 * @param {object} event
 */
async function handleGenerateQuadrantQ2StageA(db, event) {
  const prep = prepareQ2Context(event);
  if (!prep.ok) {
    return { ok: false, errCode: prep.errCode || "Q2_PREP_FAILED" };
  }
  const { env, payload, byField, forceRegenerate } = prep;
  const batchStarted = Date.now();
  const wallEnd = batchStarted + ARK_BATCH_WALL_BUDGET_MS;
  const ctx = {
    taskId: payload.taskId,
    taskTitle: payload.taskTitle,
    byField,
    stageATimeoutMs: Q2_STAGE_A_TIMEOUT_MS,
    wallEnd,
    forceRegenerate: !!forceRegenerate,
  };

  logEvent({
    action: "generateQuadrantQ2StageA",
    phase: "start",
    quadrantId: QUADRANT_Q2_ID,
    cardField: "c0",
  });

  const c0Row = await runStageA(db, env, ctx);
  logEvent({
    action: "generateQuadrantQ2StageA",
    phase: "done",
    quadrantId: QUADRANT_Q2_ID,
    errCode: c0Row.ok ? "OK" : c0Row.errCode || "FAIL",
    durationMs: Date.now() - batchStarted,
  });

  return {
    ok: !!c0Row.ok,
    reply: c0Row,
    primaryErrCode: c0Row.ok ? "" : c0Row.errCode || "Q2_STAGE_A_FAILED",
    batchMode: "q2_s2_stage_a",
  };
}

/**
 * Q2 阶段 B 单独云调用（c1+c2·DeepSeek）；仅需题干与手写，不依赖 c0 缓存
 * @param {object} db
 * @param {object} event
 */
async function handleGenerateQuadrantQ2StageB(db, event) {
  const prep = prepareQ2Context(event);
  if (!prep.ok) {
    return { ok: false, errCode: prep.errCode || "Q2_PREP_FAILED" };
  }
  const { env, payload, byField, forceRegenerate } = prep;
  const batchStarted = Date.now();
  const wallEnd = batchStarted + ARK_BATCH_WALL_BUDGET_MS;
  const ctx = {
    taskId: payload.taskId,
    taskTitle: payload.taskTitle,
    byField,
    stageBTimeoutMs: Q2_STAGE_B_TIMEOUT_MAX_MS,
    wallEnd,
    forceRegenerate: !!forceRegenerate,
  };

  logEvent({
    action: "generateQuadrantQ2StageB",
    phase: "start",
    quadrantId: QUADRANT_Q2_ID,
    cardField: "c1_c2",
  });

  const stageB = await runStageB(db, env, ctx);
  const replies = [stageB.c1, stageB.c2];
  const allOk = replies.every((r) => r && r.ok);
  const primaryErrCode = pickPrimaryErrCode(replies);

  logEvent({
    action: "generateQuadrantQ2StageB",
    phase: "done",
    quadrantId: QUADRANT_Q2_ID,
    errCode: allOk ? "OK" : primaryErrCode || "Q2_STAGE_B_FAILED",
    durationMs: Date.now() - batchStarted,
  });

  return Object.assign(wrapQ2BatchResult(replies, { batchMode: "q2_s2_stage_b" }), {
    ok: allOk,
  });
}

/**
 * @param {object} db
 * @param {object} event
 */
async function handleGenerateQuadrantQ2S2(db, event) {
  const v = validateGenerateQuadrantBatchParams(event);
  if (!v.ok) {
    return { ok: false, errCode: v.errCode };
  }

  const { taskId, items, taskTitle, forceRegenerate } = v.payload;
  const byField = indexQ2Items(items);
  if (!byField) {
    const fails = (items || []).map((it) =>
      failRow(
        it.cardField,
        buildTextHash(it.userText || "").hash,
        "Q2_INCOMPLETE_ITEMS",
      ),
    );
    return wrapQ2BatchResult(fails);
  }

  const env = loadArkEnv();
  if (!isArkEnvReady(env)) {
    return wrapQ2BatchResult(buildAllFailedReplies(byField, "ARK_ENV_MISSING"));
  }
  if (!isQ2DeepEnvReady(env)) {
    return wrapQ2BatchResult(buildAllFailedReplies(byField, "ARK_Q2_DEEP_MISSING"));
  }

  const batchStarted = Date.now();
  const wallEnd = batchStarted + ARK_BATCH_WALL_BUDGET_MS;
  const stageATimeoutMs = Math.min(
    Q2_STAGE_A_TIMEOUT_MS,
    Math.floor(ARK_BATCH_WALL_BUDGET_MS * 0.35),
  );

  logEvent({
    action: "generateQuadrantQ2S2",
    phase: "start",
    quadrantId: QUADRANT_Q2_ID,
    cardField: "3",
  });

  const ctx = {
    taskId,
    taskTitle: taskTitle || "未命名任务",
    byField,
    stageATimeoutMs,
    wallEnd,
    forceRegenerate: !!forceRegenerate,
  };

  const c0Row = await runStageA(db, env, ctx);
  if (!c0Row.ok) {
    logEvent({
      action: "generateQuadrantQ2S2",
      phase: "done",
      quadrantId: QUADRANT_Q2_ID,
      errCode: c0Row.errCode || "Q2_STAGE_A_FAILED",
      durationMs: Date.now() - batchStarted,
    });
    return wrapQ2BatchResult(
      buildAllFailedReplies(byField, c0Row.errCode || "Q2_STAGE_A_FAILED"),
    );
  }

  const remaining = wallEnd - Date.now() - Q2_WALL_RESERVE_MS;
  const stageBTimeoutMs = Math.min(Q2_STAGE_B_TIMEOUT_MAX_MS, Math.max(5000, remaining));
  ctx.stageBTimeoutMs = stageBTimeoutMs;

  const stageB = await runStageB(db, env, ctx);
  const replies = [c0Row, stageB.c1, stageB.c2];
  const allOk = replies.every((r) => r && r.ok);

  logEvent({
    action: "generateQuadrantQ2S2",
    phase: "done",
    quadrantId: QUADRANT_Q2_ID,
    errCode: allOk ? "OK" : "Q2_STAGE_B_FAILED",
    cardField: String(replies.filter((r) => r && r.fromCache).length),
    durationMs: Date.now() - batchStarted,
  });

  return wrapQ2BatchResult(replies, { stageBTimeoutMs });
}

module.exports = {
  handleGenerateQuadrantQ2S2,
  handleGenerateQuadrantQ2StageA,
  handleGenerateQuadrantQ2StageB,
  parseStageBMarkers,
  MARKER_C1,
  MARKER_C2,
};
