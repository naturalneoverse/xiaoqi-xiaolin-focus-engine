"use strict";

const { loadArkEnv, isArkEnvReady, isQ2DeepEnvReady } = require("./env");
const { callArkResponses } = require("./arkClient");
const { ARK_TIMEOUT_MS, ARK_MAX_OUTPUT_TOKENS_Q2_STAGE_B } = require("./constants");

/**
 * 云开发控制台：{ "action": "arkProbeQ2" } — 探测 Q2 DeepSeek Endpoint
 */
async function handleArkProbeQ2() {
  const env = loadArkEnv();
  if (!isArkEnvReady(env)) {
    return {
      ok: false,
      errCode: "ARK_ENV_MISSING",
      hasApiKey: !!env.apiKey,
      modelId: env.modelId || "",
      modelIdQ2Deep: env.modelIdQ2Deep || "",
    };
  }
  if (!isQ2DeepEnvReady(env)) {
    return {
      ok: false,
      errCode: "ARK_Q2_DEEP_MISSING",
      modelIdQ2Deep: "",
    };
  }

  const started = Date.now();
  const ark = await callArkResponses(
    env,
    {
      instructions: "你是助手。严格按格式输出两行标记与短句。",
      userContent: [
        "【输出格式】",
        "===c1===",
        "测试一。",
        "===c2===",
        "测试二。",
      ].join("\n"),
      meta: { quadrantId: 2, cardField: "probe_q2", phase: "probe" },
    },
    {
      timeoutMs: ARK_TIMEOUT_MS,
      modelId: env.modelIdQ2Deep,
      maxOutputTokens: ARK_MAX_OUTPUT_TOKENS_Q2_STAGE_B,
    },
  );

  return {
    ok: !!ark.ok,
    action: "arkProbeQ2",
    errCode: ark.ok ? "OK" : ark.errCode || "ARK_FAILED",
    httpStatus: ark.httpStatus || 0,
    durationMs: Date.now() - started,
    modelIdQ2Deep: env.modelIdQ2Deep,
    textPreview: ark.text ? String(ark.text).slice(0, 80) : "",
  };
}

module.exports = { handleArkProbeQ2 };
