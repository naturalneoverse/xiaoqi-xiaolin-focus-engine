"use strict";

const DEFAULT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
/** 与 docs/reflection-ark-integration.md 默认模型一致 */
const DEFAULT_MODEL_ID = "doubao-seed-2-0-lite-260428";

/**
 * @returns {{ apiKey: string, baseUrl: string, modelId: string, responsesUrl: string }}
 */
function loadArkEnv() {
  const apiKey = String(process.env.ARK_API_KEY || "").trim();
  const baseUrl = String(process.env.ARK_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
  const modelId = String(process.env.ARK_MODEL_ID || DEFAULT_MODEL_ID).trim();
  return {
    apiKey,
    baseUrl,
    modelId,
    responsesUrl: `${baseUrl}/responses`,
  };
}

function isArkEnvReady(env) {
  return !!(env && env.apiKey && env.modelId && env.responsesUrl);
}

module.exports = {
  loadArkEnv,
  isArkEnvReady,
  DEFAULT_BASE_URL,
  DEFAULT_MODEL_ID,
};
