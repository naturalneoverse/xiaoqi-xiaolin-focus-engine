"use strict";

const DEFAULT_DASHSCOPE_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";

/**
 * @returns {{
 *   apiKey: string,
 *   baseUrl: string,
 *   chatCompletionsUrl: string,
 *   modelQ1: string,
 *   modelQ4: string,
 * }}
 */
function loadDashscopeEnv() {
  const apiKey = String(process.env.DASHSCOPE_API_KEY || "").trim();
  const baseUrl = String(process.env.DASHSCOPE_BASE_URL || DEFAULT_DASHSCOPE_BASE_URL)
    .trim()
    .replace(/\/+$/, "");
  const modelQ1 = String(
    process.env.DASHSCOPE_MODEL_Q1 || process.env.DASHSCOPE_MODEL_ID_Q1 || "qwen3.7-max",
  ).trim();
  const modelQ4 = String(
    process.env.DASHSCOPE_MODEL_Q4 || process.env.DASHSCOPE_MODEL_ID_Q4 || "deepseek-v4-pro",
  ).trim();
  return {
    apiKey,
    baseUrl,
    chatCompletionsUrl: `${baseUrl}/chat/completions`,
    modelQ1,
    modelQ4,
  };
}

function isDashscopeEnvReady(env) {
  return !!(env && env.apiKey && env.chatCompletionsUrl && env.modelQ1 && env.modelQ4);
}

/**
 * @param {number} quadrantId
 * @param {object} env
 * @returns {string}
 */
function resolveDashscopeModelId(quadrantId, env) {
  const e = env || loadDashscopeEnv();
  if (Number(quadrantId) === 4) return e.modelQ4;
  if (Number(quadrantId) === 1) return e.modelQ1;
  return "";
}

module.exports = {
  loadDashscopeEnv,
  isDashscopeEnvReady,
  resolveDashscopeModelId,
  DEFAULT_DASHSCOPE_BASE_URL,
};
