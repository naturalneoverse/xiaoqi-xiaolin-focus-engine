"use strict";



const DEFAULT_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";

/** 豆包 Endpoint（火山方舟控制台）；生产以云函数环境变量 ARK_MODEL_ID 为准 */

const DEFAULT_MODEL_ID = "ep-m-20260521214207-hxl7h";



/**

 * @returns {{

 *   apiKey: string,

 *   baseUrl: string,

 *   modelId: string,

 *   modelIdQ2Deep: string,

 *   modelIdQ1: string,

 *   modelIdQ4: string,

 *   responsesUrl: string,

 * }}

 */

function loadArkEnv() {

  const apiKey = String(process.env.ARK_API_KEY || "").trim();

  const baseUrl = String(process.env.ARK_BASE_URL || DEFAULT_BASE_URL).trim().replace(/\/+$/, "");

  const modelId = String(process.env.ARK_MODEL_ID || DEFAULT_MODEL_ID).trim();

  const modelIdQ2Deep = String(process.env.ARK_MODEL_ID_Q2_DEEP || "").trim();

  const modelIdQ1 = String(

    process.env.ARK_MODEL_ID_Q1 ||

      process.env.ARK_MODEL_ID_HUNYUAN ||

      "",

  ).trim();

  const modelIdQ4 = String(

    process.env.ARK_MODEL_ID_Q4 || process.env.ARK_MODEL_ID_QWEN || "",

  ).trim();

  return {

    apiKey,

    baseUrl,

    modelId,

    modelIdQ2Deep,

    modelIdQ1: modelIdQ1 || modelId,

    modelIdQ4: modelIdQ4 || modelId,

    responsesUrl: `${baseUrl}/responses`,

  };

}



function isArkEnvReady(env) {

  return !!(env && env.apiKey && env.modelId && env.responsesUrl);

}



/** Q2/Q3 阶段 B 是否已配置 DeepSeek Endpoint */

function isQ2DeepEnvReady(env) {

  return !!(env && env.modelIdQ2Deep);

}



module.exports = {

  loadArkEnv,

  isArkEnvReady,

  isQ2DeepEnvReady,

  DEFAULT_BASE_URL,

  DEFAULT_MODEL_ID,

};

