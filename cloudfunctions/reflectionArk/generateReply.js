"use strict";

const { loadArkEnv, isArkEnvReady } = require("./env");
const { buildTextHash } = require("./textHash");
const { desensitize } = require("./desensitize");
const { getPersonaSystem } = require("./personas");
const { getFallbackReply, isFallbackReply } = require("./reflectionArkFallback");
const { finalizeReplyContent } = require("./openingCheck");
const { getReplyLengthBounds } = require("./replyLengthPolicy");
const { callArkResponses } = require("./arkClient");
const { findCache, upsertCache } = require("./cache");
const { validateGenerateReplyParams } = require("./validate");
const { logEvent } = require("./logger");
const { charCount } = require("./normalizeText");

/**
 * @param {object} env
 * @param {object} v payload
 * @param {{ arkTimeoutMs?: number }} [options]
 * @returns {Promise<{ ok: boolean, text?: string, errCode?: string }>}
 */
async function requestArkReply(env, v, options) {
  const { quadrantId, cardField, userText, agentType, normalized, textHash } = v;
  const lengthBounds = getReplyLengthBounds(normalized);
  const instructions = getPersonaSystem(agentType);
  const userContent = [
    `【哲思复盘·象限${quadrantId}·${cardField}】`,
    `以下为用户手写原文（已脱敏）。请紧扣原文用一段成文回应，字数严格控制在${lengthBounds.min}-${lengthBounds.max}字之间，不得超过上限：`,
    desensitize(normalized),
  ].join("\n");
  const timeoutMs = options && options.arkTimeoutMs;
  return callArkResponses(
    env,
    {
      instructions,
      userContent,
      meta: { quadrantId, cardField, textHash },
    },
    timeoutMs ? { timeoutMs } : undefined,
  );
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

  const { taskId, quadrantId, cardField, userText, agentType } = v.payload;
  const { normalized, hash: textHash } = buildTextHash(userText);

  const cached = await findCache(db, { taskId, quadrantId, cardField, textHash });
  if (cached && !isFallbackReply(cached.replyContent)) {
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
  if (cached && isFallbackReply(cached.replyContent)) {
    logEvent({
      level: "error",
      action: "generateReply",
      errCode: "CACHE_SKIP_FALLBACK",
      quadrantId,
      cardField,
      textHash,
    });
  }

  const env = loadArkEnv();
  let replyContent = "";
  let fallback = false;
  let errCode = "";

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
  };

  if (!isArkEnvReady(env)) {
    logEvent({
      level: "error",
      action: "generateReply",
      errCode: "ARK_ENV_MISSING",
      quadrantId,
      cardField,
      textHash,
    });
  }

  if (isArkEnvReady(env)) {
    let ark = await requestArkReply(env, payload, arkOpts);
    if (
      options &&
      options.allowRetryOnce &&
      (!ark.ok || !ark.text) &&
      (ark.errCode === "ARK_TIMEOUT" || ark.errCode === "ARK_EMPTY_OUTPUT" || ark.errCode === "ARK_NETWORK")
    ) {
      ark = await requestArkReply(env, payload, arkOpts);
    }

    if (ark.ok && ark.text) {
      replyContent = finalizeReplyContent(ark.text, agentType, normalized);
    } else {
      errCode = ark.errCode || "ARK_FAILED";
      fallback = true;
      replyContent = getFallbackReply(agentType);
    }
  } else {
    errCode = "ARK_ENV_MISSING";
    fallback = true;
    replyContent = getFallbackReply(agentType);
  }

  if (fallback || !replyContent || charCount(replyContent) < 1) {
    fallback = true;
    replyContent = getFallbackReply(agentType);
  }

  if (!fallback) {
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

module.exports = { handleGenerateReply };
