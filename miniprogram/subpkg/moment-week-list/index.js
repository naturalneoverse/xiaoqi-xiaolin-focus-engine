const STORAGE_KEYS = require("../../config/storageKeys");
const { applyReflectionNavBar } = require("../../config/reflectionTheme");
const { buildMomentTrailView, MOMENT_TRAIL_INTRO_TEXT } = require("../../utils/momentTrailView");

Page({
  data: {
    introText: MOMENT_TRAIL_INTRO_TEXT,
    showIntro: false,
    showInfoSheet: false,
    hasData: false,
    currentWeek: {
      rangeLabel: "",
      displayText: "0",
      unitText: "次",
      footnote: "",
    },
    historyRows: [],
  },

  onLoad() {
  },

  onShow() {
    applyReflectionNavBar();
    this._load();
    this._maybeShowIntro();
  },

  _maybeShowIntro() {
    try {
      if (wx.getStorageSync(STORAGE_KEYS.MOMENT_TRAIL_INTRO_SEEN)) return;
    } catch (e) {
      /* ignore */
    }
    this.setData({ showIntro: true });
  },

  _load() {
    let tasks = [];
    try {
      const raw = wx.getStorageSync(STORAGE_KEYS.TASKS_DATA);
      tasks = Array.isArray(raw) ? raw : [];
    } catch (e) {
      console.error("[moment-week-list] getStorageSync", e);
      tasks = [];
    }
    const trail = buildMomentTrailView(tasks);
    this.setData({
      hasData: trail.hasData,
      currentWeek: trail.currentWeek,
      historyRows: trail.historyRows,
    });
  },

  onTapInfo() {
    this.setData({ showInfoSheet: true });
  },

  onCloseInfoSheet() {
    this.setData({ showInfoSheet: false });
  },

  onDismissIntro() {
    try {
      wx.setStorageSync(STORAGE_KEYS.MOMENT_TRAIL_INTRO_SEEN, true);
    } catch (e) {
      /* ignore */
    }
    this.setData({ showIntro: false });
  },

  noop() {},
});
