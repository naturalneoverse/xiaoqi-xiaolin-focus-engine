const { requireLoginOnLoad } = require("../../utils/requireLogin");
const {
  applyReflectionNavBar,
  getQuadrantMeta,
  getQuadrantOptionSelectedBg,
  getQuadrantBubbleColor,
} = require("../../config/reflectionTheme");
const {
  buildQuadrantConclusions,
  GENERAL_SUMMARY,
  isQuadrantConclusionBubbleCentered,
} = require("../../config/reflectionConclusions");
const { isValidQuadrantId } = require("../../config/reflectionRecordSchema");
const {
  getQuadrantCards,
  applySavedResponses,
  buildCardResponses,
} = require("../../config/reflectionQuadrantCards");
const { EXPAND_ROWS, createEmptyMultiExpandValues } = require("../../config/reflectionMultiExpand");
const reflectionManager = require("../../utils/reflectionManager");
const speechRecognition = require("../../utils/speechRecognition");
const { safeDecodeURIComponent } = require("../../utils/safeDecodeURIComponent");
const { isCloudReady } = require("../../utils/cloudCall");
const { collectHandwritingApiTargets } = require("../../config/reflectionArkApiMap");
const reflectionArk = require("../../utils/reflectionArkClient");
const reflectionArkBackground = require("../../utils/reflectionArkBackground");
const { clearMemoryCacheForQuadrant } = require("../../utils/reflectionArkCache");
const { EXPECTED_Q2_DEPLOY_TAG } = require("../../config/reflectionArkConfig");

const Q2_BLOCKING_SUBMIT_HINT = "回响生成未完成，请稍后再试";
const Q2_GENERATING_PROGRESS_TEXT = "正在生成回响，请稍候…";

function pickQ2BatchMeta(replies) {
  const list = Array.isArray(replies) ? replies : [];
  const row = list.find((r) => r && r._batchMeta) || list[0];
  return (row && row._batchMeta) || {};
}

function hintForQ2BatchFailure(replies, batchMeta) {
  const meta = batchMeta || pickQ2BatchMeta(replies) || {};
  const code =
    meta.primaryErrCode ||
    ((replies || []).find((r) => r && !r.ok && r.errCode) || {}).errCode ||
    "";
  if (meta.deployMismatch || (meta.deployTag && meta.deployTag !== EXPECTED_Q2_DEPLOY_TAG)) {
    return `云函数未更新（${meta.deployTag || "未知"}），请部署 reflectionArk 并重新编译小程序`;
  }
  if (!meta.deployTag && code !== "GENERATE_NETWORK") {
    return "未检测到云函数版本，请部署 reflectionArk 并重新编译小程序";
  }
  if (code === "UNKNOWN_ACTION") {
    return "云函数缺少 Q2 接口，请部署最新 reflectionArk";
  }
  if (code === "INTERNAL_ERROR") {
    return "云函数异常，请查看云开发日志";
  }
  if (code === "ARK_Q2_DEEP_MISSING") {
    return "AI 服务未配置完整，请检查云函数环境变量 ARK_MODEL_ID_Q2_DEEP";
  }
  if (code === "ARK_ENV_MISSING") {
    return "AI 服务未就绪，请稍后再试";
  }
  if (code === "Q2_PARSE_FAILED") {
    return "回响格式异常，请重试";
  }
  if (code === "ARK_TIMEOUT") {
    return "生成超时，请稍后重试";
  }
  if (code === "GENERATE_NETWORK") {
    return "网络超时，请检查网络后重试";
  }
  if (code === "ARK_MODEL_NOT_FOUND" || code === "ARK_HTTP_404") {
    return "模型 ID 无效，请在云函数环境变量填写火山 Endpoint ID（ep- 开头）";
  }
  if (code === "ARK_AUTH_FAILED" || code === "ARK_HTTP_401" || code === "ARK_HTTP_403") {
    return "ARK_API_KEY 无效或无权访问该模型";
  }
  if (code === "ARK_FAILED") {
    return "模型调用失败，请用云开发测试 arkProbe / arkProbeQ2";
  }
  if (code === "REPLY_INCOMPLETE" || code === "TOO_SHORT_DISPLAY") {
    return "回响未通过校验，请重试";
  }
  if (code === "Q2_STAGE_A_FAILED" || code === "Q2_STAGE_A_MISSING") {
    return "第一段回响生成失败，请重试";
  }
  if (code === "Q2_STAGE_B_FAILED") {
    return "后两段回响生成失败，请重试";
  }
  if (code === "BATCH_FAILED" || code === "INVALID_ITEM") {
    return "提交版本与服务不一致，请重新编译小程序并部署云函数";
  }
  return Q2_BLOCKING_SUBMIT_HINT;
}

const TOAST_TEXT_FULL = "已达字数上限，无法继续添加";

function clampText(value, maxLength) {
  const max = Number(maxLength) || 300;
  const chars = Array.from(value || "");
  if (chars.length <= max) return value || "";
  return chars.slice(0, max).join("");
}

function textLength(value) {
  return Array.from(value || "").length;
}

const SELECT_PAGE_SUFFIX = "reflection-select/index";

function findSelectPageIndex(pages) {
  for (let i = (pages || []).length - 2; i >= 0; i--) {
    const route = (pages[i] && pages[i].route) || "";
    if (route.indexOf(SELECT_PAGE_SUFFIX) >= 0) return i;
  }
  return -1;
}

Page({
  data: {
    taskId: "",
    taskTitle: "",
    quadrantId: 0,
    accent: "#12598F",
    submitAccent: "#12598F",
    optionSelectedBg: "",
    cards: [],
    textValues: {},
    singleValues: {},
    multiValues: {},
    multiExpandValues: {},
    expandRows: EXPAND_ROWS,
    speechRecordingField: "",
    speechMicMap: {},
    inputDisabledMap: {},
    isCompleted: false,
    submitLabel: "提交本象限",
    showConclusion: false,
    conclusionBubbles: [],
    conclusionAgent: "xiaolin",
    conclusionBubbleColor: "#b7d6ea",
    conclusionAccent: "#12598f",
    conclusionBubbleCenter: false,
    submitLoading: false,
    submitProgressText: "",
    submitProgressIndex: 0,
    submitProgressTotal: 0,
  },

  _speechField: "",
  _submitting: false,
  _formDirty: false,
  _ready: false,
  _returningToSelect: false,
  _showGeneralSummaryNext: false,

  onLoad(options) {
    if (!requireLoginOnLoad()) return;
    speechRecognition.warmUp().catch(() => {});

    const taskId = safeDecodeURIComponent(options && options.taskId);
    const taskTitle = safeDecodeURIComponent(options && options.taskTitle);
    const quadrantId = Number(options && options.quadrant);

    if (!taskId || !isValidQuadrantId(quadrantId)) {
      wx.showToast({ title: "参数无效", icon: "none" });
      setTimeout(() => wx.navigateBack(), 400);
      return;
    }

    const meta = getQuadrantMeta(quadrantId);
    wx.setNavigationBarTitle({ title: meta ? meta.title : "象限答题" });

    const cards = getQuadrantCards(quadrantId);
    this._formDirty = false;
    this._submitting = false;
    this._returningToSelect = false;
    this._applyFormFromStorage(taskId, quadrantId, cards, {
      taskTitle,
      accent: meta ? meta.accent : "#12598F",
      optionSelectedBg: getQuadrantOptionSelectedBg(quadrantId),
    });
  },

  onShow() {
    applyReflectionNavBar();
    speechRecognition.prepare();
    this._returningToSelect = false;
    if (this._submitting) {
      this._ready = true;
      return;
    }
    if (this._ready && !this._formDirty && this.data.taskId && this.data.quadrantId) {
      this._applyFormFromStorage(this.data.taskId, this.data.quadrantId, this.data.cards);
    }
    this._ready = true;
  },

  _applyFormFromStorage(taskId, quadrantId, cards, extra) {
    const list = cards || getQuadrantCards(quadrantId);
    const record = reflectionManager.findByTaskId(taskId);
    const savedEntry = reflectionManager.getQuadrantEntry(record, quadrantId);
    const { textValues, singleValues, multiValues, multiExpandValues } = applySavedResponses(list, savedEntry);
    const isCompleted = reflectionManager.isQuadrantComplete(record, quadrantId);
    const accent = (extra && extra.accent) || this.data.accent || "#12598F";
    this.setData(
      Object.assign(
        {
          taskId,
          quadrantId,
          cards: list,
          textValues,
          singleValues,
          multiValues,
          multiExpandValues,
          isCompleted,
          submitLabel: isCompleted ? "保存修改" : "提交本象限",
          showConclusion: false,
          submitLoading: false,
          accent,
          submitAccent: accent,
          optionSelectedBg:
            (extra && extra.optionSelectedBg) ||
            this.data.optionSelectedBg ||
            getQuadrantOptionSelectedBg(quadrantId),
          speechRecordingField: "",
        },
        extra && extra.taskTitle !== undefined ? { taskTitle: extra.taskTitle } : {},
        this._syncSpeechState({
          cards: list,
          textValues,
          multiExpandValues,
          speechRecordingField: "",
        }),
      ),
    );
  },

  onUnload() {
    speechRecognition.abort();
  },

  _getCardMeta(field) {
    return (this.data.cards || []).find((c) => c && c.field === field) || null;
  },

  _getExpandRow(subKey) {
    return EXPAND_ROWS.find((r) => r && r.key === subKey) || null;
  },

  _syncSpeechState(patch) {
    const cards = patch.cards || this.data.cards || [];
    const textValues = Object.assign({}, this.data.textValues, patch.textValues || {});
    const multiExpandValues = Object.assign({}, this.data.multiExpandValues, patch.multiExpandValues || {});
    const multiValues = Object.assign({}, this.data.multiValues, patch.multiValues || {});
    const rec = patch.speechRecordingField !== undefined ? patch.speechRecordingField : this.data.speechRecordingField;
    const speechMicMap = {};
    const inputDisabledMap = {};
    cards.forEach((card) => {
      if (!card || !card.field) return;
      if (card.type === "text") {
        const len = textLength(textValues[card.field]);
        const atMax = len >= (card.maxLength || 300);
        speechMicMap[card.field] = atMax || (!!rec && rec !== card.field);
        inputDisabledMap[card.field] = !!rec && rec !== card.field;
      }
      if (card.type === "multi" && card.hasExpand) {
        const selected = multiValues[card.field] || [];
        const expand = Object.assign(createEmptyMultiExpandValues(), multiExpandValues[card.field] || {});
        EXPAND_ROWS.forEach((row) => {
          if (!row || !row.key || selected.indexOf(row.optionId) < 0) return;
          const speechKey = `${card.field}_${row.key}`;
          const max = row.maxLength || 25;
          const len = textLength(expand[row.key]);
          const atMax = len >= max;
          speechMicMap[speechKey] = atMax || (!!rec && rec !== speechKey);
          inputDisabledMap[speechKey] = !!rec && rec !== speechKey;
        });
      }
    });
    return { speechMicMap, inputDisabledMap, speechRecordingField: rec || "" };
  },

  onTextCardChange(e) {
    const detail = e.detail || {};
    const field = detail.field;
    if (!field) return;
    this._formDirty = true;
    const textValues = Object.assign({}, this.data.textValues, {
      [field]: detail.value || "",
    });
    this.setData(Object.assign({ textValues }, this._syncSpeechState({ textValues })));
  },

  onSingleCardChange(e) {
    const detail = e.detail || {};
    const field = detail.field;
    if (!field) return;
    this._formDirty = true;
    this.setData({
      [`singleValues.${field}`]: detail.selected || "",
    });
  },

  onMultiCardChange(e) {
    const detail = e.detail || {};
    const field = detail.field;
    if (!field) return;
    this._formDirty = true;
    const selected = Array.isArray(detail.selected) ? detail.selected : [];
    const card = this._getCardMeta(field);
    const patch = { [`multiValues.${field}`]: selected };
    if (card && card.hasExpand) {
      const expand = Object.assign(
        createEmptyMultiExpandValues(),
        (this.data.multiExpandValues && this.data.multiExpandValues[field]) || {},
      );
      if (selected.indexOf("experience") < 0) expand.experience = "";
      if (selected.indexOf("feeling") < 0) expand.feeling = "";
      if (selected.indexOf("decision") < 0) expand.decision = "";
      patch[`multiExpandValues.${field}`] = expand;
    }
    const multiValues = Object.assign({}, this.data.multiValues, { [field]: selected });
    const multiExpandValues =
      patch[`multiExpandValues.${field}`] !== undefined
        ? Object.assign({}, this.data.multiExpandValues, { [field]: patch[`multiExpandValues.${field}`] })
        : this.data.multiExpandValues;
    this.setData(Object.assign(patch, this._syncSpeechState({ multiValues, multiExpandValues })));
  },

  onMultiExpandChange(e) {
    const detail = e.detail || {};
    const field = detail.field;
    if (!field) return;
    this._formDirty = true;
    const multiExpandValues = Object.assign({}, this.data.multiExpandValues, {
      [field]: Object.assign(createEmptyMultiExpandValues(), detail.values || {}),
    });
    this.setData(Object.assign({ multiExpandValues }, this._syncSpeechState({ multiExpandValues })));
  },

  _isMultiExpandSpeechKey(speechKey) {
    if (!speechKey || typeof speechKey !== "string") return null;
    const cards = this.data.cards || [];
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      if (!card || card.type !== "multi" || !card.hasExpand || !card.field) continue;
      const prefix = `${card.field}_`;
      if (speechKey.indexOf(prefix) !== 0) continue;
      const subKey = speechKey.slice(prefix.length);
      if (EXPAND_ROWS.some((row) => row && row.key === subKey)) {
        return { field: card.field, subKey };
      }
    }
    return null;
  },

  _appendSpeechText(field, text) {
    if (!field || !text) return;
    this._formDirty = true;
    const card = this._getCardMeta(field);
    const max = (card && card.maxLength) || 300;
    const merged = clampText(`${this.data.textValues[field] || ""}${text}`, max);
    const textValues = Object.assign({}, this.data.textValues, { [field]: merged });
    this.setData(Object.assign({ textValues }, this._syncSpeechState({ textValues })));
  },

  _appendMultiExpandSpeechText(field, subKey, text) {
    if (!field || !subKey || !text) return;
    this._formDirty = true;
    const row = this._getExpandRow(subKey);
    const max = (row && row.maxLength) || 25;
    const current = Object.assign(
      createEmptyMultiExpandValues(),
      (this.data.multiExpandValues && this.data.multiExpandValues[field]) || {},
    );
    current[subKey] = clampText(`${current[subKey] || ""}${text}`, max);
    const multiExpandValues = Object.assign({}, this.data.multiExpandValues, { [field]: current });
    this.setData(Object.assign({ multiExpandValues }, this._syncSpeechState({ multiExpandValues })));
  },

  _stopSpeechRecording() {
    if (!speechRecognition.hasActiveSession()) return;
    speechRecognition.stopForField("content") || speechRecognition.stopActive();
  },

  /** 仅录音中铺透明层：松手任意处结束，平时不拦截触摸（鸿蒙输入兼容） */
  onSpeechReleaseOverlayEnd() {
    this._stopSpeechRecording();
  },

  _onSpeechAutoEnd(result) {
    const speechKey = this._speechField;
    this._speechField = "";
    this.setData(this._syncSpeechState({ speechRecordingField: "" }));
    if (!result || !result.ok || !result.text || !speechKey) return;
    const expandTarget = this._isMultiExpandSpeechKey(speechKey);
    if (expandTarget) {
      this._appendMultiExpandSpeechText(expandTarget.field, expandTarget.subKey, result.text);
      return;
    }
    this._appendSpeechText(speechKey, result.text);
  },

  onSpeechLongPress(e) {
    const detail = e.detail || {};
    const speechKey = detail.speechKey || detail.field || "";
    if (!speechKey) return;

    let len = 0;
    let max = 300;
    const expandTarget = this._isMultiExpandSpeechKey(speechKey);
    if (expandTarget) {
      const row = this._getExpandRow(expandTarget.subKey);
      max = (row && row.maxLength) || 25;
      const values = Object.assign(
        createEmptyMultiExpandValues(),
        (this.data.multiExpandValues && this.data.multiExpandValues[expandTarget.field]) || {},
      );
      len = textLength(values[expandTarget.subKey]);
    } else {
      const card = this._getCardMeta(speechKey);
      max = (card && card.maxLength) || 300;
      len = textLength(this.data.textValues[speechKey]);
    }

    if (len >= max) {
      wx.showToast({ title: TOAST_TEXT_FULL, icon: "none" });
      return;
    }
    if (this.data.speechRecordingField) return;

    this._speechField = speechKey;
    speechRecognition
      .start("content", (result) => this._onSpeechAutoEnd(result))
      .then((started) => {
        if (started) {
          this.setData(this._syncSpeechState({ speechRecordingField: speechKey }));
          return;
        }
        if (this._speechField === speechKey) {
          this._speechField = "";
        }
      })
      .catch(() => {
        if (this._speechField === speechKey) {
          this._speechField = "";
        }
      });
  },

  onSpeechTouchEnd() {
    this._stopSpeechRecording();
  },

  _validateSingleCards() {
    const cards = this.data.cards || [];
    const singleValues = this.data.singleValues || {};
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      if (card && card.type === "single" && !singleValues[card.field]) {
        wx.showToast({ title: "请选择一个选项", icon: "none" });
        return false;
      }
    }
    return true;
  },

  _validateMultiCards() {
    const cards = this.data.cards || [];
    const multiValues = this.data.multiValues || {};
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      if (!card || card.type !== "multi") continue;
      const selected = multiValues[card.field];
      if (!selected || !selected.length) {
        wx.showToast({ title: "请至少选择一项", icon: "none" });
        return false;
      }
    }
    return true;
  },

  _validateMultiExpand() {
    const cards = this.data.cards || [];
    const multiValues = this.data.multiValues || {};
    const multiExpandValues = this.data.multiExpandValues || {};
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      if (!card || card.type !== "multi" || !card.hasExpand) continue;
      const selected = multiValues[card.field] || [];
      const expand = Object.assign(createEmptyMultiExpandValues(), multiExpandValues[card.field] || {});
      for (let j = 0; j < EXPAND_ROWS.length; j++) {
        const row = EXPAND_ROWS[j];
        if (!row || selected.indexOf(row.optionId) < 0) continue;
        if (!String(expand[row.key] || "").trim()) {
          wx.showToast({ title: `请填写${row.label}`, icon: "none" });
          return false;
        }
      }
    }
    return true;
  },

  /** 四象限：本象限全部手写题须填写（与云端成套生成一致） */
  _validateRequiredTextCards() {
    const cards = this.data.cards || [];
    const textValues = this.data.textValues || {};
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      if (!card || card.type !== "text") continue;
      if (!String(textValues[card.field] || "").trim()) {
        wx.showToast({ title: "请完成本象限全部题目后再提交", icon: "none", duration: 2800 });
        return false;
      }
    }
    return true;
  },

  _setSubmitLoading(active, patch) {
    const base = {
      submitLoading: !!active,
    };
    if (!active) {
      base.submitProgressText = "";
      base.submitProgressIndex = 0;
      base.submitProgressTotal = 0;
    }
    this.setData(Object.assign(base, patch || {}));
  },

  _abortSubmit(hint) {
    this._submitting = false;
    this._setSubmitLoading(false);
    if (hint) {
      wx.showToast({ title: hint, icon: "none", duration: 2800 });
    }
  },

  /** Q2 结语为固定文案，不依赖 AI；先落库出气泡，回响后台两阶段生成 */
  _usesBlockingBatchSubmit(_quadrantId) {
    return false;
  },

  _handwritingReplySucceeded(reply) {
    if (!reply || reply.ok === false) return false;
    if (reply.fallback) return false;
    return String(reply.replyContent || "").trim().length > 0;
  },

  _submitQ2BlockingBatch(cardResponses, recordBefore, completedBefore, form, apiTargets) {
    const { taskId, taskTitle, quadrantId } = this.data;
    const apiTotal = (apiTargets || []).length;

    reflectionArk
      .msgSecCheckBatch(apiTargets)
      .then((sec) => {
        if (!sec || !sec.ok) {
          const hint = (sec && sec.hint) || reflectionArk.MSG_SEC_REJECT_HINT;
          this._abortSubmit(hint);
          return null;
        }
        this._setSubmitLoading(true, {
          submitProgressTotal: apiTotal,
          submitProgressIndex: 0,
          submitProgressText: Q2_GENERATING_PROGRESS_TEXT,
        });
        const enriched = (apiTargets || []).map((t) =>
          Object.assign({ taskId, quadrantId: Number(quadrantId) }, t),
        );
        return reflectionArk.generateQ2S2Blocking(taskId, enriched, {
          taskTitle: taskTitle || "未命名任务",
          onProgress: (step, total, text) => {
            this.setData({
              submitProgressIndex: step,
              submitProgressTotal: total,
              submitProgressText: text || Q2_GENERATING_PROGRESS_TEXT,
            });
          },
        });
      })
      .then((replies) => {
        if (!Array.isArray(replies)) {
          console.warn("[reflection-quadrant] Q2 batch invalid replies", replies);
          this._abortSubmit("回响生成异常，请重试");
          return;
        }
        const list = replies;
        const targets = apiTargets || [];
        const allOk =
          targets.length > 0 &&
          targets.every((t) => {
            const row = list.find((r) => r && r.cardField === t.cardField);
            return row && this._handwritingReplySucceeded(row);
          });
        if (!allOk) {
          const batchMeta = pickQ2BatchMeta(list);
          console.warn("[reflection-quadrant] Q2 batch failed", {
            deployTag: batchMeta.deployTag,
            expectedDeployTag: EXPECTED_Q2_DEPLOY_TAG,
            primaryErrCode: batchMeta.primaryErrCode,
            errCodes: list.map((r) => ({ field: r.cardField, ok: r.ok, errCode: r.errCode })),
          });
          this._abortSubmit(hintForQ2BatchFailure(list, batchMeta));
          return;
        }
        this._persistAndShowConclusion(cardResponses, recordBefore, completedBefore);
      })
      .catch((err) => {
        console.warn("[reflection-quadrant] Q2 submit rejected", err);
        this._abortSubmit("网络异常，请稍后重试");
      });
  },

  /** 先 upsertQuadrant 持久化，成功后再更新界面；失败时抛出供调用方捕获 */
  _saveQuadrantResponses(cardResponses) {
    const { taskId, taskTitle, quadrantId } = this.data;
    reflectionManager.upsertQuadrant(taskId, taskTitle, quadrantId, { cardResponses });
    this._submitting = false;
    this._formDirty = false;
    this._setSubmitLoading(false);
    this.setData({
      isCompleted: true,
      submitLabel: "保存修改",
    });
  },

  _commitQuadrantAfterSec(cardResponses, recordBefore, completedBefore, form, wasCompleted) {
    const { taskId, quadrantId } = this.data;
    try {
      this._saveQuadrantResponses(cardResponses);
    } catch (e) {
      this._abortSubmit("保存失败，请重试");
      return;
    }
    if (wasCompleted) {
      clearMemoryCacheForQuadrant(taskId, quadrantId);
    }
    const apiTargets = collectHandwritingApiTargets(quadrantId, form);
    if (apiTargets.length) {
      reflectionArkBackground.enqueueQuadrantHandwritingGeneration(taskId, quadrantId, form, {
        taskTitle: this.data.taskTitle || "未命名任务",
        forceRegenerate: wasCompleted,
      });
    }
    if (wasCompleted) {
      this.setData({ showConclusion: false });
      try {
        wx.showToast({ title: "已保存，正在重新生成回响", icon: "none", duration: 2200 });
      } catch (e) {
        /* ignore */
      }
      this._returnToSelect();
      return;
    }
    try {
      this._showConclusionAfterSave(cardResponses, recordBefore, completedBefore);
    } catch (e) {
      console.warn("[reflection-quadrant] showConclusionAfterSave", e);
      wx.showToast({ title: "已保存，请从选象限页查看", icon: "none", duration: 2600 });
      this._returnToSelect();
    }
  },

  _submitWithBackgroundGeneration(cardResponses, recordBefore, completedBefore, form) {
    const wasCompleted = !!this.data.isCompleted;

    reflectionArk
      .msgSecCheckBatch(collectHandwritingApiTargets(this.data.quadrantId, form))
      .then((sec) => {
        if (!sec || !sec.ok) {
          const hint = (sec && sec.hint) || reflectionArk.MSG_SEC_REJECT_HINT;
          this._abortSubmit(hint);
          return;
        }
        this._commitQuadrantAfterSec(cardResponses, recordBefore, completedBefore, form, wasCompleted);
      })
      .catch((err) => {
        console.warn("[reflection-quadrant] submitWithBackground", err);
        this._abortSubmit("提交失败，请稍后重试");
      });
  },

  /**
   * 已落库后展示结语气泡（不再写入 storage）
   */
  _showConclusionAfterSave(cardResponses, recordBefore, completedBefore) {
    const { taskId, quadrantId } = this.data;
    const recordAfter = reflectionManager.findByTaskId(taskId);
    this._showGeneralSummaryNext =
      reflectionManager.isAllQuadrantsComplete(recordAfter) && completedBefore < 4;

    const conclusions = buildQuadrantConclusions(quadrantId, cardResponses);
    if (conclusions.length) {
      const meta = getQuadrantMeta(quadrantId);
      this.setData({
        isCompleted: true,
        submitLabel: "保存修改",
        showConclusion: true,
        conclusionBubbles: conclusions,
        conclusionAgent: meta ? meta.agent : "xiaolin",
        conclusionBubbleColor: getQuadrantBubbleColor(quadrantId),
        conclusionAccent: meta ? meta.accent : "#12598f",
        conclusionBubbleCenter: isQuadrantConclusionBubbleCentered(quadrantId),
      });
      return;
    }
    if (this._showGeneralSummaryNext) {
      this.setData({ isCompleted: true, submitLabel: "保存修改" }, () => this._presentGeneralSummary());
      return;
    }
    this.setData({ isCompleted: true, submitLabel: "保存修改" }, () => this._returnToSelect());
  },

  _persistAndShowConclusion(cardResponses, recordBefore, completedBefore) {
    try {
      this._saveQuadrantResponses(cardResponses);
    } catch (e) {
      this._abortSubmit("保存失败，请重试");
      return;
    }
    this._showConclusionAfterSave(cardResponses, recordBefore, completedBefore);
  },

  onSubmit() {
    if (this._submitting) return;
    const { cards, textValues, singleValues, multiValues, multiExpandValues, taskId, taskTitle, quadrantId } =
      this.data;
    if (!cards || !cards.length) return;
    if (!this._validateSingleCards()) return;
    if (!this._validateMultiCards()) return;
    if (!this._validateMultiExpand()) return;
    if (!this._validateRequiredTextCards()) return;

    const cardResponses = buildCardResponses(cards, textValues, singleValues, multiValues, multiExpandValues);
    const recordBefore = reflectionManager.findByTaskId(taskId);
    const completedBefore = reflectionManager.getCompletedQuadrantIds(recordBefore).length;

    /** collectHandwritingApiTargets / 后台生成共用；Q3 c1 单选依赖 singleValues */
    const form = { textValues, singleValues, multiValues, multiExpandValues };
    const apiTargets = collectHandwritingApiTargets(quadrantId, form);
    const apiTotal = apiTargets.length;

    this._submitting = true;
    this._setSubmitLoading(true, {
      submitProgressTotal: apiTotal,
      submitProgressIndex: 0,
      submitProgressText: apiTotal ? "正在校验内容…" : "",
    });

    if (!apiTotal || !isCloudReady()) {
      if (this._usesBlockingBatchSubmit(quadrantId) && apiTotal) {
        this._abortSubmit("网络未就绪，请稍后再试");
        return;
      }
      this._persistAndShowConclusion(cardResponses, recordBefore, completedBefore);
      return;
    }

    if (this._usesBlockingBatchSubmit(quadrantId)) {
      this._submitQ2BlockingBatch(
        cardResponses,
        recordBefore,
        completedBefore,
        form,
        apiTargets,
      );
      return;
    }

    this._submitWithBackgroundGeneration(cardResponses, recordBefore, completedBefore, form);
  },

  _presentGeneralSummary() {
    this._showGeneralSummaryNext = false;
    this.setData({
      showConclusion: true,
      conclusionBubbles: GENERAL_SUMMARY.bubbles.slice(),
      conclusionAgent: GENERAL_SUMMARY.agent,
      conclusionBubbleColor: GENERAL_SUMMARY.bubbleColor,
      conclusionAccent: GENERAL_SUMMARY.accent,
    });
  },

  onConclusionComplete() {
    if (this._showGeneralSummaryNext) {
      this.setData({ showConclusion: false }, () => this._presentGeneralSummary());
      return;
    }
    this.setData({ showConclusion: false }, () => this._returnToSelect());
  },

  _returnToSelect() {
    const { taskId, taskTitle } = this.data;
    const pages = getCurrentPages();
    const selectIndex = findSelectPageIndex(pages);

    const finishReturn = () => {
      this._returningToSelect = false;
    };

    this._returningToSelect = true;

    if (selectIndex >= 0) {
      const delta = pages.length - 1 - selectIndex;
      wx.navigateBack({
        delta,
        complete: finishReturn,
        fail: () => {
          finishReturn();
          this._redirectToSelect(taskId, taskTitle);
        },
      });
      return;
    }
    this._redirectToSelect(taskId, taskTitle);
  },

  _redirectToSelect(taskId, taskTitle) {
    wx.redirectTo({
      url: `/subpkg/reflection-select/index?taskId=${encodeURIComponent(taskId || "")}&taskTitle=${encodeURIComponent(taskTitle || "")}`,
      complete: () => {
        this._returningToSelect = false;
      },
      fail: () => {
        this._returningToSelect = false;
      },
    });
  },
});
