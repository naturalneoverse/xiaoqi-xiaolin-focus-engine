const { scheduleReminder } = require("../../utils/reminderManager");

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function nowTimeStr() {
  const now = new Date();
  const next = new Date(now.getTime() + 2 * 60 * 1000);
  return `${pad2(next.getHours())}:${pad2(next.getMinutes())}`;
}

Page({
  data: {
    dateValue: "",
    timeValue: "",
    title: "测试提醒",
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: "闹钟提醒测试" });
    this.setData({
      dateValue: todayStr(),
      timeValue: nowTimeStr(),
    });
  },

  onDateChange(e) {
    this.setData({ dateValue: e.detail.value || "" });
  },

  onTimeChange(e) {
    this.setData({ timeValue: e.detail.value || "" });
  },

  onTitleInput(e) {
    this.setData({ title: (e.detail && e.detail.value) || "" });
  },

  onSave() {
    const { dateValue, timeValue, title } = this.data;
    if (!dateValue || !timeValue) {
      wx.showToast({ title: "请选择日期与时间", icon: "none" });
      return;
    }
    const segs = String(timeValue).split(":");
    const hour = Number(segs[0]);
    const minute = Number(segs[1]);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      wx.showToast({ title: "时间无效", icon: "none" });
      return;
    }
    const t = String(title || "").trim() || "测试提醒";
    if (this._reminderScheduling) return;
    this._reminderScheduling = true;
    scheduleReminder("task", {
      hour,
      minute,
      day: dateValue,
      title: t,
    })
      .catch(() => {})
      .then(() => {
        this._reminderScheduling = false;
      });
  },
});
