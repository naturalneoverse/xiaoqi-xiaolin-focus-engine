function parsePayload(payload) {
  try {
    return payload ? JSON.parse(decodeURIComponent(payload)) : {};
  } catch (e) {
    return {};
  }
}

const TASKS_STORAGE_KEY = "sleep_tasks";
const STATUS_OPTIONS = ["进行中", "已完成", "已延期", "已取消"];

function getStatusClass(statusText) {
  if (statusText === "已完成") return "status-value-completed";
  if (statusText === "已延期") return "status-value-delayed";
  if (statusText === "已取消") return "status-value-cancelled";
  return "";
}

function toCompletedAt() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

Page({
  data: {
    taskName: "未命名任务",
    taskContent: "暂无描述",
    dateText: "未设置",
    statusText: "进行中",
    statusOptions: STATUS_OPTIONS,
    statusIndex: 0,
    statusClass: "",
    taskId: "",
    reminderDate: "",
    reminderTime: "",
    reminderFrequency: "不重复",
    tags: [],
    showMascotModal: false,
    xiaoqiImage: "/images/transparent background/xiaoqi.png",
    mascotBubbleText:
      "恭喜您完成全部选择～\n认真梳理轻重、对象与初心，\n慢慢理清生活的秩序感，\n每一次向内梳理，都是在好好爱自己❤️",
  },

  onLoad(options) {
    const payload = parsePayload(options.payload);
    const tags = [payload.priority, payload.forWhom, payload.why].filter(Boolean);
    const app = getApp();
    const imageAssets = (app && app.globalData && app.globalData.imageAssets) || {};
    this.setData({
      taskId: payload.taskId || "",
      taskName: payload.taskName || "未命名任务",
      taskContent: payload.taskContent || "暂无描述",
      dateText: payload.dateValue || "未设置",
      statusText: payload.statusText || "进行中",
      statusIndex: Math.max(0, STATUS_OPTIONS.indexOf(payload.statusText || "进行中")),
      statusClass: getStatusClass(payload.statusText || "进行中"),
      reminderDate: payload.reminderDate || "",
      reminderTime: payload.reminderTime || "",
      reminderFrequency: payload.reminderFrequency || "不重复",
      tags,
      showMascotModal: options.showSuccess === "1",
      xiaoqiImage: imageAssets.xiaoqi || "/images/transparent background/xiaoqi.png",
    });
  },

  onStatusChange(e) {
    const index = Number(e.detail.value);
    const nextStatus = STATUS_OPTIONS[index] || STATUS_OPTIONS[0];
    this.setData({
      statusText: nextStatus,
      statusIndex: index,
      statusClass: getStatusClass(nextStatus),
    });
    if (nextStatus === "已完成" || nextStatus === "已取消") {
      const hasReminder = this.data.reminderDate && this.data.reminderTime;
      this.setData({
        reminderDate: "",
        reminderTime: "",
        reminderFrequency: "不重复",
      });
      if (hasReminder) {
        wx.showToast({
          title: "任务已结束，提醒已停止",
          icon: "none",
        });
      }
    }
    this.persistStatus(nextStatus);
  },

  persistStatus(nextStatus) {
    const { taskId } = this.data;
    if (!taskId) return;
    const tasks = wx.getStorageSync(TASKS_STORAGE_KEY);
    if (!Array.isArray(tasks)) return;
    const nextTasks = tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            statusText: nextStatus,
            done: nextStatus === "已完成",
            completedAt: nextStatus === "已完成" ? toCompletedAt() : "",
            reminderDate: this.data.reminderDate,
            reminderTime: this.data.reminderTime,
            reminderFrequency: this.data.reminderFrequency,
          }
        : task,
    );
    wx.setStorageSync(TASKS_STORAGE_KEY, nextTasks);
  },

  closeMascotModal() {
    this.setData({
      showMascotModal: false,
    });
  },

  goHome() {
    wx.switchTab({
      url: "/pages/sleep/index",
    });
  },

  // Defensive handlers: avoid runtime crash if stale WXML binds old events.
  toggleAgree() {},

  onLoginTap() {},

  noop() {},
});
