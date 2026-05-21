const STORAGE_KEYS = require("../../config/storageKeys");
const { requireLoginOnLoad } = require("../../utils/requireLogin");
const { applyReflectionNavBar } = require("../../config/reflectionTheme");
const { buildPastBodyReportRows } = require("../../utils/reportHistoryLists");

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
    let records = [];
    try {
      const raw = wx.getStorageSync(STORAGE_KEYS.BODY_RECORDS);
      records = Array.isArray(raw) ? raw : [];
    } catch (e) {
      console.error("[body-report-list] getStorageSync", e);
      records = [];
    }
    const rows = buildPastBodyReportRows(records);
    this.setData({ rows, empty: rows.length === 0 });
  },

  onTapRow(e) {
    const weekStart = e.currentTarget.dataset.weekStart;
    if (!weekStart) return;
    wx.navigateTo({
      url: `/subpkg/body-report/index?weekStart=${encodeURIComponent(weekStart)}`,
    });
  },
});
