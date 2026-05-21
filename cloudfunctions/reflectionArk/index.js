/**

 * reflectionArk：哲思复盘四象限手写文本 · 火山方舟 Responses API

 *

 * 部署：微信开发者工具 → cloudfunctions/reflectionArk → 上传并部署（云端安装依赖）

 * 环境变量（云开发控制台）：ARK_API_KEY、ARK_BASE_URL、ARK_MODEL_ID

 * 超时（测试档）：config.json 60s；双卡 generateQuadrantBatch 并行，每张 25s

 */

"use strict";



const cloud = require("wx-server-sdk");

const { handleGenerateReply } = require("./generateReply");

const { handleGenerateQuadrantBatch } = require("./generateQuadrantBatch");

const { handleMsgSecCheck } = require("./msgSecCheck");
const { handleArkProbe } = require("./arkProbe");



cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });



const ACTIONS = {

  generateReply: handleGenerateReply,

  generateQuadrantBatch: handleGenerateQuadrantBatch,

  msgSecCheck: async (_db, event) => handleMsgSecCheck(event || {}),

  arkProbe: async (_db, _event) => handleArkProbe(),

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

    if (action === "arkProbe") {
      return await handler(null, event);
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



    const db = cloud.database();

    const out = await handler(db, event);



    if (action === "generateQuadrantBatch") {

      if (!out.ok) {

        return {

          ok: false,

          action: "generateQuadrantBatch",

          errCode: out.errCode || "BATCH_FAILED",

          errMsg: "批量生成失败",

        };

      }

      return {

        ok: true,

        action: "generateQuadrantBatch",

        replies: out.replies || [],

        fallbackCount: out.fallbackCount != null ? out.fallbackCount : 0,

        batchMode: out.batchMode || "",

        arkTimeoutMs: out.arkTimeoutMs || 0,

      };

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


