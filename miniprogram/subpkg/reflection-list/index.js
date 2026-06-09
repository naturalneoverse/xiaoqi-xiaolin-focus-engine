const { requireLoginOnLoad } = require("../../utils/requireLogin");
const { applyReflectionNavBar } = require("../../config/reflectionTheme");
const { buildGroupedReflectionList } = require("../../utils/reflectionListGroups");
const reflectionManager = require("../../utils/reflectionManager");

Page({
  data: {
    sections: [],
    empty: true,
    suppressTapOnce: false,
    /** idle | syncing | ready | error */
    syncState: "idle",
    syncBanner: false,
    syncHint: "",
  },

  onLoad() {
    if (!requireLoginOnLoad()) return;
  },

  onShow() {
    applyReflectionNavBar();
    this._applyListFromLocal();
    this._startCloudSync();
  },

  _applyListFromLocal() {
    const { sections, empty } = buildGroupedReflectionList(new Date());
    const hasLocal = !empty;
    this.setData({
      sections,
      empty: hasLocal ? false : this.data.empty,
      syncState: hasLocal ? "ready" : "syncing",
      syncBanner: hasLocal,
      syncHint: hasLocal ? "正在同步云端…" : "正在加载复盘记录…",
    });
  },

  _startCloudSync() {
    if (this._syncRunning) return;
    this._syncRunning = true;
    let sync = Promise.resolve({ ok: false });
    try {
      const reflectionCloudSync = require("../../utils/reflectionCloudSync");
      if (reflectionCloudSync && typeof reflectionCloudSync.syncReflectionReportPage === "function") {
        sync = reflectionCloudSync.syncReflectionReportPage();
      }
    } catch (e) {
      console.warn("[reflection-list] sync", e);
    }
    sync
      .then((r) => {
        const { sections, empty } = buildGroupedReflectionList(new Date());
        const ok = !!(r && (r.ok || !empty));
        let syncHint = "";
        if (r && r.listSource === "reflection_ark_cache") {
          syncHint =
            "列表来自回响缓存；完整作答同步中。请在手机打开本页以补全云端作答。";
        } else if (r && r.failed > 0) {
          syncHint = `部分记录未上传云端（${r.failed} 条），请检查网络后重试。`;
        }
        this.setData({
          sections,
          empty,
          syncState: ok || !empty ? "ready" : "error",
          syncBanner: false,
          syncHint,
        });
      })
      .catch(() => {
        const { sections, empty } = buildGroupedReflectionList(new Date());
        this.setData({
          sections,
          empty,
          syncState: empty ? "error" : "ready",
          syncBanner: false,
          syncHint: "同步失败，请检查网络后重试",
        });
      })
      .finally(() => {
        this._syncRunning = false;
      });
  },

  onRetrySync() {
    this.setData({
      syncState: "syncing",
      syncHint: "正在重新同步…",
      syncBanner: false,
    });
    this._startCloudSync();
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
        this._applyListFromLocal();
        wx.showToast({ title: "已删除", icon: "success", duration: 1200 });
      },
    });
  },
});
