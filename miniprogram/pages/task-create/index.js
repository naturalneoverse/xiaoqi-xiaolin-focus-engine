const REMIND_FREQUENCY_OPTIONS = ["不重复", "每天", "每周", "每月"];
const TASK_NAME_MAX = 30;
const TASK_CONTENT_MAX = 600;

function formatDateRangeText(startDate, endDate) {
  if (!startDate) return "未选择";
  return endDate ? `${startDate} → ${endDate}` : startDate;
}

function formatReminderText(reminderDate, reminderTime, frequency) {
  if (!reminderDate || !reminderTime) return "未设置";
  return `${reminderDate} ${reminderTime}（${frequency || "不重复"}）`;
}

function clampTextByLength(value, maxLength) {
  const chars = Array.from(value || "");
  if (chars.length <= maxLength) return value || "";
  return chars.slice(0, maxLength).join("");
}

function getLength(value) {
  return Array.from((value || "").trim()).length;
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
    reminderFrequency: "不重复",
    reminderFrequencyOptions: REMIND_FREQUENCY_OPTIONS,
    reminderFrequencyIndex: 0,
    reminderText: "未设置",
    submitting: false,
    taskNameError: "",
    taskContentError: "",
  },

  onLoad() {
    const today = this.getToday();
    this.setData({
      startDate: today,
      draftStartDate: today,
      dateValue: today,
      dateText: today,
    });
  },

  onTaskNameInput(e) {
    const rawValue = e.detail.value || "";
    const currentLength = getLength(rawValue);
    const isExceeded = currentLength > TASK_NAME_MAX;
    this.setData({
      taskName: rawValue,
      taskNameLength: currentLength,
      taskNameError: isExceeded ? "字数超限" : "",
    });
  },

  onTaskContentInput(e) {
    const rawValue = e.detail.value || "";
    const currentLength = getLength(rawValue);
    const isExceeded = currentLength > TASK_CONTENT_MAX;
    this.setData({
      taskContent: rawValue,
      taskContentLength: currentLength,
      taskContentError: isExceeded ? "字数超限" : "",
    });
  },

  getToday() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  },

  openDateModal() {
    this.setData({
      showDateModal: true,
      draftStartDate: this.data.startDate || this.getToday(),
      draftEndDate: this.data.endDate || "",
    });
  },

  closeDateModal() {
    this.setData({
      showDateModal: false,
    });
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

    let nextReminderDate = reminderDate;
    let nextReminderTime = reminderTime;
    let nextFrequency = this.data.reminderFrequency;
    let nextFrequencyIndex = this.data.reminderFrequencyIndex;
    let nextReminderText = this.data.reminderText;

    if (draftEndDate && reminderDate && reminderDate > draftEndDate) {
      nextReminderDate = "";
      nextReminderTime = "";
      nextFrequency = "不重复";
      nextFrequencyIndex = 0;
      nextReminderText = "未设置";
      wx.showToast({
        title: "结束日期提前，提醒已清空",
        icon: "none",
      });
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
    this.setData({
      showReminderModal: true,
    });
  },

  closeReminderModal() {
    this.setData({
      showReminderModal: false,
    });
  },

  onReminderDateChange(e) {
    this.setData({
      reminderDate: e.detail.value,
    });
  },

  onReminderTimeChange(e) {
    this.setData({
      reminderTime: e.detail.value,
    });
  },

  onReminderFrequencyChange(e) {
    const index = Number(e.detail.value);
    const frequency = REMIND_FREQUENCY_OPTIONS[index] || "不重复";
    this.setData({
      reminderFrequency: frequency,
      reminderFrequencyIndex: index,
    });
  },

  confirmReminderModal() {
    const { reminderDate, reminderTime, reminderFrequency, endDate } = this.data;
    if (endDate && reminderDate && reminderDate > endDate) {
      wx.showToast({
        title: "提醒时间不能晚于结束日期",
        icon: "none",
      });
      return;
    }
    const reminderText = formatReminderText(reminderDate, reminderTime, reminderFrequency);
    this.setData({
      showReminderModal: false,
      reminderText,
    });
  },

  noop() {},

  onBack() {
    wx.switchTab({
      url: "/pages/sleep/index",
    });
  },

  next() {
    if (this.data.submitting) return;
    const { taskName, taskContent, dateValue, startDate, endDate, reminderDate, reminderTime, reminderFrequency } =
      this.data;
    const safeTaskName = (taskName || "").trim();
    const safeTaskContent = (taskContent || "").trim();
    const nameExceeded = getLength(safeTaskName) > TASK_NAME_MAX;
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
