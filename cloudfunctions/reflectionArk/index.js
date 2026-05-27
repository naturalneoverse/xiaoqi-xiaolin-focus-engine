/**

 * reflectionArk：哲思复盘四象限手写文本 · 火山方舟 Responses API

 *

 * 部署：微信开发者工具 → cloudfunctions/reflectionArk → 上传并部署（云端安装依赖）

 * 环境变量：ARK_API_KEY、ARK_BASE_URL、ARK_MODEL_ID、ARK_MODEL_ID_Q2_DEEP；
 * DASHSCOPE_API_KEY、DASHSCOPE_MODEL_Q1（qwen3.7-max）、DASHSCOPE_MODEL_Q4（deepseek-v4-pro）；
 * generateBodyWeekCare / bodyWeekCareProbe：身体周报 statusDesc + careText（百炼 Q1 模型）

 * 超时：config.json / 控制台 60s；generateQuadrantBatch 串行 + 超时卡补打一轮

 */

"use strict";



const cloud = require("wx-server-sdk");

const { handleGenerateReply } = require("./generateReply");

const { handleGenerateQuadrantBatch } = require("./generateQuadrantBatch");
const {
  handleGenerateQuadrantQ2StageA,
  handleGenerateQuadrantQ2StageB,
} = require("./generateQuadrantQ2S2");
const {
  handleGenerateQuadrantQ3StageA,
  handleGenerateQuadrantQ3StageB,
} = require("./generateQuadrantQ3S2");

const { handleMsgSecCheck } = require("./msgSecCheck");
const { handleArkProbe, handleArkEnvCheck } = require("./arkProbe");
const { handleDashscopeProbe } = require("./arkProbeDashscope");
const { handleGenerateBodyWeekCare } = require("./generateBodyWeekCare");
const { handleBodyWeekCareProbe } = require("./bodyWeekCareProbe");
const { handleArkProbeQ2 } = require("./arkProbeQ2");
const { handleArkProbeQ2StageA } = require("./arkProbeQ2StageA");
const { handleArkProbeQ3StageA } = require("./arkProbeQ3StageA");
const { DEPLOY_TAG } = require("./constants");



cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });



const ACTIONS = {

  generateReply: handleGenerateReply,

  generateQuadrantBatch: handleGenerateQuadrantBatch,

  generateQuadrantQ2StageA: handleGenerateQuadrantQ2StageA,

  generateQuadrantQ2StageB: handleGenerateQuadrantQ2StageB,

  generateQuadrantQ3StageA: handleGenerateQuadrantQ3StageA,

  generateQuadrantQ3StageB: handleGenerateQuadrantQ3StageB,

  msgSecCheck: async (_db, event) => handleMsgSecCheck(event || {}),

  arkProbe: async (_db, _event) => handleArkProbe(),

  arkEnvCheck: async (_db, _event) => handleArkEnvCheck(),

  dashscopeProbe: async (_db, _event) => handleDashscopeProbe(),

  generateBodyWeekCare: async (_db, event) => handleGenerateBodyWeekCare(null, event || {}),

  bodyWeekCareProbe: async (_db, _event) => handleBodyWeekCareProbe(),

  arkProbeQ2: async (_db, _event) => handleArkProbeQ2(),

  arkProbeQ2StageA: (db, _event) => handleArkProbeQ2StageA(db),

  arkProbeQ3StageA: (db, _event) => handleArkProbeQ3StageA(db),

};



/**

 * @param {object} event

 */

exports.main = async (event) => {

  const action = String((event && event.action) || "").trim();

  const batchSize =

    action === "generateQuadrantBatch" && event && event.items ? event.items.length : 0;

  console.log(

    JSON.stringify({

      tag: "reflectionArk",

      phase: "invoke",

      action,

      quadrantId: event && event.quadrantId != null ? event.quadrantId : "",

      cardField: (event && event.cardField) || "",

      batchSize,
      deployTag: DEPLOY_TAG,

    }),

  );

  const handler = ACTIONS[action];



  if (!handler) {

    return {

      ok: false,

      errCode: "UNKNOWN_ACTION",

      errMsg: "未知 action",

    };

  }



  try {

    if (
      action === "arkProbe" ||
      action === "arkProbeQ2" ||
      action === "arkEnvCheck" ||
      action === "dashscopeProbe" ||
      action === "bodyWeekCareProbe"
    ) {
      return await handler(null, event);
    }

    const db = cloud.database();

    if (action === "arkProbeQ2StageA" || action === "arkProbeQ3StageA") {
      return await handler(db, event);
    }

    if (action === "msgSecCheck") {

      const out = await handler(null, event);

      if (!out.ok) {

        return {

          ok: false,

          errCode: out.errCode || "MSG_SEC_REJECT",

          errMsg: "内容未通过安全审核",

        };

      }

      return { ok: true, action: "msgSecCheck" };

    }

    const out = await handler(db, event);

    if (action === "generateBodyWeekCare") {
      if (!out.ok) {
        return {
          ok: false,
          action,
          errCode: out.errCode || "BODY_WEEK_CARE_FAILED",
          errMsg: "身体周报成文失败",
          deployTag: DEPLOY_TAG,
        };
      }
      return {
        ok: true,
        action,
        deployTag: DEPLOY_TAG,
        statusDesc: out.statusDesc,
        careText: out.careText,
        statusDescChars: out.statusDescChars,
        careTextChars: out.careTextChars,
      };
    }

    if (
      action === "generateQuadrantBatch" ||
      action === "generateQuadrantQ2StageA" ||
      action === "generateQuadrantQ2StageB" ||
      action === "generateQuadrantQ3StageA" ||
      action === "generateQuadrantQ3StageB"
    ) {

      if (!out.ok) {

        return {

          ok: false,

          action,

          errCode: out.errCode || "BATCH_FAILED",

          errMsg: "批量生成失败",

        };

      }

      return Object.assign(
        {
          ok: true,
          action,
          deployTag: DEPLOY_TAG,
        },
        out,
      );

    }



    if (!out.ok) {

      return {

        ok: false,

        action: "generateReply",

        errCode: out.errCode || "GENERATE_FAILED",

        errMsg: "生成失败",

      };

    }

    const replyContent = String(out.replyContent || "");

    return {

      ok: true,

      action: "generateReply",

      replyContent,

      fromCache: !!out.fromCache,

      fallback: !!out.fallback,

      textHash: out.textHash,

      errCode: out.errCode,

      replyChars: Array.from(replyContent).length,

    };

  } catch (e) {

    const code = (e && e.errCode) || "INTERNAL_ERROR";

    console.error(

      JSON.stringify({

        tag: "reflectionArk",

        action,

        errCode: String(code).slice(0, 32),

      }),

    );

    return {

      ok: false,

      errCode: "INTERNAL_ERROR",

      errMsg: "服务暂时不可用",

    };

  }

};


