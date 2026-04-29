const STORAGE_KEYS = require("../../config/storageKeys");
const { buildInstantFeedback } = require("../../config/bodyFeedback");

function parsePayload(payload) {
  try {
    return payload ? JSON.parse(decodeURIComponent(payload)) : {};
  } catch (e) {
    return {};
  }
}

Page({
  data: {
    sleepText: "未记录",
    sportText: "未记录",
    signalText: "未记录",
    adviceText: "",
  },

  onLoad(options) {
    const payload = parsePayload(options.payload);
    this.setData({
      sleepText: payload.sleep || "未记录",
      sportText: payload.sport || "未记录",
      signalText: payload.signal || "未记录",
      adviceText: buildInstantFeedback(payload),
    });
    this.persistTodayBodyRecord(payload);
  },

  persistTodayBodyRecord(payload) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const dateKey = `${y}-${m}-${d}`;
    const record = {
      dateKey,
      sleep: payload.sleep || "未记录",
      sport: payload.sport || "未记录",
      signal: payload.signal || "未记录",
      createdAt: `${dateKey} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
    };
    try {
      const saved = wx.getStorageSync(STORAGE_KEYS.BODY_RECORDS);
      const records = Array.isArray(saved) ? saved : [];
      const filtered = records.filter((item) => item && item.dateKey !== dateKey);
      wx.setStorageSync(STORAGE_KEYS.BODY_RECORDS, [record, ...filtered]);
    } catch (e) {
      console.error("persist body record failed:", e);
    }
  },

  goBack() {
    wx.switchTab({
      url: "/pages/index/index",
    });
  },

  goHome() {
    wx.switchTab({
      url: "/pages/index/index",
    });
  },

  backHome() {
    wx.switchTab({
      url: "/pages/index/index",
    });
  },
});
