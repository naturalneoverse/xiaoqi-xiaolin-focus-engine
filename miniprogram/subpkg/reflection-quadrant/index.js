const { requireLoginOnLoad } = require("../../utils/requireLogin");
const {
  applyReflectionNavBar,
  getQuadrantMeta,
  getQuadrantOptionSelectedBg,
  getQuadrantBubbleColor,
} = require("../../config/reflectionTheme");
const { buildQuadrantConclusions, GENERAL_SUMMARY } = require("../../config/reflectionConclusions");
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
const {
  collectHandwritingApiTargets,
  getCardFieldProgressLabel,
} = require("../../config/reflectionArkApiMap");
const reflectionArk = require("../../utils/reflectionArkClient");

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
    this._applyFormFromStorage(taskId, quadrantId, cards, {
      taskTitle,
      accent: meta ? meta.accent : "#12598F",
      optionSelectedBg: getQuadrantOptionSelectedBg(quadrantId),
    });
  },

  onShow() {
    applyReflectionNavBar();
    speechRecognition.prepare();
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

  onGlobalSpeechTouchEnd() {
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
    const started = speechRecognition.start("content", (result) => this._onSpeechAutoEnd(result));
    if (started) {
      this.setData(this._syncSpeechState({ speechRecordingField: speechKey }));
    } else {
      this._speechField = "";
    }
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
      if (selected.indexOf("experience") < 0) continue;
      const expand = Object.assign(createEmptyMultiExpandValues(), multiExpandValues[card.field] || {});
      if (!String(expand.experience || "").trim()) {
        wx.showToast({ title: "请填写带走的经验", icon: "none" });
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

  /**
   * 内容安全通过且（如有）API/缓存完成后，落库并展示结语气泡
   */
  _persistAndShowConclusion(cardResponses, recordBefore, completedBefore) {
    const { taskId, taskTitle, quadrantId } = this.data;
    try {
      reflectionManager.upsertQuadrant(taskId, taskTitle, quadrantId, { cardResponses });
    } catch (e) {
      this._abortSubmit("保存失败，请重试");
      return;
    }
    this._submitting = false;
    this._formDirty = false;
    this._setSubmitLoading(false);

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
      });
      return;
    }
    if (this._showGeneralSummaryNext) {
      this.setData({ isCompleted: true, submitLabel: "保存修改" }, () => this._presentGeneralSummary());
      return;
    }
    this.setData({ isCompleted: true, submitLabel: "保存修改" }, () => this._returnToSelect());
  },

  onSubmit() {
    if (this._submitting) return;
    const { cards, textValues, singleValues, multiValues, multiExpandValues, taskId, taskTitle, quadrantId } =
      this.data;
    if (!cards || !cards.length) return;
    if (!this._validateSingleCards()) return;
    if (!this._validateMultiCards()) return;
    if (!this._validateMultiExpand()) return;

    const cardResponses = buildCardResponses(cards, textValues, singleValues, multiValues, multiExpandValues);
    const recordBefore = reflectionManager.findByTaskId(taskId);
    const completedBefore = reflectionManager.getCompletedQuadrantIds(recordBefore).length;

    const form = { textValues, multiValues, multiExpandValues };
    const apiTargets = collectHandwritingApiTargets(quadrantId, form);
    const apiTotal = apiTargets.length;

    this._submitting = true;
    this._setSubmitLoading(true, {
      submitProgressTotal: apiTotal,
      submitProgressIndex: 0,
      submitProgressText: apiTotal ? "正在校验内容…" : "",
    });

    if (!apiTotal || !isCloudReady()) {
      this._persistAndShowConclusion(cardResponses, recordBefore, completedBefore);
      return;
    }

    let progressIndex = 0;
    reflectionArk
      .submitQuadrantHandwritingPipeline(taskId, quadrantId, form, {
        onCardStart: (item) => {
          progressIndex += 1;
          const label = getCardFieldProgressLabel(item && item.cardField);
          this.setData({
            submitProgressIndex: progressIndex,
            submitProgressText: `正在生成${label}（${progressIndex}/${apiTotal}）…`,
          });
        },
      })
      .then((pipe) => {
        if (!pipe || !pipe.sec || !pipe.sec.ok) {
          const hint =
            (pipe && pipe.sec && pipe.sec.hint) || reflectionArk.MSG_SEC_REJECT_HINT;
          this._abortSubmit(hint);
          return;
        }
        const replies = (pipe && pipe.replies) || [];
        if (apiTotal > 0 && replies.length) {
          const failed = replies.filter((r) => !r || !r.ok);
          const fallbacks = replies.filter((r) => r && r.ok && r.fallback);
          if (failed.length) {
            console.warn(
              "[reflection-quadrant] generateReply 未到达云端或失败",
              failed.map((r) => r.errCode || "UNKNOWN"),
            );
          }
          if (fallbacks.length > 0 && !failed.length) {
            console.warn(
              "[reflection-quadrant] 部分手写未生成成功，条数:",
              fallbacks.length,
              "/",
              replies.length,
            );
          }
          if (fallbacks.length === replies.length && !failed.length) {
            console.warn(
              "[reflection-quadrant] 全部为兜底，请在云函数日志搜索 generateQuadrantBatch 与 errCode",
            );
          }
        } else if (apiTotal > 0 && !replies.length) {
          console.warn("[reflection-quadrant] 审核已通过但未执行 generateReply");
        }
        this._persistAndShowConclusion(cardResponses, recordBefore, completedBefore);
      })
      .catch(() => {
        this._abortSubmit("提交未完成，请稍后再试");
      });
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
    if (this._returningToSelect) return;
    if (this._showGeneralSummaryNext) {
      this.setData({ showConclusion: false }, () => this._presentGeneralSummary());
      return;
    }
    this.setData({ showConclusion: false }, () => this._returnToSelect());
  },

  _returnToSelect() {
    if (this._returningToSelect) return;
    this._returningToSelect = true;

    const { taskId, taskTitle } = this.data;
    const pages = getCurrentPages();
    const selectIndex = findSelectPageIndex(pages);

    if (selectIndex >= 0) {
      const delta = pages.length - 1 - selectIndex;
      wx.navigateBack({
        delta,
        fail: () => this._redirectToSelect(taskId, taskTitle),
      });
      return;
    }
    this._redirectToSelect(taskId, taskTitle);
  },

  _redirectToSelect(taskId, taskTitle) {
    wx.redirectTo({
      url: `/subpkg/reflection-select/index?taskId=${encodeURIComponent(taskId || "")}&taskTitle=${encodeURIComponent(taskTitle || "")}`,
      fail: () => {
        this._returningToSelect = false;
      },
    });
  },
});
