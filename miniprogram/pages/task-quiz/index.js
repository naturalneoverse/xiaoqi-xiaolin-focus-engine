const { parsePayload } = require("../../utils/parsePayload");
const { requireLoginOnLoad } = require("../../utils/requireLogin");
const { QUIZ_SECTIONS, labelsFromIds } = require("../../config/taskQuizChoices");
const {
  buildQuizCode,
  fetchTaskQuizCopy,
  fetchTaskQuizInsight,
} = require("../../utils/taskQuizClient");
const STORAGE_KEYS = require("../../config/storageKeys");
const dailyCheckIn = require("../../utils/dailyCheckIn");
const { goSleepHome } = require("../../utils/goTabHome");
const { formatDateTime } = require("../../utils/dateFormat");
const {
  getPriorityTagClass,
  getForWhomTagClass,
  getWhyTagClass,
} = require("../../utils/taskTagStyles");
const { TASK_NAME_MAX } = require("../../config/taskLimits");
const reminderRegistry = require("../../utils/reminderRegistry");

function clampTextByLength(value, maxLength) {
  const chars = Array.from(value || "");
  if (chars.length <= maxLength) return value || "";
  return chars.slice(0, maxLength).join("");
}

function newLocalTaskId() {
  const r = Math.floor(Math.random() * 1e9)
    .toString(36)
    .padStart(6, "0");
  return `t_${Date.now()}_${r}`;
}

function buildTags(labels) {
  return [
    labels.priority
      ? { text: labels.priority, className: getPriorityTagClass(labels.priority) || "tag-gray" }
      : null,
    labels.circle
      ? { text: labels.circle, className: getForWhomTagClass(labels.circle) || "tag-violet" }
      : null,
    labels.layer
      ? { text: labels.layer, className: getWhyTagClass(labels.layer) || "tag-deep" }
      : null,
  ].filter(Boolean);
}

function allSelected(selections) {
  return (
    selections.priority >= 1 &&
    selections.priority <= 4 &&
    selections.circle >= 1 &&
    selections.circle <= 4 &&
    selections.layer >= 1 &&
    selections.layer <= 4
  );
}

Page({
  data: {
    sections: QUIZ_SECTIONS,
    selections: { priority: 0, circle: 0, layer: 0 },
    payload: {},
    quizCode: "",
    companionText: "",
    insightText: "",
    replyRecord: null,
    loadingCopy: false,
    insightLoading: false,
    saveSubmitting: false,
    primaryBtnText: "生成陪伴语",
  },

  onLoad(options) {
    if (!requireLoginOnLoad()) return;
    const payload = parsePayload(options.payload);
    const restored = payload.quizSelections || {};
    this.setData({
      payload,
      selections: {
        priority: Number(restored.priority) || 0,
        circle: Number(restored.circle) || 0,
        layer: Number(restored.layer) || 0,
      },
      quizCode: payload.quizCode || "",
      companionText: payload.companionText || "",
      primaryBtnText: payload.companionText ? "保存任务" : "生成陪伴语",
    });
  },

  onChoose(e) {
    const section = e.currentTarget.dataset.section;
    const id = Number(e.currentTarget.dataset.id);
    if (!section || !id) return;
    const selections = { ...this.data.selections, [section]: id };
    this.setData({
      selections,
      quizCode: "",
      companionText: "",
      insightText: "",
      replyRecord: null,
      primaryBtnText: "生成陪伴语",
    });
  },

  goPrev() {
    this.__safeNavigateBack("/pages/sleep/index");
  },

  onPrimaryAction() {
    if (this.data.companionText) {
      this.saveTask();
      return;
    }
    this.loadCompanionCopy();
  },

  loadCompanionCopy() {
    const { selections } = this.data;
    if (!allSelected(selections)) {
      wx.showToast({ title: "请完成三道选择题", icon: "none" });
      return;
    }
    const code = buildQuizCode(selections.priority, selections.circle, selections.layer);
    this.setData({ loadingCopy: true, insightText: "" });
    fetchTaskQuizCopy(code).then((res) => {
      if (!res || !res.fullText) {
        wx.showToast({
          title: (res && res.errMsg) || "陪伴语加载失败，请稍后重试",
          icon: "none",
        });
        this.setData({ loadingCopy: false });
        return;
      }
      this.setData({
        loadingCopy: false,
        quizCode: code,
        companionText: res.fullText,
        replyRecord: res,
        primaryBtnText: "保存任务",
      });
    });
  },

  onTapInsight() {
    const { quizCode, selections, insightLoading, loadingCopy, replyRecord } = this.data;
    if (insightLoading || loadingCopy || !quizCode) return;
    const labels = labelsFromIds(selections.priority, selections.circle, selections.layer);
    this.setData({ insightLoading: true });
    fetchTaskQuizInsight(quizCode, labels, replyRecord).then((text) => {
      this.setData({
        insightLoading: false,
        insightText: text || "小麒看见，这三枚标签已经轻轻落在同一件事上了。",
      });
    });
  },

  saveTask() {
    if (this._saveTaskLocked) return;
    const { selections, payload, companionText, quizCode, saveSubmitting } = this.data;
    if (saveSubmitting) return;
    if (!allSelected(selections)) {
      wx.showToast({ title: "请完成三道选择题", icon: "none" });
      return;
    }
    const finishSave = () => {
      const labels = labelsFromIds(selections.priority, selections.circle, selections.layer);
      this._persistTask(labels, companionText, quizCode);
    };
    if (!companionText) {
      const code = buildQuizCode(selections.priority, selections.circle, selections.layer);
      this.setData({ loadingCopy: true });
      fetchTaskQuizCopy(code).then((res) => {
        if (!res || !res.fullText) {
          wx.showToast({
            title: (res && res.errMsg) || "陪伴语加载失败",
            icon: "none",
          });
          this.setData({ loadingCopy: false });
          return;
        }
        this.setData({
          loadingCopy: false,
          quizCode: code,
          companionText: res.fullText,
          replyRecord: res,
        });
        finishSave();
      });
      return;
    }
    finishSave();
  },

  _persistTask(labels, companionText, quizCode) {
    this._saveTaskLocked = true;
    this.setData({ saveSubmitting: true });
    const payload = this.data.payload;
    const now = new Date();
    const taskId = newLocalTaskId();
    const createdAt = formatDateTime(now);
    const nameTrim = String(payload.taskName || "").trim();
    const task = {
      id: taskId,
      title: clampTextByLength(nameTrim || "未命名任务", TASK_NAME_MAX),
      content: payload.taskContent || "暂无描述",
      timeText: createdAt,
      createdAt,
      updatedAt: Date.now(),
      dateValue: payload.dateValue || "",
      startDate: payload.startDate || "",
      endDate: payload.endDate || "",
      statusText: "进行中",
      done: false,
      reminderDate: payload.reminderDate || "",
      reminderTime: payload.reminderTime || "",
      reminderFrequency: payload.reminderFrequency || "不重复",
      tags: buildTags(labels),
      quizCode: quizCode || buildQuizCode(this.data.selections.priority, this.data.selections.circle, this.data.selections.layer),
      companionText: companionText || "",
      quizSelections: { ...this.data.selections },
    };
    const draftTaskId = String(payload.draftTaskId || "").trim();
    if (draftTaskId) {
      reminderRegistry.migrateRecord(draftTaskId, taskId);
    }
    let prevTasks = [];
    try {
      const raw = wx.getStorageSync(STORAGE_KEYS.TASKS_DATA);
      prevTasks = Array.isArray(raw) ? raw : [];
    } catch (e) {
      console.error("task-quiz save getStorageSync", e);
      prevTasks = [];
    }
    const nextTasks = [task, ...prevTasks.filter((t) => t && t.id !== taskId)];
    try {
      wx.setStorageSync(STORAGE_KEYS.TASKS_DATA, nextTasks);
      dailyCheckIn.recordDailyCheckIn();
    } catch (e) {
      console.error("task-quiz save setStorageSync", e);
      this._saveTaskLocked = false;
      this.setData({ saveSubmitting: false });
      wx.showToast({ title: "保存失败", icon: "none" });
      return;
    }

    const redirectUrl = `/pages/task-detail/index?taskId=${encodeURIComponent(taskId)}&showSuccess=1`;
    const doRedirect = () => {
      wx.redirectTo({
        url: redirectUrl,
        fail: () => {
          wx.showToast({ title: "打开详情失败，任务已保存", icon: "none" });
          setTimeout(() => goSleepHome(), 800);
        },
      });
    };
    try {
      const cloudDataSync = require("../../utils/cloudDataSync");
      Promise.resolve(cloudDataSync.afterTaskSaved(task))
        .catch(() => {})
        .finally(doRedirect);
    } catch (e) {
      console.warn("[task-quiz] cloudDataSync", e);
      doRedirect();
    }
  },
});
