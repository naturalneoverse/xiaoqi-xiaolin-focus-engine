const reminderSchedule = require("../../utils/reminderSchedule");
const REMIND_FREQUENCY_OPTIONS = reminderSchedule.REMINDER_FREQ_OPTIONS;
const {
  TASK_NAME_MAX,
  TASK_NAME_FIRST_LINE_MAX,
  TASK_CONTENT_MAX,
} = require("../../config/taskLimits");
const { goSleepHome } = require("../../utils/goTabHome");
const { scheduleReminder } = require("../../utils/reminderManager");
const deviceEnv = require("../../utils/deviceEnv");
const speechRecognition = require("../../utils/speechRecognition");

function formatDateRangeText(startDate, endDate) {
  if (!startDate) return "未选择";
  return endDate ? `${startDate} → ${endDate}` : startDate;
}

function formatReminderText(reminderTime, frequency) {
  return reminderSchedule.reminderDisplayText(reminderTime, frequency);
}

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

function newDraftTaskId() {
  const r = Math.floor(Math.random() * 1e9)
    .toString(36)
    .padStart(6, "0");
  return `draft_${Date.now()}_${r}`;
}

Page({
  data: {
    taskName: "",
    taskContent: "",
    taskNameLength: 0,
    taskContentLength: 0,
    dateText: "未选择",
    dateValue: "",
    startDate: "",
    endDate: "",
    showDateModal: false,
    draftStartDate: "",
    draftEndDate: "",
    showReminderModal: false,
    reminderDate: "",
    reminderTime: "",
    reminderFrequency: reminderSchedule.FREQ_SINGLE,
    reminderFrequencyOptions: REMIND_FREQUENCY_OPTIONS,
    reminderFrequencyIndex: 0,
    reminderText: "未设置",
    submitting: false,
    taskNameError: "",
    taskContentError: "",
    draftTaskId: "",
    speechRecordingTarget: "",
    speechNameMicDisabled: false,
    speechContentMicDisabled: false,
    taskNameMax: TASK_NAME_MAX,
    taskContentMax: TASK_CONTENT_MAX,
  },

  _syncSpeechMicState(patch) {
    const data = Object.assign({}, this.data, patch || {});
    const modal = data.showDateModal || data.showReminderModal;
    const rec = data.speechRecordingTarget || "";
    return {
      speechNameMicDisabled:
        modal || data.taskNameLength >= TASK_NAME_MAX || rec === "content",
      speechContentMicDisabled:
        modal || data.taskContentLength >= TASK_CONTENT_MAX || rec === "name",
    };
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: "创建新任务" });
    speechRecognition.warmUp().catch(() => {});
    const today = this.getToday();
    this.setData(
      Object.assign(
        {
          startDate: today,
          draftStartDate: today,
          dateValue: today,
          dateText: today,
          draftTaskId: newDraftTaskId(),
        },
        this._syncSpeechMicState(),
      ),
    );
  },

  onShow() {
    speechRecognition.prepare();
  },

  onUnload() {
    speechRecognition.abort();
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
    if (this.data.showDateModal || this.data.showReminderModal) return;

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

  getToday() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  },

  /**
   * 弹层内只有 picker，不应再出现「文字输入法」。
   * 先 hideKeyboard，再在延迟后打开弹层；同时 input/textarea 在弹层打开期间 disabled，强制失焦收起键盘。
   */
  _openOverlayAfterKeyboardClear(patch) {
    const reveal = () => {
      this.setData(Object.assign({}, patch, this._syncSpeechMicState(patch)));
    };
    const afterKb = () => {
      setTimeout(reveal, 220);
    };
    if (typeof wx.hideKeyboard === "function") {
      wx.hideKeyboard({
        complete: afterKb,
        fail: afterKb,
      });
    } else {
      afterKb();
    }
  },

  openDateModal() {
    this._openOverlayAfterKeyboardClear({
      showDateModal: true,
      draftStartDate: this.data.startDate || this.getToday(),
      draftEndDate: this.data.endDate || "",
    });
  },

  closeDateModal() {
    this.setData(
      Object.assign({ showDateModal: false }, this._syncSpeechMicState({ showDateModal: false })),
    );
  },

  onDraftStartDateChange(e) {
    const draftStartDate = e.detail.value;
    let draftEndDate = this.data.draftEndDate;
    if (draftEndDate && draftEndDate < draftStartDate) {
      draftEndDate = draftStartDate;
    }
    this.setData({ draftStartDate, draftEndDate });
  },

  onDraftEndDateChange(e) {
    this.setData({
      draftEndDate: e.detail.value,
    });
  },

  clearDraftEndDate() {
    this.setData({
      draftEndDate: "",
    });
  },

  confirmDateModal() {
    const { draftStartDate, draftEndDate, reminderDate, reminderTime } = this.data;
    if (draftEndDate && draftEndDate < draftStartDate) {
      wx.showToast({
        title: "结束日期不能早于开始日期",
        icon: "none",
      });
      return;
    }

    let nextReminderDate = reminderTime ? reminderSchedule.computeNextReminderDateYMD(reminderTime) : reminderDate || "";
    let nextReminderTime = reminderTime;
    let nextFrequency = this.data.reminderFrequency;
    let nextFrequencyIndex = this.data.reminderFrequencyIndex;
    let nextReminderText = formatReminderText(nextReminderTime, nextFrequency);

    const computedRd = reminderTime ? reminderSchedule.computeNextReminderDateYMD(reminderTime) : "";
    if (draftEndDate && computedRd && computedRd > draftEndDate) {
      nextReminderDate = "";
      nextReminderTime = "";
      nextFrequency = "不重复";
      nextFrequencyIndex = 0;
      nextReminderText = "未设置";
      wx.showToast({
        title: "结束日期提前，提醒已清空",
        icon: "none",
      });
    } else if (reminderTime) {
      nextReminderDate = computedRd;
      nextReminderText = formatReminderText(nextReminderTime, nextFrequency);
    }

    const dateText = formatDateRangeText(draftStartDate, draftEndDate);
    this.setData({
      showDateModal: false,
      startDate: draftStartDate,
      endDate: draftEndDate,
      dateValue: dateText,
      dateText,
      reminderDate: nextReminderDate,
      reminderTime: nextReminderTime,
      reminderFrequency: nextFrequency,
      reminderFrequencyIndex: nextFrequencyIndex,
      reminderText: nextReminderText,
    });
  },

  openReminderModal() {
    const f = reminderSchedule.normalizeReminderFrequency(this.data.reminderFrequency);
    const idx = reminderSchedule.reminderFrequencyIndex(f);
    this._openOverlayAfterKeyboardClear({
      showReminderModal: true,
      reminderFrequency: f,
      reminderFrequencyIndex: idx,
    });
  },

  closeReminderModal() {
    this.setData(
      Object.assign({ showReminderModal: false }, this._syncSpeechMicState({ showReminderModal: false })),
    );
  },

  onReminderTimeChange(e) {
    this.setData({
      reminderTime: e.detail.value,
    });
  },

  onReminderFrequencyChange(e) {
    const index = Number(e.detail.value);
    const frequency = REMIND_FREQUENCY_OPTIONS[index] || reminderSchedule.FREQ_SINGLE;
    this.setData({
      reminderFrequency: frequency,
      reminderFrequencyIndex: index,
    });
  },

  confirmReminderModal() {
    const { reminderTime, reminderFrequency, startDate, endDate, taskName, draftTaskId } =
      this.data;
    if (!reminderTime) {
      this.setData({
        showReminderModal: false,
        reminderDate: "",
        reminderText: "未设置",
      });
      return;
    }
    if (!startDate) {
      wx.showToast({ title: "请先选择开始日期", icon: "none" });
      return;
    }
    const parts = String(reminderTime).split(":");
    const hour = Number(parts[0]);
    const minute = Number(parts[1]);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      wx.showToast({ title: "时间格式无效", icon: "none" });
      return;
    }

    const freq = reminderSchedule.normalizeReminderFrequency(reminderFrequency);
    if (
      freq === reminderSchedule.FREQ_DAILY ||
      freq === reminderSchedule.FREQ_START_END
    ) {
      if (!endDate) {
        wx.showToast({ title: "请先选择结束日期", icon: "none" });
        return;
      }
      if (endDate < startDate) {
        wx.showToast({ title: "结束日期不能早于开始日期", icon: "none" });
        return;
      }
    }

    const preview = reminderSchedule.computeReminderPreview(
      startDate,
      endDate,
      reminderTime,
      freq,
      "进行中",
    );
    if (!preview.days.length) {
      wx.showToast({ title: "区间内没有可设置的提醒时间", icon: "none" });
      return;
    }

    const reminderDate = preview.days[0] || "";
    const reminderText = formatReminderText(reminderTime, reminderFrequency);
    const finish = () => {
      this.setData({
        showReminderModal: false,
        reminderText,
        reminderDate,
        reminderTime,
        reminderFrequency: freq,
        reminderFrequencyIndex: reminderSchedule.reminderFrequencyIndex(freq),
      });
    };

    if (deviceEnv.isDesktopWechat()) {
      finish();
      deviceEnv.showMobileOnlyModal({ feature: "日历提醒" });
      return;
    }

    const titleBase = `${stripTaskNameNewlines(taskName).trim() || "任务"} 提醒`;
    if (this._reminderScheduling) return;
    this._reminderScheduling = true;
    scheduleReminder("task", {
      hour,
      minute,
      day: reminderDate,
      startDate,
      endDate,
      taskId: draftTaskId,
      title: titleBase,
      frequencyLabel: reminderFrequency,
    })
      .then((ok) => {
        if (ok) finish();
      })
      .catch(() => {})
      .then(() => {
        this._reminderScheduling = false;
      });
  },

  noop() {},

  onBack() {
    const stack = getCurrentPages();
    if (stack.length > 1) {
      wx.navigateBack({
        fail: (err) => {
          console.warn("[task-create] navigateBack fail", err);
          goSleepHome();
        },
      });
      return;
    }
    goSleepHome();
  },

  next() {
    if (this.data.submitting) return;
    const { taskName, taskContent, dateValue, startDate, endDate, reminderTime, reminderFrequency } = this.data;
    let { reminderDate } = this.data;
    if (reminderTime) {
      reminderDate = reminderSchedule.computeNextReminderDateYMD(reminderTime);
    } else {
      reminderDate = "";
    }
    const safeTaskName = stripTaskNameNewlines(taskName).trim();
    const safeTaskContent = (taskContent || "").trim();
    const nameExceeded = getTaskNameLength(safeTaskName) > TASK_NAME_MAX;
    const contentExceeded = getLength(safeTaskContent) > TASK_CONTENT_MAX;
    this.setData({
      taskNameError: nameExceeded ? "字数超限" : "",
      taskContentError: contentExceeded ? "字数超限" : "",
    });
    if (!safeTaskName) {
      wx.showToast({
        title: "请输入任务名称",
        icon: "none",
      });
      return;
    }
    if (nameExceeded || contentExceeded) {
      wx.showToast({
        title: "字数超限",
        icon: "none",
      });
      return;
    }
    const payload = encodeURIComponent(
      JSON.stringify({
        taskName: safeTaskName,
        taskContent: safeTaskContent,
        dateValue,
        startDate,
        endDate,
        reminderDate,
        reminderTime,
        reminderFrequency,
        draftTaskId: this.data.draftTaskId,
      }),
    );
    this.setData({ submitting: true });
    wx.navigateTo({
      url: `/pages/task-priority/index?payload=${payload}`,
      complete: () => {
        setTimeout(() => {
          this.setData({ submitting: false });
        }, 400);
      },
    });
  },
});
