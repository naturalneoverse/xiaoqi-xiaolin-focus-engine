const STORAGE_KEYS = require("../../config/storageKeys");
const { buildInstantFeedback } = require("../../config/bodyFeedback");
const dailyCheckIn = require("../../utils/dailyCheckIn");

function parsePayload(payload) {
  try {
    return payload ? JSON.parse(decodeURIComponent(payload)) : {};
  } catch (e) {
    return {};
  }
}

function getTodayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function recordTimeMs(r) {
  if (!r || !r.createdAt) return 0;
  const s = String(r.createdAt).trim().replace(/\//g, "-");
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return 0;
  const t = new Date(+m[1], +m[2] - 1, +m[3], m[4] != null ? +m[4] : 0, m[5] != null ? +m[5] : 0, 0, 0);
  return Number.isNaN(t.getTime()) ? 0 : t.getTime();
}

Page({
  data: {
    todayRecords: [],
    adviceText: "",
  },

  onLoad(options) {
    wx.setNavigationBarTitle({ title: "今日报告" });
    const payload = parsePayload(options.payload);
    this.persistTodayBodyRecord(payload);
    this.refreshTodayList();
  },

  onShow() {
    this.refreshTodayList();
  },

  refreshTodayList() {
    const today = getTodayKey();
    let list = [];
    try {
      const saved = wx.getStorageSync(STORAGE_KEYS.BODY_RECORDS);
      const records = Array.isArray(saved) ? saved : [];
      list = records
        .filter((r) => r && r.dateKey === today)
        .map((r, idx) => ({
          ...r,
          id: r.id || `legacy_${r.dateKey}_${idx}_${recordTimeMs(r)}`,
        }))
        .sort((a, b) => recordTimeMs(a) - recordTimeMs(b));
    } catch (e) {
      console.error("today-report refreshTodayList", e);
      list = [];
    }
    if (!list.length) {
      this.setData({
        todayRecords: [],
        adviceText: "",
      });
      return;
    }
    const last = list[list.length - 1];
    const adviceText =
      last && (last.sleep || last.sport || last.signal)
        ? buildInstantFeedback({
            sleep: last.sleep,
            sport: last.sport,
            signal: last.signal,
            createdAt: last.createdAt,
          })
        : "";
    this.setData({
      todayRecords: list,
      adviceText,
    });
  },

  persistTodayBodyRecord(payload) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const dateKey = `${y}-${m}-${d}`;
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const record = {
      id: `b_${Date.now()}`,
      dateKey,
      sleep: payload.sleep || "未记录",
      sport: payload.sport || "未记录",
      signal: payload.signal || "未记录",
      createdAt: `${dateKey} ${hh}:${mm}`,
    };
    try {
      const saved = wx.getStorageSync(STORAGE_KEYS.BODY_RECORDS);
      const records = Array.isArray(saved) ? saved : [];
      const rest = records.filter((r) => r && r.dateKey !== dateKey);
      wx.setStorageSync(STORAGE_KEYS.BODY_RECORDS, [record, ...rest]);
      dailyCheckIn.recordDailyCheckIn();
    } catch (e) {
      console.error("persist body record failed:", e);
    }
  },

  backHome() {
    wx.switchTab({
      url: "/pages/index/index",
    });
  },
});
