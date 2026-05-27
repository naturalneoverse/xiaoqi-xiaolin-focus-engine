"use strict";

const { loadArkEnv, isArkEnvReady } = require("./env");
const {
  loadDashscopeEnv,
  isDashscopeEnvReady,
  resolveDashscopeModelId,
} = require("./dashscopeEnv");
const { buildTextHash } = require("./textHash");
const { desensitize } = require("./desensitize");
const { getPersonaSystem } = require("./personas");
const { getFallbackReply, isFallbackReply } = require("./reflectionArkFallback");
const { finalizeAndAssessReply } = require("./openingCheck");
const { assessArkReplyForCard } = require("./replyCompleteness");
const { getReplyLengthBounds } = require("./replyLengthPolicy");
const { callArkResponses } = require("./arkClient");
const { callDashscopeChat } = require("./dashscopeClient");
const { resolveArkModelId } = require("./arkModel");
const { getQ1PersonaSystem, buildQ1CardUserContent } = require("./q1Prompts");
const { getQ4PersonaSystem, buildQ4CardUserContent } = require("./q4Prompts");
const { findCache, upsertCache } = require("./cache");
const { validateGenerateReplyParams } = require("./validate");
const { logEvent } = require("./logger");
const { charCount } = require("./normalizeText");
const {
  QUADRANT_Q1_ID,
  QUADRANT_Q2_ID,
  QUADRANT_Q3_ID,
  QUADRANT_Q4_ID,
  Q1_STRICT_TERMINAL_CARD,
} = require("./constants");

/**
 * @param {number} quadrantId
 * @returns {boolean}
 */
function usesDashscope(quadrantId) {
  const q = Number(quadrantId);
  return q === QUADRANT_Q1_ID || q === QUADRANT_Q4_ID;
}

/**
 * @param {number} quadrantId
 * @param {string} cardField
 * @returns {boolean}
 */
function isQ1C2StrictCard(quadrantId, cardField) {
  return (
    Number(quadrantId) === QUADRANT_Q1_ID &&
    String(cardField || "").trim() === Q1_STRICT_TERMINAL_CARD
  );
}

/**
 * @param {{ allowRetryOnce?: boolean }} [options]
 * @param {number} [quadrantId]
 * @returns {boolean}
 */
function shouldProduceRetryOnce(options, quadrantId) {
  if (options && options.allowRetryOnce) return true;
  return Number(quadrantId) === QUADRANT_Q2_ID || Number(quadrantId) === QUADRANT_Q3_ID;
}

/**
 * @param {{ allowRetryOnce?: boolean }} [options]
 * @param {number} [quadrantId]
 * @returns {number}
 */
function resolveProduceMaxAttempts(options, quadrantId) {
  return shouldProduceRetryOnce(options, quadrantId) ? 2 : 1;
}

const TRANSPORT_RETRY_CODES = new Set([
  "ARK_TIMEOUT",
  "ARK_EMPTY_OUTPUT",
  "ARK_NETWORK",
  "DASHSCOPE_TIMEOUT",
  "DASHSCOPE_NETWORK",
  "DASHSCOPE_EMPTY",
]);

/**
 * @param {object} env
 * @param {object} v payload
 * @param {{ arkTimeoutMs?: number }} [options]
 * @returns {Promise<{ ok: boolean, text?: string, errCode?: string }>}
 */
async function requestArkReply(env, v, options) {
  const { quadrantId, cardField, agentType, normalized, textHash } = v;
  const lengthBounds = getReplyLengthBounds(normalized, quadrantId);
  const instructions = getPersonaSystem(agentType);
  const userContent = [
    `【哲思复盘·象限${quadrantId}·${cardField}】`,
    `以下为用户手写原文（已脱敏）。请紧扣原文用一段成文回应。`,
    `字数严格控制在${lengthBounds.min}-${lengthBounds.max}字之间，不得超过上限。`,
    `须语义完整并有收束（句号或完整引用收束），禁止两字敷衍、半句话、悬尾截断或未闭合引号。`,
    desensitize(normalized),
  ].join("\n");
  const timeoutMs = options && options.arkTimeoutMs;
  const modelId = resolveArkModelId(env, quadrantId);
  return callArkResponses(
    env,
    {
      instructions,
      userContent,
      meta: { quadrantId, cardField, textHash },
    },
    timeoutMs ? { timeoutMs, modelId } : { modelId },
  );
}

/**
 * @param {object} env
 * @param {object} v payload
 * @param {{ arkTimeoutMs?: number }} [options]
 */
async function requestDashscopeReply(env, v, options) {
  const { quadrantId, cardField, normalized, textHash, taskTitle, question } = v;
  const bounds = getReplyLengthBounds(normalized, quadrantId);
  const modelId = resolveDashscopeModelId(quadrantId, env);
  const isQ1 = Number(quadrantId) === QUADRANT_Q1_ID;
  const system = isQ1 ? getQ1PersonaSystem() : getQ4PersonaSystem();
  const userContent = isQ1
    ? buildQ1CardUserContent(taskTitle, question, normalized, cardField)
    : buildQ4CardUserContent(taskTitle, question, normalized, cardField);
  return callDashscopeChat(env, {
    modelId,
    system,
    userContent,
    maxTokens: Math.min(800, Math.max(200, Math.ceil(bounds.max * 2))),
    timeoutMs: options && options.arkTimeoutMs,
    meta: { quadrantId, cardField, textHash, phase: isQ1 ? "q1" : "q4" },
  });
}

/**
 * @param {object} env
 * @param {object} payload
 * @param {{ arkTimeoutMs?: number }} arkOpts
 * @param {string} agentType
 * @param {string} normalized
 * @param {{ allowRetryOnce?: boolean }} [options]
 */
async function produceArkReplyContent(env, payload, arkOpts, agentType, normalized, options) {
  const allowRetry = shouldProduceRetryOnce(options, payload.quadrantId);
  const maxAttempts = resolveProduceMaxAttempts(options, payload.quadrantId);
  let lastErrCode = "REPLY_INCOMPLETE";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const ark = await requestArkReply(env, payload, arkOpts);

    if (!ark.ok || !ark.text) {
      lastErrCode = ark.errCode || "ARK_FAILED";
      const canRetryTransport =
        allowRetry &&
        attempt < maxAttempts &&
        TRANSPORT_RETRY_CODES.has(lastErrCode);
      if (canRetryTransport) {
        logEvent({
          action: "generateReply",
          phase: "retry_transport",
          errCode: lastErrCode,
          quadrantId: payload.quadrantId,
          cardField: payload.cardField,
          textHash: payload.textHash,
        });
        continue;
      }
      return { ok: false, errCode: lastErrCode };
    }

    const assessed = finalizeAndAssessReply(
      ark.text,
      agentType,
      normalized,
      payload.quadrantId,
      payload.cardField,
    );
    if (assessed.ok) {
      return { ok: true, replyContent: assessed.text };
    }

    lastErrCode = assessed.reason || "REPLY_INCOMPLETE";
    logEvent({
      action: "generateReply",
      phase: "reply_incomplete",
      errCode: lastErrCode,
      quadrantId: payload.quadrantId,
      cardField: payload.cardField,
      textHash: payload.textHash,
      replyLen: charCount(assessed.text),
      q1C2Patch: isQ1C2StrictCard(payload.quadrantId, payload.cardField),
    });

    if (allowRetry && attempt < maxAttempts) {
      logEvent({
        action: "generateReply",
        phase: "retry_incomplete",
        errCode: lastErrCode,
        quadrantId: payload.quadrantId,
        cardField: payload.cardField,
        textHash: payload.textHash,
        q2Patch: Number(payload.quadrantId) === QUADRANT_Q2_ID,
      });
      continue;
    }

    return { ok: false, errCode: lastErrCode };
  }

  return { ok: false, errCode: lastErrCode };
}

/**
 * @param {object} env
 * @param {object} payload
 * @param {{ arkTimeoutMs?: number }} opts
 * @param {string} agentType
 * @param {string} normalized
 */
async function produceDashscopeReplyContent(env, payload, opts, agentType, normalized) {
  let lastErrCode = "REPLY_INCOMPLETE";

  for (let attempt = 1; attempt <= 2; attempt++) {
    const ds = await requestDashscopeReply(env, payload, opts);
    if (!ds.ok || !ds.text) {
      lastErrCode = ds.errCode || "DASHSCOPE_FAILED";
      if (attempt < 2 && TRANSPORT_RETRY_CODES.has(lastErrCode)) {
        logEvent({
          action: "generateReply",
          phase: "dashscope_retry_transport",
          errCode: lastErrCode,
          quadrantId: payload.quadrantId,
          cardField: payload.cardField,
          textHash: payload.textHash,
        });
        continue;
      }
      return { ok: false, errCode: lastErrCode };
    }

    const assessed = finalizeAndAssessReply(
      ds.text,
      agentType,
      normalized,
      payload.quadrantId,
      payload.cardField,
    );
    if (assessed.ok) {
      return { ok: true, replyContent: assessed.text };
    }

    lastErrCode = assessed.reason || "REPLY_INCOMPLETE";
    logEvent({
      action: "generateReply",
      phase: "dashscope_incomplete",
      errCode: lastErrCode,
      quadrantId: payload.quadrantId,
      cardField: payload.cardField,
      textHash: payload.textHash,
      replyLen: charCount(assessed.text),
      q1C2Patch: isQ1C2StrictCard(payload.quadrantId, payload.cardField),
    });
    return { ok: false, errCode: lastErrCode };
  }

  return { ok: false, errCode: lastErrCode };
}

/**
 * @param {object} db
 * @param {object} params
 * @param {{ arkTimeoutMs?: number, allowRetryOnce?: boolean }} [options]
 */
async function handleGenerateReply(db, params, options) {
  const v = validateGenerateReplyParams(params);
  if (!v.ok) {
    return { ok: false, errCode: v.errCode };
  }

  const { taskId, quadrantId, cardField, userText, agentType, taskTitle, question } = v.payload;
  const { normalized, hash: textHash } = buildTextHash(userText);
  const dashscope = usesDashscope(quadrantId);

  const cached = await findCache(db, { taskId, quadrantId, cardField, textHash });
  if (cached && !isFallbackReply(cached.replyContent)) {
    const cacheCheck = assessArkReplyForCard(quadrantId, cardField, cached.replyContent);
    if (cacheCheck.ok) {
      logEvent({
        action: "generateReply",
        quadrantId,
        cardField,
        textHash,
        fromCache: true,
      });
      return {
        ok: true,
        replyContent: cached.replyContent,
        fromCache: true,
        fallback: false,
        textHash,
      };
    }
    logEvent({
      level: "error",
      action: "generateReply",
      errCode: "CACHE_STALE_INVALID",
      reason: cacheCheck.reason || "",
      quadrantId,
      cardField,
      textHash,
      q1C2Patch: isQ1C2StrictCard(quadrantId, cardField),
    });
  } else if (cached && isFallbackReply(cached.replyContent)) {
    logEvent({
      level: "error",
      action: "generateReply",
      errCode: "CACHE_SKIP_FALLBACK",
      quadrantId,
      cardField,
      textHash,
    });
  }

  const arkOpts = {
    arkTimeoutMs: options && options.arkTimeoutMs,
  };
  const payload = {
    quadrantId,
    cardField,
    userText,
    agentType,
    normalized,
    textHash,
    taskTitle: taskTitle || "未命名任务",
    question: question || "",
  };

  if (dashscope) {
    const dsEnv = loadDashscopeEnv();
    if (!isDashscopeEnvReady(dsEnv)) {
      logEvent({
        level: "error",
        action: "generateReply",
        errCode: "DASHSCOPE_ENV_MISSING",
        quadrantId,
        cardField,
        textHash,
      });
      return { ok: false, errCode: "DASHSCOPE_ENV_MISSING", fallback: false, textHash };
    }

    const produced = await produceDashscopeReplyContent(
      dsEnv,
      payload,
      arkOpts,
      agentType,
      normalized,
    );
    if (!produced.ok || !produced.replyContent) {
      return {
        ok: false,
        errCode: produced.errCode || "DASHSCOPE_FAILED",
        fallback: false,
        textHash,
      };
    }

    const finalCheck = assessArkReplyForCard(quadrantId, cardField, produced.replyContent);
    if (!finalCheck.ok) {
      logEvent({
        level: "error",
        action: "generateReply",
        errCode: "REPLY_BLOCKED_BEFORE_CACHE",
        reason: finalCheck.reason || "",
        quadrantId,
        cardField,
        textHash,
        q1C2Patch: isQ1C2StrictCard(quadrantId, cardField),
      });
      return {
        ok: false,
        errCode: finalCheck.reason || "REPLY_INCOMPLETE",
        fallback: false,
        textHash,
      };
    }

    await upsertCache(db, {
      taskId,
      quadrantId,
      cardField,
      textHash,
      agentType,
      replyContent: produced.replyContent,
      createdAt: new Date(),
    });

    logEvent({
      action: "generateReply",
      errCode: "",
      quadrantId,
      cardField,
      textHash,
      fromCache: false,
      fallback: false,
      provider: "dashscope",
    });

    return {
      ok: true,
      replyContent: produced.replyContent,
      fromCache: false,
      fallback: false,
      textHash,
    };
  }

  const env = loadArkEnv();
  let replyContent = "";
  let fallback = false;
  let errCode = "";

  if (!isArkEnvReady(env)) {
    logEvent({
      level: "error",
      action: "generateReply",
      errCode: "ARK_ENV_MISSING",
      quadrantId,
      cardField,
      textHash,
    });
    errCode = "ARK_ENV_MISSING";
    fallback = true;
    replyContent = getFallbackReply(agentType);
  } else {
    const produced = await produceArkReplyContent(
      env,
      payload,
      arkOpts,
      agentType,
      normalized,
      options,
    );
    if (produced.ok && produced.replyContent) {
      replyContent = produced.replyContent;
    } else {
      errCode = produced.errCode || "ARK_FAILED";
      fallback = true;
      replyContent = getFallbackReply(agentType);
    }
  }

  if (fallback || !replyContent || charCount(replyContent) < 1) {
    fallback = true;
    if (!errCode) errCode = "FALLBACK";
    replyContent = getFallbackReply(agentType);
  }

  if (!fallback) {
    const finalCheck = assessArkReplyForCard(quadrantId, cardField, replyContent);
    if (!finalCheck.ok) {
      fallback = true;
      errCode = finalCheck.reason || "REPLY_INCOMPLETE";
      replyContent = getFallbackReply(agentType);
      logEvent({
        level: "error",
        action: "generateReply",
        errCode: "REPLY_BLOCKED_BEFORE_CACHE",
        reason: finalCheck.reason || "",
        quadrantId,
        cardField,
        textHash,
        q1C2Patch: isQ1C2StrictCard(quadrantId, cardField),
      });
    } else {
      await upsertCache(db, {
        taskId,
        quadrantId,
        cardField,
        textHash,
        agentType,
        replyContent,
        createdAt: new Date(),
      });
    }
  }

  logEvent({
    action: "generateReply",
    errCode: fallback ? errCode || "FALLBACK" : "",
    quadrantId,
    cardField,
    textHash,
    fromCache: false,
    fallback,
  });

  return {
    ok: true,
    replyContent,
    fromCache: false,
    fallback,
    textHash,
    errCode: fallback ? errCode : undefined,
  };
}

module.exports = {
  handleGenerateReply,
  shouldProduceRetryOnce,
  resolveProduceMaxAttempts,
  isQ1C2StrictCard,
  usesDashscope,
};
