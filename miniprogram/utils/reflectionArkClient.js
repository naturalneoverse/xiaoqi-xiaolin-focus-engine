/**
 * reflectionArk 云函数客户端（内容安全 + 生成解读）
 * 不直连火山方舟；异常对用户静默，由云函数兜底 replyContent。
 */

const { callFunction, isCloudReady } = require("./cloudCall");
const {
  CLOUD_FUNCTION_NAME,
  MSG_SEC_TIMEOUT_MS,
  GENERATE_REPLY_TIMEOUT_MS,
  Q2_PHASE_TIMEOUT_MS,
  EXPECTED_Q2_DEPLOY_TAG,
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
 * @param {{ taskTitle?: string }} [opts]
 */
function generateQuadrantBatch(taskId, quadrantId, targets, hooks, opts) {
  const list = Array.isArray(targets) ? targets.slice() : [];
  if (!list.length) return Promise.resolve([]);
  if (!isCloudReady()) {
    return Promise.resolve(list.map((item) => Object.assign({}, item, { ok: false, errCode: ERR_CLOUD_NOT_READY })));
  }

  if (Number(quadrantId) === 2) {
    return generateQ2S2Blocking(taskId, list, {
      taskTitle: opts && opts.taskTitle != null ? opts.taskTitle : "",
    });
  }
  if (Number(quadrantId) === 3) {
    return generateQ3S2Blocking(taskId, list, {
      taskTitle: opts && opts.taskTitle != null ? opts.taskTitle : "",
    });
  }

  if (hooks && typeof hooks.onCardStart === "function") {
    list.forEach((item) => hooks.onCardStart(item));
  }

  const data = {
    action: "generateQuadrantBatch",
    taskId: String(taskId || "").trim(),
    quadrantId: Number(quadrantId),
    items: list.map((item) => {
      const row = {
        cardField: item.cardField,
        userText: item.userText,
        agentType: item.agentType,
      };
      if ((Number(quadrantId) === 1 || Number(quadrantId) === 2 || Number(quadrantId) === 3 || Number(quadrantId) === 4) && item.question) {
        row.question = String(item.question).trim();
      }
      return row;
    }),
  };
  if (Number(quadrantId) === 1 || Number(quadrantId) === 2 || Number(quadrantId) === 3 || Number(quadrantId) === 4) {
    const title = opts && opts.taskTitle != null ? String(opts.taskTitle).trim() : "";
    data.taskTitle = title || "未命名任务";
  }
  if (opts && opts.forceRegenerate) {
    data.forceRegenerate = true;
  }

  return callFunction(
    {
      name: CLOUD_FUNCTION_NAME,
      data,
    },
    GENERATE_REPLY_TIMEOUT_MS,
  )
    .then((res) => {
      const result = unwrapResult(res);
      if (result && result.deployTag) {
        console.info("[reflectionArkClient] batch deployTag", result.deployTag);
      }
      if (!result || !result.ok || !Array.isArray(result.replies)) {
        if (result && result.errCode) {
          console.warn("[reflectionArkClient] batch errCode", result.errCode);
        }
        return list.map((item) =>
          Object.assign({}, item, {
            ok: false,
            errCode: (result && result.errCode) || "BATCH_FAILED",
            _batchMeta: {
              primaryErrCode: (result && result.errCode) || "BATCH_FAILED",
              deployTag: (result && result.deployTag) || "",
            },
          }),
        );
      }
      if (result.primaryErrCode) {
        console.warn("[reflectionArkClient] batch primaryErrCode", result.primaryErrCode);
      }
      const batchMeta = {
        primaryErrCode: result.primaryErrCode || "",
        deployTag: result.deployTag || "",
        batchMode: result.batchMode || "",
      };
      const byField = {};
      result.replies.forEach((row) => {
        if (row && row.cardField) byField[row.cardField] = row;
      });
      return list.map((item, index) => {
        const row = byField[item.cardField] || {};
        const out = {
          ok: row.ok === true,
          replyContent: String(row.replyContent || ""),
          fromCache: !!row.fromCache,
          fallback: !!row.fallback,
          textHash: String(row.textHash || ""),
          errCode: row.errCode || "",
        };
        const merged = Object.assign({}, item, out, { _batchMeta: batchMeta });
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
          hooks.onCardDone(merged, index, list.length);
        }
        return merged;
      });
    })
    .catch(() =>
      list.map((item) => Object.assign({}, item, { ok: false, errCode: "GENERATE_NETWORK" })),
    );
}

function buildQ2CloudData(taskId, targets, taskTitle, opts) {
  const list = Array.isArray(targets) ? targets.slice() : [];
  const data = {
    taskId: String(taskId || "").trim(),
    quadrantId: 2,
    taskTitle: String(taskTitle || "").trim() || "未命名任务",
    items: list.map((item) => {
      const row = {
        cardField: item.cardField,
        userText: item.userText,
        agentType: item.agentType,
      };
      if (item.question) row.question = String(item.question).trim();
      return row;
    }),
  };
  if (opts && opts.forceRegenerate) {
    data.forceRegenerate = true;
  }
  return data;
}

function mergeQ2ReplyRow(item, row, batchMeta) {
  const out = {
    ok: row && row.ok === true,
    replyContent: String((row && row.replyContent) || ""),
    fromCache: !!(row && row.fromCache),
    fallback: !!(row && row.fallback),
    textHash: String((row && row.textHash) || ""),
    errCode: (row && row.errCode) || "",
  };
  return Object.assign({}, item, out, { _batchMeta: batchMeta || {} });
}

/**
 * Q2 S2：两阶段云调用（c0 豆包 → c1+c2 DeepSeek），避免单次 60s 内双模型超时
 * @param {string} taskId
 * @param {{ cardField: string, userText: string, agentType: string, question?: string }[]} targets
 * @param {{ taskTitle?: string, onProgress?: function }} [opts]
 */
function generateQ2S2Blocking(taskId, targets, opts) {
  const list = Array.isArray(targets) ? targets.slice() : [];
  if (!list.length) return Promise.resolve([]);
  if (!isCloudReady()) {
    return Promise.resolve(
      list.map((item) => Object.assign({}, item, { ok: false, errCode: ERR_CLOUD_NOT_READY })),
    );
  }

  const dataBase = buildQ2CloudData(
    taskId,
    list,
    opts && opts.taskTitle != null ? opts.taskTitle : "",
    opts,
  );
  const onProgress = opts && typeof opts.onProgress === "function" ? opts.onProgress : null;

  const notify = (step, total, text) => {
    if (onProgress) onProgress(step, total, text);
  };

  notify(0, 3, "正在生成回响，请稍候…");

  return callFunction(
    { name: CLOUD_FUNCTION_NAME, data: Object.assign({ action: "generateQuadrantQ2StageA" }, dataBase) },
    Q2_PHASE_TIMEOUT_MS,
  )
    .then((res) => {
      const result = unwrapResult(res);
      if (result && result.deployTag) {
        console.info("[reflectionArkClient] Q2 deployTag", result.deployTag);
      }
      const deployTag = (result && result.deployTag) || "";
      if (deployTag && deployTag !== EXPECTED_Q2_DEPLOY_TAG) {
        console.warn(
          "[reflectionArkClient] Q2 deployTag mismatch",
          deployTag,
          "expected",
          EXPECTED_Q2_DEPLOY_TAG,
        );
      }
      const batchMeta = {
        deployTag,
        deployMismatch: !!(deployTag && deployTag !== EXPECTED_Q2_DEPLOY_TAG),
        batchMode: (result && result.batchMode) || "q2_s2_stage_a",
        primaryErrCode: (result && result.primaryErrCode) || "",
      };
      if (!result || !result.ok) {
        const code = (result && result.errCode) || "Q2_STAGE_A_FAILED";
        console.warn("[reflectionArkClient] Q2 stage A failed", code);
        return list.map((item) =>
          Object.assign({}, item, {
            ok: false,
            errCode: code,
            _batchMeta: Object.assign({ primaryErrCode: code }, batchMeta),
          }),
        );
      }
      const c0 = result.reply || {};
      const c0Item = list.find((t) => t.cardField === "c0") || list[0];
      const c0Merged = mergeQ2ReplyRow(c0Item, c0, batchMeta);
      if (c0Merged.ok && c0Merged.textHash && c0Merged.replyContent) {
        rememberReplyInMemory(
          taskId,
          2,
          "c0",
          c0Merged.textHash,
          c0Merged.replyContent,
          c0Merged.agentType,
        );
      }
      if (!c0Merged.ok) {
        console.warn("[reflectionArkClient] Q2 c0 not ok", c0Merged.errCode);
        return list.map((item) =>
          Object.assign({}, item, {
            ok: false,
            errCode: c0Merged.errCode || batchMeta.primaryErrCode || "Q2_STAGE_A_FAILED",
            _batchMeta: Object.assign(
              { primaryErrCode: c0Merged.errCode || "Q2_STAGE_A_FAILED" },
              batchMeta,
            ),
          }),
        );
      }

      notify(1, 3, "正在生成回响（2/3）…");

      return callFunction(
        {
          name: CLOUD_FUNCTION_NAME,
          data: Object.assign({ action: "generateQuadrantQ2StageB" }, dataBase),
        },
        Q2_PHASE_TIMEOUT_MS,
      ).then((resB) => ({ resultB: unwrapResult(resB), batchMeta, c0Merged }));
    })
    .then((payload) => {
      if (Array.isArray(payload)) return payload;
      if (!payload || !payload.c0Merged) return payload;
      const result = payload.resultB;
      const batchMeta = Object.assign({}, payload.batchMeta, {
        batchMode: (result && result.batchMode) || "q2_s2_stage_b",
        primaryErrCode: (result && result.primaryErrCode) || "",
      });
      if (!result || !result.ok || !Array.isArray(result.replies)) {
        const code =
          (result && result.errCode) ||
          batchMeta.primaryErrCode ||
          "Q2_STAGE_B_FAILED";
        console.warn("[reflectionArkClient] Q2 stage B failed", code);
        return list.map((item) =>
          Object.assign({}, item, {
            ok: false,
            errCode: code,
            _batchMeta: Object.assign({ primaryErrCode: code }, batchMeta),
          }),
        );
      }
      const byField = {};
      result.replies.forEach((row) => {
        if (row && row.cardField) byField[row.cardField] = row;
      });
      notify(3, 3, "正在写入回响…");
      return list.map((item) => {
        const row = item.cardField === "c0" ? payload.c0Merged : byField[item.cardField] || {};
        const merged = mergeQ2ReplyRow(item, row, batchMeta);
        if (merged.ok && merged.textHash && merged.replyContent) {
          rememberReplyInMemory(
            taskId,
            2,
            item.cardField,
            merged.textHash,
            merged.replyContent,
            item.agentType,
          );
        }
        return merged;
      });
    })
    .catch((err) => {
      console.warn("[reflectionArkClient] Q2 two-phase network error", err);
      return list.map((item) =>
        Object.assign({}, item, {
          ok: false,
          errCode: "GENERATE_NETWORK",
          _batchMeta: { primaryErrCode: "GENERATE_NETWORK" },
        }),
      );
    });
}

/** Q3 S2：c0 阶段 A → c1+c2 阶段 B（小麒） */
function generateQ3S2Blocking(taskId, targets, opts) {
  const list = Array.isArray(targets) ? targets.slice() : [];
  if (!list.length) return Promise.resolve([]);
  if (!isCloudReady()) {
    return Promise.resolve(
      list.map((item) => Object.assign({}, item, { ok: false, errCode: ERR_CLOUD_NOT_READY })),
    );
  }

  const dataBase = {
    taskId: String(taskId || "").trim(),
    quadrantId: 3,
    taskTitle: String((opts && opts.taskTitle) || "").trim() || "未命名任务",
    items: list.map((item) => {
      const row = {
        cardField: item.cardField,
        userText: item.userText,
        agentType: item.agentType,
      };
      if (item.question) row.question = String(item.question).trim();
      return row;
    }),
  };
  if (opts && opts.forceRegenerate) {
    dataBase.forceRegenerate = true;
  }

  return callFunction(
    { name: CLOUD_FUNCTION_NAME, data: Object.assign({ action: "generateQuadrantQ3StageA" }, dataBase) },
    Q2_PHASE_TIMEOUT_MS,
  )
    .then((res) => {
      const result = unwrapResult(res);
      const deployTag = (result && result.deployTag) || "";
      const batchMeta = {
        deployTag,
        deployMismatch: !!(deployTag && deployTag !== EXPECTED_Q2_DEPLOY_TAG),
        batchMode: (result && result.batchMode) || "q3_s2_stage_a",
        primaryErrCode: (result && result.primaryErrCode) || "",
      };
      if (!result || !result.ok) {
        const code = (result && result.errCode) || "Q3_STAGE_A_FAILED";
        return list.map((item) =>
          Object.assign({}, item, {
            ok: false,
            errCode: code,
            _batchMeta: Object.assign({ primaryErrCode: code }, batchMeta),
          }),
        );
      }
      const c0 = result.reply || {};
      const c0Item = list.find((t) => t.cardField === "c0") || list[0];
      const c0Merged = mergeQ2ReplyRow(c0Item, c0, batchMeta);
      if (!c0Merged.ok) {
        return list.map((item) =>
          Object.assign({}, item, {
            ok: false,
            errCode: c0Merged.errCode || "Q3_STAGE_A_FAILED",
            _batchMeta: batchMeta,
          }),
        );
      }
      if (c0Merged.ok && c0Merged.textHash && c0Merged.replyContent) {
        rememberReplyInMemory(taskId, 3, "c0", c0Merged.textHash, c0Merged.replyContent, c0Merged.agentType);
      }
      return callFunction(
        {
          name: CLOUD_FUNCTION_NAME,
          data: Object.assign({ action: "generateQuadrantQ3StageB" }, dataBase),
        },
        Q2_PHASE_TIMEOUT_MS,
      ).then((resB) => ({ resultB: unwrapResult(resB), batchMeta, c0Merged }));
    })
    .then((payload) => {
      if (Array.isArray(payload)) return payload;
      if (!payload || !payload.c0Merged) return payload;
      const result = payload.resultB;
      const batchMeta = Object.assign({}, payload.batchMeta, {
        batchMode: (result && result.batchMode) || "q3_s2_stage_b",
        primaryErrCode: (result && result.primaryErrCode) || "",
      });
      if (!result || !result.ok || !Array.isArray(result.replies)) {
        const code = (result && result.errCode) || batchMeta.primaryErrCode || "Q3_STAGE_B_FAILED";
        return list.map((item) =>
          Object.assign({}, item, {
            ok: false,
            errCode: code,
            _batchMeta: Object.assign({ primaryErrCode: code }, batchMeta),
          }),
        );
      }
      const byField = {};
      result.replies.forEach((row) => {
        if (row && row.cardField) byField[row.cardField] = row;
      });
      return list.map((item) => {
        const row = item.cardField === "c0" ? payload.c0Merged : byField[item.cardField] || {};
        const merged = mergeQ2ReplyRow(item, row, batchMeta);
        if (merged.ok && merged.textHash && merged.replyContent) {
          rememberReplyInMemory(
            taskId,
            3,
            item.cardField,
            merged.textHash,
            merged.replyContent,
            item.agentType,
          );
        }
        return merged;
      });
    })
    .catch(() =>
      list.map((item) =>
        Object.assign({}, item, {
          ok: false,
          errCode: "GENERATE_NETWORK",
          _batchMeta: { primaryErrCode: "GENERATE_NETWORK" },
        }),
      ),
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
  generateQ2S2Blocking,
  generateQ3S2Blocking,
  submitQuadrantHandwritingPipeline,
  MSG_SEC_REJECT_HINT,
};
