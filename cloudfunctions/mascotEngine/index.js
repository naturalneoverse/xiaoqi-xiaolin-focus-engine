/**
 * mascotEngine：云端入口（编排见 orchestrate.js）。
 * 部署：右键 mascotEngine → 上传并部署：云端安装依赖。
 */
"use strict";

const cloud = require("wx-server-sdk");
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const { runMascotPipeline, DATA_SCHEMA_VERSION, PROMPT_TEMPLATE_VERSION, MODEL_ID } = require("./orchestrate");

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openidHash =
    wxContext && wxContext.OPENID ? String(wxContext.OPENID).slice(0, 8) : "";

  const out = runMascotPipeline(event);
  console.log(
    "[mascotEngine]",
    JSON.stringify({
      ok: out.ok,
      ruleSceneType: out.adapted && out.adapted.ruleSceneType,
      ruleSubType: out.adapted && out.adapted.ruleSubType,
      textPreview: (out.text || "").slice(0, 40),
    }),
  );
  if (!out.ok) {
    return {
      success: false,
      errMsg: out.errMsg,
      text: out.text,
      meta: {
        dataSchemaVersion: DATA_SCHEMA_VERSION,
        openidHash,
      },
    };
  }

  return {
    success: true,
    text: out.text,
    meta: {
      dataSchemaVersion: DATA_SCHEMA_VERSION,
      promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
      modelId: MODEL_ID,
      openidHash,
      ruleSceneType: out.adapted.ruleSceneType,
      ruleSubType: out.adapted.ruleSubType,
    },
  };
};
