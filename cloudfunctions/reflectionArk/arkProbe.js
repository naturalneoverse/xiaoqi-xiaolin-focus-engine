"use strict";

const { loadArkEnv, isArkEnvReady, isQ2DeepEnvReady, DEFAULT_MODEL_ID } = require("./env");
const { loadDashscopeEnv, isDashscopeEnvReady } = require("./dashscopeEnv");
const { callArkResponses } = require("./arkClient");
const { ARK_TIMEOUT_MS, DEPLOY_TAG } = require("./constants");

/**
 * 云开发控制台：{ "action": "arkEnvCheck" } — 核对环境变量（不调用模型）
 */
async function handleArkEnvCheck() {
  const env = loadArkEnv();
  const dsEnv = loadDashscopeEnv();
  return {
    ok: true,
    action: "arkEnvCheck",
    deployTag: DEPLOY_TAG,
    hasApiKey: !!env.apiKey,
    modelId: env.modelId || "",
    modelIdQ2Deep: env.modelIdQ2Deep || "",
    modelIdQ1: env.modelIdQ1 || "",
    modelIdQ4: env.modelIdQ4 || "",
    expectedModelId: DEFAULT_MODEL_ID,
    modelIdMatchesExpected: env.modelId === DEFAULT_MODEL_ID,
    arkEnvReady: isArkEnvReady(env),
    q2DeepEnvReady: isQ2DeepEnvReady(env),
    dashscopeReady: isDashscopeEnvReady(dsEnv),
    dashscopeModelQ1: dsEnv.modelQ1 || "",
    dashscopeModelQ4: dsEnv.modelQ4 || "",
    hasDashscopeApiKey: !!dsEnv.apiKey,
  };
}

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

module.exports = { handleArkProbe, handleArkEnvCheck };

