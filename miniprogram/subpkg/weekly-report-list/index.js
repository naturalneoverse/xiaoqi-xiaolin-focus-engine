const STORAGE_KEYS = require("../../config/storageKeys");
const { requireLoginOnLoad } = require("../../utils/requireLogin");
const { applyReflectionNavBar } = require("../../config/reflectionTheme");
const { buildPastWeeklyReportRows } = require("../../utils/reportHistoryLists");

Page({
  data: {
    rows: [],
    empty: true,
  },

  onLoad() {
    if (!requireLoginOnLoad()) return;
  },

  onShow() {
    applyReflectionNavBar();
    this._load();
  },

  _load() {
    let tasks = [];
    try {
      const raw = wx.getStorageSync(STORAGE_KEYS.TASKS_DATA);
      tasks = Array.isArray(raw) ? raw : [];
    } catch (e) {
      console.error("[weekly-report-list] getStorageSync", e);
      tasks = [];
    }
    const rows = buildPastWeeklyReportRows(tasks);
    this.setData({ rows, empty: rows.length === 0 });
  },

  onTapRow(e) {
    const weekStart = e.currentTarget.dataset.weekStart;
    if (!weekStart) return;
    wx.navigateTo({
      url: `/subpkg/weekly-report/index?weekStart=${encodeURIComponent(weekStart)}`,
    });
  },
});
