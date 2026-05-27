const { LAYER_OPTIONS } = require("../../config/taskQuizChoices");
const { buildQuizCode } = require("../../utils/taskQuizClient");
const { fetchGetReply } = require("../../utils/getReplyClient");
const { parsePayload } = require("../../utils/parsePayload");

const OPTIONS = LAYER_OPTIONS.map((o) => ({ key: o.title, desc: o.desc, id: o.id }));

const { requireLoginOnLoad } = require("../../utils/requireLogin");
const {
  getPriorityTagClass,
  getForWhomTagClass,
  getWhyTagClass,
} = require("../../utils/taskTagStyles");
const { TASK_NAME_MAX } = require("../../config/taskLimits");
const { formatDateTime } = require("../../utils/dateFormat");
const { resolveTaskId, persistTaskAndOpenDetail } = require("../../utils/taskCreatePersist");

function buildTags(payload, selectedWhy) {
  return [
    payload.priority
      ? { text: payload.priority, className: getPriorityTagClass(payload.priority) || "tag-gray" }
      : null,
    payload.forWhom
      ? { text: payload.forWhom, className: getForWhomTagClass(payload.forWhom) || "tag-violet" }
      : null,
    selectedWhy ? { text: selectedWhy, className: getWhyTagClass(selectedWhy) || "tag-deep" } : null,
  ].filter(Boolean);
}

function clampTextByLength(value, maxLength) {
  const chars = Array.from(value || "");
  if (chars.length <= maxLength) return value || "";
  return chars.slice(0, maxLength).join("");
}

Page({
  data: {
    options: OPTIONS,
    selected: "",
    payload: {},
    saveSubmitting: false,
  },

  onLoad(options) {
    if (!requireLoginOnLoad()) return;
    const payload = parsePayload(options.payload);
    this.setData({
      payload,
      selected: payload.why || "",
    });
  },

  chooseOption(e) {
    this.setData({
      selected: e.currentTarget.dataset.key,
    });
  },

  goPrev() {
    this.__safeNavigateBack("/pages/sleep/index");
  },

  saveTask() {
    if (this._saveTaskLocked) return;
    const { selected, payload, saveSubmitting } = this.data;
    if (saveSubmitting) return;
    if (!selected) {
      wx.showToast({ title: "请选择一项", icon: "none" });
      return;
    }

    const layerRow = OPTIONS.find((o) => o.key === selected);
    const quizSelections = {
      ...(payload.quizSelections || {}),
      layer: layerRow ? layerRow.id : 0,
    };
    const mergedPayload = { ...payload, why: selected, quizSelections };

    this._saveTaskLocked = true;
    this.setData({ saveSubmitting: true });

    const p = Number(quizSelections.priority) || 0;
    const c = Number(quizSelections.circle) || 0;
    const l = Number(quizSelections.layer) || 0;
    const quizCode = buildQuizCode(p, c, l);

    const finishSave = (companionText) => {
      this._persistTask(mergedPayload, selected, quizCode, companionText || "", quizSelections);
    };

    if (!quizCode) {
      finishSave("");
      return;
    }

    fetchGetReply(quizCode).then((res) => {
      if (!res.success) {
        console.warn("[task-why] getReply", quizCode, res.errMsg);
        wx.showToast({ title: "陪伴语暂未加载", icon: "none", duration: 2200 });
      }
      finishSave(res.success && res.data ? res.data.fullText : "");
    });
  },

  _persistTask(mergedPayload, selectedWhy, quizCode, companionText, quizSelections) {
    const now = new Date();
    const draftTaskId = String(mergedPayload.draftTaskId || "").trim();
    const taskId = resolveTaskId(draftTaskId);
    const createdAt = formatDateTime(now);
    const nameTrim = String(mergedPayload.taskName || "").trim();
    const task = {
      id: taskId,
      title: clampTextByLength(nameTrim || "未命名任务", TASK_NAME_MAX),
      content: mergedPayload.taskContent || "暂无描述",
      timeText: createdAt,
      createdAt,
      updatedAt: Date.now(),
      dateValue: mergedPayload.dateValue || "",
      startDate: mergedPayload.startDate || "",
      endDate: mergedPayload.endDate || "",
      statusText: "进行中",
      done: false,
      reminderDate: mergedPayload.reminderDate || "",
      reminderTime: mergedPayload.reminderTime || "",
      reminderFrequency: mergedPayload.reminderFrequency || "不重复",
      tags: buildTags(mergedPayload, selectedWhy),
      quizCode: quizCode || "",
      companionText: companionText || "",
      quizSelections: quizSelections || {},
    };
    persistTaskAndOpenDetail(task, {
      draftTaskId,
      logTag: "task-why",
      onFail: () => {
        this._saveTaskLocked = false;
        this.setData({ saveSubmitting: false });
      },
    });
  },
});
