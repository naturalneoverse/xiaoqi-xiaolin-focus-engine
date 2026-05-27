const { requireLoginOnLoad } = require("../../utils/requireLogin");
const { applyReflectionNavBar } = require("../../config/reflectionTheme");
const { buildGroupedReflectionList } = require("../../utils/reflectionListGroups");
const reflectionManager = require("../../utils/reflectionManager");

Page({
  data: {
    sections: [],
    empty: true,
    suppressTapOnce: false,
  },

  onLoad() {
    if (!requireLoginOnLoad()) return;
  },

  onShow() {
    applyReflectionNavBar();
    this._loadList();
  },

  _loadList() {
    const { sections, empty } = buildGroupedReflectionList(new Date());
    this.setData({ sections, empty });
  },

  onTapRecord(e) {
    if (this.data.suppressTapOnce) {
      this.setData({ suppressTapOnce: false });
      return;
    }
    const taskId = e.currentTarget.dataset.taskId;
    const taskTitle = e.currentTarget.dataset.taskTitle || "";
    if (!taskId) return;
    wx.navigateTo({
      url: `/subpkg/reflection-report/index?taskId=${encodeURIComponent(taskId)}&taskTitle=${encodeURIComponent(taskTitle)}`,
    });
  },

  onRecordLongPress(e) {
    const taskId = e.currentTarget.dataset.taskId;
    const taskTitle = (e.currentTarget.dataset.taskTitle || "").trim() || "未命名任务";
    if (!taskId) return;
    this.setData({ suppressTapOnce: true });
    wx.showModal({
      title: "删除哲思复盘",
      content: `确认删除「${taskTitle}」的复盘记录？删除后无法恢复，与是否保留该任务无关。`,
      confirmText: "删除",
      confirmColor: "#12598f",
      success: (res) => {
        if (!res.confirm) return;
        const ok = reflectionManager.purgeRecordByTaskId(taskId);
        if (!ok) {
          wx.showToast({ title: "未找到该记录", icon: "none" });
          return;
        }
        this._loadList();
        wx.showToast({ title: "已删除", icon: "success", duration: 1200 });
      },
    });
  },
});
