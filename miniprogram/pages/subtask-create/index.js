const {
  TASK_NAME_MAX,
  TASK_NAME_FIRST_LINE_MAX,
  TASK_CONTENT_MAX,
} = require("../../config/taskLimits");
const subtask = require("../../utils/subtask");
const speechRecognition = require("../../utils/speechRecognition");

function clampTextByLength(value, maxLength) {
  const chars = Array.from(value || "");
  if (chars.length <= maxLength) return value || "";
  return chars.slice(0, maxLength).join("");
}

function getLength(value) {
  return Array.from((value || "").trim()).length;
}

function stripTaskNameNewlines(value) {
  return (value || "").replace(/\n/g, "");
}

function getTaskNameLength(value) {
  return Array.from(stripTaskNameNewlines(value).trim()).length;
}

function wrapTaskNameLines(plain) {
  const chars = Array.from(plain || "");
  if (!chars.length) return "";
  const line1 = chars.slice(0, TASK_NAME_FIRST_LINE_MAX).join("");
  const line2 = chars.slice(TASK_NAME_FIRST_LINE_MAX, TASK_NAME_MAX).join("");
  if (!line2) return line1;
  return `${line1}\n${line2}`;
}

function normalizeTaskNameInput(value) {
  const plain = stripTaskNameNewlines(value);
  const clamped = clampTextByLength(plain, TASK_NAME_MAX);
  return wrapTaskNameLines(clamped);
}

function formatDateRangeText(startDate, endDate) {
  if (!startDate) return "未选择";
  return endDate ? `${startDate} → ${endDate}` : startDate;
}

Page({
  data: {
    parentTaskId: "",
    parentTitle: "",
    taskName: "",
    taskContent: "",
    taskNameLength: 0,
    taskContentLength: 0,
    taskNameError: "",
    taskContentError: "",
    startDate: "",
    endDate: "",
    dateText: "未选择",
    saving: false,
    speechRecordingTarget: "",
    speechNameMicDisabled: false,
    speechContentMicDisabled: false,
    taskNameMax: TASK_NAME_MAX,
    taskContentMax: TASK_CONTENT_MAX,
  },

  _syncSpeechMicState(patch) {
    const data = Object.assign({}, this.data, patch || {});
    const rec = data.speechRecordingTarget || "";
    return {
      speechNameMicDisabled:
        data.taskNameLength >= TASK_NAME_MAX || rec === "content",
      speechContentMicDisabled:
        data.taskContentLength >= TASK_CONTENT_MAX || rec === "name",
    };
  },

  onLoad(options) {
    speechRecognition.warmUp().catch(() => {});
    const parentTaskId = options && options.parentTaskId ? decodeURIComponent(String(options.parentTaskId)) : "";
    if (!parentTaskId) {
      wx.showToast({ title: "无法添加", icon: "none" });
      setTimeout(() => wx.navigateBack(), 400);
      return;
    }
    const parent = subtask.findTaskById(subtask.readTasks(), parentTaskId);
    if (!parent || subtask.isSubtask(parent)) {
      wx.showToast({ title: "任务不存在", icon: "none" });
      setTimeout(() => wx.navigateBack(), 400);
      return;
    }
    const gate = subtask.canAddSubtaskToParent(parent, subtask.readTasks());
    if (!gate.ok) {
      const msg =
        gate.reason === "limit"
          ? "已达 20 条上限，请返回详情页转为独立任务"
          : gate.message || "无法添加";
      wx.showToast({ title: msg, icon: "none" });
      setTimeout(() => wx.navigateBack(), 600);
      return;
    }

    const startDate = parent.startDate || "";
    const endDate = parent.endDate || "";
    this.setData(
      Object.assign(
        {
          parentTaskId,
          parentTitle: parent.title || "未命名任务",
          startDate,
          endDate,
          dateText: formatDateRangeText(startDate, endDate),
        },
        this._syncSpeechMicState(),
      ),
    );
    wx.setNavigationBarTitle({ title: "添加子任务" });
  },

  onShow() {
    speechRecognition.prepare();
  },

  onUnload() {
    speechRecognition.abort();
  },

  onReady() {
    this.setData({ nameFocus: true });
  },

  onTaskNameInput(e) {
    const rawValue = e.detail.value || "";
    const next = normalizeTaskNameInput(rawValue);
    const currentLength = getTaskNameLength(next);
    const isExceeded = currentLength > TASK_NAME_MAX;
    this.setData(
      Object.assign(
        {
          taskName: next,
          taskNameLength: currentLength,
          taskNameError: isExceeded ? "字数超限" : "",
        },
        this._syncSpeechMicState({ taskNameLength: currentLength }),
      ),
    );
  },

  onTaskContentInput(e) {
    const rawValue = e.detail.value || "";
    const currentLength = getLength(rawValue);
    const isExceeded = currentLength > TASK_CONTENT_MAX;
    this.setData(
      Object.assign(
        {
          taskContent: rawValue,
          taskContentLength: currentLength,
          taskContentError: isExceeded ? "字数超限" : "",
        },
        this._syncSpeechMicState({ taskContentLength: currentLength }),
      ),
    );
  },

  appendSpeechText(field, text) {
    if (!text) return;
    if (field === "name") {
      const merged = `${stripTaskNameNewlines(this.data.taskName)}${text}`;
      const next = normalizeTaskNameInput(merged);
      const currentLength = getTaskNameLength(next);
      const isExceeded = currentLength > TASK_NAME_MAX;
      this.setData(
        Object.assign(
          {
            taskName: next,
            taskNameLength: currentLength,
            taskNameError: isExceeded ? "字数超限" : "",
          },
          this._syncSpeechMicState({ taskNameLength: currentLength }),
        ),
      );
      return;
    }
    if (field === "content") {
      const merged = `${this.data.taskContent || ""}${text}`;
      const next = clampTextByLength(merged, TASK_CONTENT_MAX);
      const currentLength = getLength(next);
      const isExceeded = currentLength > TASK_CONTENT_MAX;
      this.setData(
        Object.assign(
          {
            taskContent: next,
            taskContentLength: currentLength,
            taskContentError: isExceeded ? "字数超限" : "",
          },
          this._syncSpeechMicState({ taskContentLength: currentLength }),
        ),
      );
    }
  },

  _speechFieldFromEvent(e) {
    return (e.currentTarget.dataset && e.currentTarget.dataset.field) || "";
  },

  _onSpeechAutoEnd(field, result) {
    const targetField = (result && result.field) || field || "";
    this.setData(
      Object.assign({ speechRecordingTarget: "" }, this._syncSpeechMicState({ speechRecordingTarget: "" })),
    );
    if (result && result.ok && result.text && targetField) {
      this.appendSpeechText(targetField, result.text);
    }
  },

  onSpeechLongPress(e) {
    const field = this._speechFieldFromEvent(e);
    if (field !== "name" && field !== "content") return;

    if (field === "name" && this.data.taskNameLength >= TASK_NAME_MAX) {
      wx.showToast({ title: speechRecognition.TOAST_NAME_FULL, icon: "none" });
      return;
    }
    if (field === "content" && this.data.taskContentLength >= TASK_CONTENT_MAX) {
      wx.showToast({ title: speechRecognition.TOAST_CONTENT_FULL, icon: "none" });
      return;
    }
    if (this.data.speechRecordingTarget) return;

    speechRecognition
      .start(field, (result) => this._onSpeechAutoEnd(field, result))
      .then((started) => {
        if (!started) return;
        this.setData(
          Object.assign(
            { speechRecordingTarget: field },
            this._syncSpeechMicState({ speechRecordingTarget: field }),
          ),
        );
      })
      .catch(() => {});
  },

  onSpeechTouchEnd(e) {
    const field = this._speechFieldFromEvent(e);
    if (!speechRecognition.hasActiveSession()) return;
    speechRecognition.stopForField(field) || speechRecognition.stopActive();
  },

  onStartDateChange(e) {
    const startDate = e.detail.value;
    let endDate = this.data.endDate;
    if (endDate && endDate < startDate) endDate = startDate;
    this.setData({
      startDate,
      endDate,
      dateText: formatDateRangeText(startDate, endDate),
    });
  },

  onEndDateChange(e) {
    this.setData({
      endDate: e.detail.value,
      dateText: formatDateRangeText(this.data.startDate, e.detail.value),
    });
  },

  clearEndDate() {
    this.setData({
      endDate: "",
      dateText: formatDateRangeText(this.data.startDate, ""),
    });
  },

  goBack() {
    wx.navigateBack();
  },

  onCreate() {
    if (this.data.saving) return;
    const safeTaskName = stripTaskNameNewlines(this.data.taskName).trim();
    const safeTaskContent = (this.data.taskContent || "").trim();
    const nameExceeded = getTaskNameLength(safeTaskName) > TASK_NAME_MAX;
    const contentExceeded = getLength(safeTaskContent) > TASK_CONTENT_MAX;
    if (nameExceeded || contentExceeded) {
      this.setData({
        taskNameError: nameExceeded ? "字数超限" : "",
        taskContentError: contentExceeded ? "字数超限" : "",
      });
      wx.showToast({ title: "请检查字数", icon: "none" });
      return;
    }
    if (!safeTaskName) {
      wx.showToast({ title: "请输入子任务名称", icon: "none" });
      return;
    }
    this.setData({ saving: true });
    const res = subtask.createSubtask(this.data.parentTaskId, {
      title: safeTaskName,
      content: safeTaskContent,
      startDate: this.data.startDate,
      endDate: this.data.endDate,
      dateValue: this.data.dateText,
    });
    this.setData({ saving: false });
    if (!res.ok) {
      wx.showToast({ title: res.message || "创建失败", icon: "none" });
      return;
    }
    wx.showToast({ title: "已添加", icon: "success" });
    setTimeout(() => wx.navigateBack(), 400);
  },
});
