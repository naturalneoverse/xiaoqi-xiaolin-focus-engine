const STORAGE_KEYS = require("../../config/storageKeys");
const dailyCheckIn = require("../../utils/dailyCheckIn");
const mascotEngineClient = require("../../utils/mascotEngineClient");
const { raceResolve, MASCOT_ENGINE_TIMEOUT_MS } = require("../../utils/raceResolve");
const { goMindHome } = require("../../utils/goTabHome");
const { getTodayKey } = require("../../utils/dateKeys");
const { parsePayload } = require("../../utils/parsePayload");
const { requireLoginOnLoad } = require("../../utils/requireLogin");

const NO_RECORD_ADVICE_FALLBACK = "今天还没和身体打招呼。有空时，给身体留个空白也好。";

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
    adviceLoading: true,
  },

  onLoad(options) {
    if (!requireLoginOnLoad()) return;
    wx.setNavigationBarTitle({ title: "今日报告" });
    const payload = parsePayload(options.payload);
    this.persistTodayBodyRecord(payload);
    this.refreshTodayList();
  },

  onShow() {
    this.refreshTodayList();
  },

  _resolveAdviceText(record) {
    const fallback = record
      ? mascotEngineClient.getBodyDailyMascotLine(record)
      : NO_RECORD_ADVICE_FALLBACK;
    this.setData({ adviceLoading: true, adviceText: "" });
    return raceResolve(mascotEngineClient.fetchMascotEngineBodyDaily(record), MASCOT_ENGINE_TIMEOUT_MS)
      .then((cloudText) => {
        const adviceText = cloudText || fallback;
        this.setData({ adviceText, adviceLoading: false });
      })
      .catch((e) => {
        console.error("today-report body_daily", e);
        this.setData({ adviceText: fallback, adviceLoading: false });
      });
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
    this.setData({ todayRecords: list });
    if (!list.length) {
      this._resolveAdviceText(null);
      return;
    }
    const last = list[list.length - 1];
    this._resolveAdviceText(last);
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
      updatedAt: Date.now(),
    };
    try {
      const saved = wx.getStorageSync(STORAGE_KEYS.BODY_RECORDS);
      const records = Array.isArray(saved) ? saved : [];
      const rest = records.filter((r) => r && r.dateKey !== dateKey);
      wx.setStorageSync(STORAGE_KEYS.BODY_RECORDS, [record, ...rest]);
      dailyCheckIn.recordDailyCheckIn();
    } catch (e) {
      console.error("persist body record failed:", e);
      return;
    }
    try {
      const cloudDataSync = require("../../utils/cloudDataSync");
      cloudDataSync.afterBodySaved(record);
    } catch (err) {
      console.warn("[today-report] cloudDataSync", err);
    }
  },

  backHome() {
    goMindHome();
  },
});
