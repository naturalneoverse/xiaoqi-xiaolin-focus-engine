const OPTIONS = [
  { key: "生计", desc: "为了生存，做了才能活下去" },
  { key: "职责", desc: "角色赋予你的责任，你在建造什么" },
  { key: "真我", desc: "发自内心的，让你更接近自己的事" },
  { key: "合一", desc: "生计、职责、真我，三层合一" },
];

function parsePayload(payload) {
  try {
    return payload ? JSON.parse(decodeURIComponent(payload)) : {};
  } catch (e) {
    return {};
  }
}

const STORAGE_KEYS = require("../../config/storageKeys");
const dailyCheckIn = require("../../utils/dailyCheckIn");
const TASK_NAME_MAX = 30;

function formatDateTime(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${d} ${hh}:${mm}`;
}

function getPriorityTagClass(text) {
  if (text === "重要且紧急") return "tag-red";
  if (text === "重要不紧急") return "tag-orange";
  if (text === "紧急不重要") return "tag-blue";
  if (text === "不重要不紧急") return "tag-gray";
  return "tag-gray";
}

function getForWhomTagClass(text) {
  if (text === "自己") return "tag-berry";
  if (text === "至亲") return "tag-lavender";
  if (text === "外缘") return "tag-sky";
  if (text === "不二") return "tag-violet";
  return "tag-violet";
}

function getWhyTagClass(text) {
  if (text === "生计") return "tag-amber";
  if (text === "职责") return "tag-teal";
  if (text === "真我") return "tag-gold";
  if (text === "合一") return "tag-deep";
  return "tag-deep";
}

function buildTags(payload, selectedWhy) {
  return [
    payload.priority ? { text: payload.priority, className: getPriorityTagClass(payload.priority) } : null,
    payload.forWhom ? { text: payload.forWhom, className: getForWhomTagClass(payload.forWhom) } : null,
    selectedWhy ? { text: selectedWhy, className: getWhyTagClass(selectedWhy) } : null,
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
  },

  onLoad(options) {
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
    const { selected, payload } = this.data;
    if (!selected) {
      wx.showToast({ title: "请选择一项", icon: "none" });
      return;
    }
    const mergedPayload = { ...payload, why: selected };
    const now = new Date();
    const taskId = `t_${Date.now()}`;
    const createdAt = formatDateTime(now);
    const task = {
      id: taskId,
      title: clampTextByLength(mergedPayload.taskName || "未命名任务", TASK_NAME_MAX),
      content: mergedPayload.taskContent || "暂无描述",
      timeText: createdAt,
      createdAt,
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
    const nextTasks = [task, ...prevTasks];
    try {
      wx.setStorageSync(STORAGE_KEYS.TASKS_DATA, nextTasks);
      dailyCheckIn.recordDailyCheckIn();
    } catch (e) {
      console.error("saveTask setStorageSync", e);
      wx.showToast({ title: "保存失败", icon: "none" });
      return;
    }

    const nextPayload = encodeURIComponent(
      JSON.stringify({
        ...mergedPayload,
        taskId,
        taskName: task.title,
        taskContent: task.content,
        dateValue: task.dateValue,
        statusText: task.statusText,
      }),
    );
    wx.redirectTo({
      url: `/pages/task-detail/index?payload=${nextPayload}&showSuccess=1`,
    });
  },
});
