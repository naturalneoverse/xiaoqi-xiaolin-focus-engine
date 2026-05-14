const OPTIONS = [
  { key: "生计", desc: "为了生存，做了才能活下去" },
  { key: "职责", desc: "角色赋予你的责任，你在建造什么" },
  { key: "真我", desc: "发自内心的，让你更接近自己的事" },
  { key: "合一", desc: "生计、职责、真我，三层合一" },
];

const { parsePayload } = require("../../utils/parsePayload");

const STORAGE_KEYS = require("../../config/storageKeys");
const { requireLoginOnLoad } = require("../../utils/requireLogin");
const dailyCheckIn = require("../../utils/dailyCheckIn");
const { goSleepHome } = require("../../utils/goTabHome");
const { formatDateTime } = require("../../utils/dateFormat");
const {
  getPriorityTagClass,
  getForWhomTagClass,
  getWhyTagClass,
} = require("../../utils/taskTagStyles");
const TASK_NAME_MAX = 30;

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

/** 本地任务 id：时间戳 + 随机段，避免连点同毫秒撞号；与云 saveTask 的 string id 一致 */
function newLocalTaskId() {
  const r = Math.floor(Math.random() * 1e9)
    .toString(36)
    .padStart(6, "0");
  return `t_${Date.now()}_${r}`;
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
    this._saveTaskLocked = true;
    this.setData({ saveSubmitting: true });
    const mergedPayload = { ...payload, why: selected };
    const now = new Date();
    const taskId = newLocalTaskId();
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
      statusText: "进行中",
      done: false,
      reminderDate: mergedPayload.reminderDate || "",
      reminderTime: mergedPayload.reminderTime || "",
      reminderFrequency: mergedPayload.reminderFrequency || "不重复",
      tags: buildTags(mergedPayload, selected),
    };
    let prevTasks = [];
    try {
      const raw = wx.getStorageSync(STORAGE_KEYS.TASKS_DATA);
      prevTasks = Array.isArray(raw) ? raw : [];
    } catch (e) {
      console.error("saveTask getStorageSync", e);
      prevTasks = [];
    }
    const nextTasks = [task, ...prevTasks.filter((t) => t && t.id !== taskId)];
    try {
      wx.setStorageSync(STORAGE_KEYS.TASKS_DATA, nextTasks);
      dailyCheckIn.recordDailyCheckIn();
    } catch (e) {
      console.error("saveTask setStorageSync", e);
      this._saveTaskLocked = false;
      this.setData({ saveSubmitting: false });
      wx.showToast({ title: "保存失败", icon: "none" });
      return;
    }

    try {
      const cloudDataSync = require("../../utils/cloudDataSync");
      const redirectUrl = `/pages/task-detail/index?taskId=${encodeURIComponent(taskId)}&showSuccess=1`;
      const doRedirect = () => {
        wx.redirectTo({
          url: redirectUrl,
          fail: (err) => {
            console.error("redirectTo task-detail", err);
            wx.showToast({ title: "打开详情失败，任务已保存", icon: "none" });
            setTimeout(() => {
              goSleepHome();
            }, 800);
          },
        });
      };
      /* 短 query；须等云同步结束再 redirectTo，否则卸载本页会中断未完成的 callFunction */
      Promise.resolve(cloudDataSync.afterTaskSaved(task))
        .catch(() => {})
        .finally(() => {
          doRedirect();
        });
    } catch (e) {
      console.warn("[task-why] cloudDataSync", e);
      wx.redirectTo({
        url: `/pages/task-detail/index?taskId=${encodeURIComponent(taskId)}&showSuccess=1`,
        fail: (err) => {
          console.error("redirectTo task-detail", err);
          wx.showToast({ title: "打开详情失败，任务已保存", icon: "none" });
          setTimeout(() => {
            goSleepHome();
          }, 800);
        },
      });
    }

    return;
  },
});
