/**
 * 纯编排逻辑（不依赖 wx-server-sdk），供 index 与本地 smoke 共用。
 */
const { adaptForPipeline } = require("./pipelineAdapter");
const { getRuleText } = require("./rulesEngine");
const { filterWithFallback } = require("./postFilter");

const DATA_SCHEMA_VERSION = "1";
const PROMPT_TEMPLATE_VERSION = "rules-mvp-1";
const MODEL_ID = "none";

function runMascotPipeline(event) {
  const dataSchemaVersion = (event && event.dataSchemaVersion) || DATA_SCHEMA_VERSION;
  if (String(dataSchemaVersion) !== DATA_SCHEMA_VERSION) {
    return {
      ok: false,
      errMsg: "unsupported dataSchemaVersion",
      text: filterWithFallback("", { scene: "body_daily" }),
      adapted: { ruleSceneType: "body_daily", ruleSubType: null, stats: null, rawData: null },
    };
  }

  const adapted = adaptForPipeline({
    scene: event && event.scene,
    subType: event && event.subType,
    stats: event && event.stats,
    rawData: event && event.rawData,
  });

  let text = getRuleText(adapted.ruleSceneType, adapted.ruleSubType, adapted.stats);
  text = filterWithFallback(text, { scene: adapted.ruleSceneType });

  return {
    ok: true,
    text,
    adapted,
    versions: {
      dataSchemaVersion: DATA_SCHEMA_VERSION,
      promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
      modelId: MODEL_ID,
    },
  };
}

module.exports = {
  runMascotPipeline,
  DATA_SCHEMA_VERSION,
  PROMPT_TEMPLATE_VERSION,
  MODEL_ID,
};
