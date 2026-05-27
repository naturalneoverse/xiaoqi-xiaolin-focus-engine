"use strict";

const { loadDashscopeEnv, isDashscopeEnvReady } = require("./dashscopeEnv");
const { callDashscopeChat } = require("./dashscopeClient");
const { ARK_TIMEOUT_MS, DEPLOY_TAG } = require("./constants");

/**
 * 云开发控制台：{ "action": "dashscopeProbe" } — 探测百炼连通（不写缓存）
 */
async function handleDashscopeProbe() {
  const env = loadDashscopeEnv();
  if (!isDashscopeEnvReady(env)) {
    return {
      ok: false,
      action: "dashscopeProbe",
      errCode: "DASHSCOPE_ENV_MISSING",
      hasApiKey: !!env.apiKey,
      modelQ1: env.modelQ1 || "",
      modelQ4: env.modelQ4 || "",
    };
  }

  const started = Date.now();
  const ds = await callDashscopeChat(env, {
    modelId: env.modelQ1,
    system: "你是助手。只回复一个字：好。不要标点。",
    userContent: "ping",
    maxTokens: 16,
    timeoutMs: ARK_TIMEOUT_MS,
    meta: { phase: "probe", quadrantId: 1, cardField: "probe" },
  });

  return {
    ok: !!ds.ok,
    action: "dashscopeProbe",
    errCode: ds.ok ? "OK" : ds.errCode || "DASHSCOPE_FAILED",
    durationMs: Date.now() - started,
    modelQ1: env.modelQ1,
    modelQ4: env.modelQ4,
    textPreview: ds.text ? String(ds.text).slice(0, 20) : "",
  };
}

module.exports = {
  handleDashscopeProbe,
};
