const REMIND_FREQUENCY_OPTIONS = ["不重复", "每天", "每周", "每月"];
const TASK_NAME_MAX = 30;
const TASK_CONTENT_MAX = 600;
const { TASK_SCHEDULE_REMINDER_TMPL_ID } = require("../../config/subscribeTemplates");
const { goSleepHome } = require("../../utils/goTabHome");
const { requireLoginOnLoad } = require("../../utils/requireLogin");

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
    if (!requireLoginOnLoad()) return;
    wx.setNavigationBarTitle({ title: "创建新任务" });
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

  /**
   * 弹层内只有 picker，不应再出现「文字输入法」。
   * 先 hideKeyboard，再在延迟后打开弹层；同时 input/textarea 在弹层打开期间 disabled，强制失焦收起键盘。
   */
  _openOverlayAfterKeyboardClear(patch) {
    const reveal = () => {
      this.setData(patch);
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
    this._openOverlayAfterKeyboardClear({
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
    const finish = () => {
      this.setData({
        showReminderModal: false,
        reminderText,
      });
    };
    /** 仅「确定」且已选日期+时间时申请一次性订阅；拒绝/失败静默；未选满则不调订阅 */
    const hasSchedule = !!(reminderDate && reminderTime);
    if (hasSchedule && wx.requestSubscribeMessage && TASK_SCHEDULE_REMINDER_TMPL_ID) {
      try {
        wx.requestSubscribeMessage({
          tmplIds: [TASK_SCHEDULE_REMINDER_TMPL_ID],
          success() {},
          fail() {},
          complete: finish,
        });
      } catch (e) {
        finish();
      }
    } else {
      finish();
    }
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
