/**
 * reflectionArk 云函数客户端（内容安全 + 生成解读）
 * 不直连火山方舟；异常对用户静默，由云函数兜底 replyContent。
 */

const { callFunction, isCloudReady } = require("./cloudCall");
const {
  CLOUD_FUNCTION_NAME,
  MSG_SEC_TIMEOUT_MS,
  GENERATE_REPLY_TIMEOUT_MS,
  MSG_SEC_REJECT_HINT,
  hintForMsgSecErrCode,
  ERR_CLOUD_NOT_READY,
} = require("../config/reflectionArkConfig");
const { joinTargetsForSecCheck } = require("../config/reflectionArkApiMap");
const { rememberReplyInMemory } = require("./reflectionArkCache");

function unwrapResult(res) {
  return res && res.result != null ? res.result : null;
}

/**
 * @param {object} result
 */
function normalizeGenerateSuccess(result) {
  return {
    ok: true,
    replyContent: String((result && result.replyContent) || ""),
    fromCache: !!(result && result.fromCache),
    fallback: !!(result && result.fallback),
    textHash: String((result && result.textHash) || ""),
    errCode: result && result.errCode,
  };
}

/**
 * 内容安全：单段文本
 * @param {string} content
 * @returns {Promise<{ ok: boolean, errCode?: string, hint?: string }>}
 */
function msgSecCheck(content) {
  const text = String(content || "").trim();
  if (!text) return Promise.resolve({ ok: true });
  if (!isCloudReady()) {
    return Promise.resolve({ ok: false, errCode: ERR_CLOUD_NOT_READY, hint: "网络未就绪，请稍后再试" });
  }
  return callFunction(
    {
      name: CLOUD_FUNCTION_NAME,
      data: { action: "msgSecCheck", content: text },
    },
    MSG_SEC_TIMEOUT_MS,
  )
    .then((res) => {
      const result = unwrapResult(res);
      if (result && result.ok) return { ok: true };
      const errCode = (result && result.errCode) || "MSG_SEC_REJECT";
      return {
        ok: false,
        errCode,
        hint: hintForMsgSecErrCode(errCode),
      };
    })
    .catch(() => ({
      ok: false,
      errCode: "MSG_SEC_ERROR",
      hint: hintForMsgSecErrCode("MSG_SEC_ERROR"),
    }));
}

/**
 * 内容安全：象限内多段手写合并一次审核（PRD 推荐）
 * @param {{ userText: string }[]|string[]} targetsOrTexts
 */
function msgSecCheckBatch(targetsOrTexts) {
  let joined = "";
  if (Array.isArray(targetsOrTexts) && targetsOrTexts.length) {
    if (typeof targetsOrTexts[0] === "string") {
      joined = targetsOrTexts.map((s) => String(s || "").trim()).filter(Boolean).join("\n");
    } else {
      joined = joinTargetsForSecCheck(targetsOrTexts);
    }
  }
  return msgSecCheck(joined);
}

/**
 * 单张手写卡生成解读（写缓存由云函数完成）
 * @param {{ taskId: string, quadrantId: number, cardField: string, userText: string, agentType: string }} params
 */
function generateReply(params) {
  const taskId = String((params && params.taskId) || "").trim();
  const quadrantId = Number(params && params.quadrantId);
  const cardField = String((params && params.cardField) || "").trim();
  const userText = String((params && params.userText) || "");
  const agentType = String((params && params.agentType) || "").toLowerCase();

  if (!taskId || !cardField || !quadrantId || !userText.trim()) {
    return Promise.resolve({ ok: false, errCode: "INVALID_PARAMS" });
  }
  if (!isCloudReady()) {
    return Promise.resolve({ ok: false, errCode: ERR_CLOUD_NOT_READY });
  }

  return callFunction(
    {
      name: CLOUD_FUNCTION_NAME,
      data: {
        action: "generateReply",
        taskId,
        quadrantId,
        cardField,
        userText,
        agentType,
      },
    },
    GENERATE_REPLY_TIMEOUT_MS,
  )
    .then((res) => {
      const result = unwrapResult(res);
      if (!result || !result.ok) {
        return {
          ok: false,
          errCode: (result && result.errCode) || "GENERATE_FAILED",
        };
      }
      const out = normalizeGenerateSuccess(result);
      if (out.textHash && out.replyContent && !out.fallback) {
        rememberReplyInMemory(taskId, quadrantId, cardField, out.textHash, out.replyContent, agentType);
      }
      return out;
    })
    .catch(() => ({ ok: false, errCode: "GENERATE_NETWORK" }));
}

/**
 * 单象限多卡：一次云函数内批量生成（避免多次 callFunction 导致只成功一张）
 * @param {string} taskId
 * @param {number} quadrantId
 * @param {{ cardField: string, userText: string, agentType: string }[]} targets
 * @param {{ onCardStart?: function, onCardDone?: function }} [hooks]
 */
function generateQuadrantBatch(taskId, quadrantId, targets, hooks) {
  const list = Array.isArray(targets) ? targets.slice() : [];
  if (!list.length) return Promise.resolve([]);
  if (!isCloudReady()) {
    return Promise.resolve(list.map((item) => Object.assign({}, item, { ok: false, errCode: ERR_CLOUD_NOT_READY })));
  }

  if (hooks && typeof hooks.onCardStart === "function") {
    list.forEach((item) => hooks.onCardStart(item));
  }

  return callFunction(
    {
      name: CLOUD_FUNCTION_NAME,
      data: {
        action: "generateQuadrantBatch",
        taskId: String(taskId || "").trim(),
        quadrantId: Number(quadrantId),
        items: list.map((item) => ({
          cardField: item.cardField,
          userText: item.userText,
          agentType: item.agentType,
        })),
      },
    },
    GENERATE_REPLY_TIMEOUT_MS,
  )
    .then((res) => {
      const result = unwrapResult(res);
      if (!result || !result.ok || !Array.isArray(result.replies)) {
        return list.map((item) =>
          Object.assign({}, item, { ok: false, errCode: (result && result.errCode) || "BATCH_FAILED" }),
        );
      }
      const byField = {};
      result.replies.forEach((row) => {
        if (row && row.cardField) byField[row.cardField] = row;
      });
      return list.map((item) => {
        const row = byField[item.cardField] || {};
        const out = {
          ok: row.ok !== false,
          replyContent: String(row.replyContent || ""),
          fromCache: !!row.fromCache,
          fallback: !!row.fallback,
          textHash: String(row.textHash || ""),
          errCode: row.errCode || "",
        };
        const merged = Object.assign({}, item, out);
        if (out.textHash && out.replyContent && !out.fallback) {
          rememberReplyInMemory(
            taskId,
            quadrantId,
            item.cardField,
            out.textHash,
            out.replyContent,
            item.agentType,
          );
        }
        if (hooks && typeof hooks.onCardDone === "function") {
          hooks.onCardDone(merged);
        }
        return merged;
      });
    })
    .catch(() =>
      list.map((item) => Object.assign({}, item, { ok: false, errCode: "GENERATE_NETWORK" })),
    );
}

/**
 * 提交前：审核 + 串行生成
 * @param {string} taskId
 * @param {number} quadrantId
 * @param {{ textValues?: object, multiValues?: object, multiExpandValues?: object }} form
 * @param {{ onCardStart?: function, onCardDone?: function }} [hooks]
 */
function submitQuadrantHandwritingPipeline(taskId, quadrantId, form, hooks) {
  const { collectHandwritingApiTargets } = require("../config/reflectionArkApiMap");
  const targets = collectHandwritingApiTargets(quadrantId, form);
  if (!targets.length) {
    return Promise.resolve({ sec: { ok: true }, replies: [] });
  }
  return msgSecCheckBatch(targets).then((sec) => {
    if (!sec.ok) return { sec, replies: [] };
    const enriched = targets.map((t) =>
      Object.assign({ taskId, quadrantId: Number(quadrantId) }, t),
    );
    return generateQuadrantBatch(taskId, quadrantId, enriched, hooks).then((replies) => ({
      sec,
      replies,
    }));
  });
}

module.exports = {
  msgSecCheck,
  msgSecCheckBatch,
  generateReply,
  generateQuadrantBatch,
  submitQuadrantHandwritingPipeline,
  MSG_SEC_REJECT_HINT,
};
