"use strict";

const { loadDashscopeEnv, isDashscopeEnvReady } = require("./dashscopeEnv");
const { callDashscopeChat } = require("./dashscopeClient");
const { ARK_TIMEOUT_MS } = require("./constants");
const C = require("./bodyWeekCareConstants");
const { getBodyWeekCareSystem, buildBodyWeekCareUserContent } = require("./bodyWeekCarePrompts");
const {
  validateGenerateBodyWeekCareParams,
  extractJsonObject,
  assessBodyWeekCareOutput,
} = require("./bodyWeekCareValidate");
const { logEvent } = require("./logger");

const TRANSPORT_RETRY_CODES = new Set([
  "DASHSCOPE_TIMEOUT",
  "DASHSCOPE_NETWORK",
  "DASHSCOPE_EMPTY",
  "DASHSCOPE_FAILED",
]);

const VALIDATION_RETRY_CODES = new Set([
  "PARSE_JSON_FAILED",
  "OUTPUT_FIELD_MISSING",
  "STATUS_DESC_LENGTH",
  "statusDesc_too_short",
  "statusDesc_too_long",
  "CARE_TEXT_LENGTH",
  "careText_too_short",
  "careText_over_hard_max",
  "FORBIDDEN_STATUS_DESC",
  "FORBIDDEN_CARE_TEXT",
  "EXTREME_NOT_IN_STATUS_DESC",
  "CARE_TEXT_REPEATS_STATUS",
]);

/**
 * @param {object} env
 * @param {object} payload
 * @param {{ timeoutMs?: number }} [opts]
 */
async function requestBodyWeekCare(env, payload, opts) {
  const system = getBodyWeekCareSystem();
  const userContent = buildBodyWeekCareUserContent(
    payload.bullets,
    payload.finalStatusTitle,
    payload.weekKey,
    payload.dayCount,
  );

  return callDashscopeChat(env, {
    modelId: env.modelQ1,
    system,
    userContent,
    maxTokens: 600,
    timeoutMs: (opts && opts.timeoutMs) || ARK_TIMEOUT_MS,
    meta: {
      phase: "bodyWeekCare",
      weekKey: payload.weekKey,
      dayCount: payload.dayCount,
    },
  });
}

/**
 * @param {object} _db
 * @param {object} event
 */
async function handleGenerateBodyWeekCare(_db, event) {
  const v = validateGenerateBodyWeekCareParams(event || {});
  if (!v.ok) {
    return { ok: false, errCode: v.errCode };
  }

  const payload = v.payload;
  const dsEnv = loadDashscopeEnv();
  if (!isDashscopeEnvReady(dsEnv)) {
    logEvent({
      level: "error",
      action: "generateBodyWeekCare",
      errCode: "DASHSCOPE_ENV_MISSING",
      weekKey: payload.weekKey,
    });
    return { ok: false, errCode: "DASHSCOPE_ENV_MISSING" };
  }

  let lastErrCode = "BODY_WEEK_CARE_FAILED";

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const ds = await requestBodyWeekCare(dsEnv, payload, event || {});
    if (!ds.ok || !ds.text) {
      lastErrCode = ds.errCode || "DASHSCOPE_FAILED";
      if (attempt < 2 && TRANSPORT_RETRY_CODES.has(lastErrCode)) {
        logEvent({
          action: "generateBodyWeekCare",
          phase: "dashscope_retry_transport",
          errCode: lastErrCode,
          weekKey: payload.weekKey,
          attempt,
        });
        continue;
      }
      return { ok: false, errCode: lastErrCode };
    }

    const parsed = extractJsonObject(ds.text);
    const assessed = assessBodyWeekCareOutput(payload.bullets, parsed);
    if (assessed.ok) {
      logEvent({
        action: "generateBodyWeekCare",
        phase: "ok",
        weekKey: payload.weekKey,
        dayCount: payload.dayCount,
        statusDescChars: C.countChars(assessed.statusDesc),
        careTextChars: C.countChars(assessed.careText),
        attempt,
      });
      return {
        ok: true,
        statusDesc: assessed.statusDesc,
        careText: assessed.careText,
        statusDescChars: C.countChars(assessed.statusDesc),
        careTextChars: C.countChars(assessed.careText),
      };
    }

    lastErrCode = assessed.errCode || "BODY_WEEK_CARE_INVALID";
    logEvent({
      action: "generateBodyWeekCare",
      phase: "validation_failed",
      errCode: lastErrCode,
      weekKey: payload.weekKey,
      attempt,
      preview: String(ds.text || "").slice(0, 120),
    });

    if (attempt < 2 && VALIDATION_RETRY_CODES.has(lastErrCode)) {
      continue;
    }
    return { ok: false, errCode: lastErrCode };
  }

  return { ok: false, errCode: lastErrCode };
}

module.exports = {
  handleGenerateBodyWeekCare,
  requestBodyWeekCare,
  TRANSPORT_RETRY_CODES,
  VALIDATION_RETRY_CODES,
};
