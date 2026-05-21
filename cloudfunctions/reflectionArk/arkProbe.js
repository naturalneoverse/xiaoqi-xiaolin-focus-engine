"use strict";

const { loadArkEnv, isArkEnvReady } = require("./env");
const { callArkResponses } = require("./arkClient");
const { ARK_TIMEOUT_MS } = require("./constants");

/**
 * 云开发控制台测试：action=arkProbe，探测方舟连通与耗时（不写缓存）
 */
async function handleArkProbe() {
  const env = loadArkEnv();
  if (!isArkEnvReady(env)) {
    return {
      ok: false,
      errCode: "ARK_ENV_MISSING",
      hasApiKey: !!env.apiKey,
      modelId: env.modelId || "",
    };
  }

  const started = Date.now();
  const ark = await callArkResponses(
    env,
    {
      instructions: "你是助手。只回复一个字：好。不要标点。",
      userContent: "ping",
      meta: { quadrantId: 0, cardField: "probe", textHash: "probe" },
    },
    { timeoutMs: ARK_TIMEOUT_MS },
  );

  return {
    ok: !!ark.ok,
    action: "arkProbe",
    errCode: ark.ok ? "OK" : ark.errCode || "ARK_FAILED",
    httpStatus: ark.httpStatus || 0,
    durationMs: Date.now() - started,
    textPreview: ark.text ? String(ark.text).slice(0, 20) : "",
  };
}

module.exports = { handleArkProbe };
