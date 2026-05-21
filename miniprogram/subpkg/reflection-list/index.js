const { requireLoginOnLoad } = require("../../utils/requireLogin");
const { applyReflectionNavBar } = require("../../config/reflectionTheme");
const { buildListItems } = require("../../utils/reflectionReport");

Page({
  data: {
    records: [],
    empty: true,
  },

  onLoad() {
    if (!requireLoginOnLoad()) return;
  },

  onShow() {
    applyReflectionNavBar();
    this._loadList();
  },

  _loadList() {
    const records = buildListItems();
    this.setData({
      records,
      empty: records.length === 0,
    });
  },

  onTapRecord(e) {
    const taskId = e.currentTarget.dataset.taskId;
    const taskTitle = e.currentTarget.dataset.taskTitle || "";
    if (!taskId) return;
    wx.navigateTo({
      url: `/subpkg/reflection-report/index?taskId=${encodeURIComponent(taskId)}&taskTitle=${encodeURIComponent(taskTitle)}`,
    });
  },
});
