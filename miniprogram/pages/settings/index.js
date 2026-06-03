const STORAGE_KEYS = require("../../config/storageKeys");
const { requireLoginOnLoad } = require("../../utils/requireLogin");
const {
  executeClearPreset,
  buildClearConfirmContent,
  buildClearFinalConfirmContent,
  CLEAR_PRESET_IDS,
} = require("../../utils/localDataClear");
const CLEAR_OPTIONS = ["清除图片缓存", "清除任务与哲思本地记录"];

Page({
  data: {
    notifyOn: true,
    version: "1.2.0",
  },

  onLoad() {
    if (!requireLoginOnLoad()) return;
    this.loadSettings();
    const app = getApp();
    const v = app && app.globalData && app.globalData.APP_VERSION;
    this.setData({ version: v || "1.2.0" });
  },

  loadSettings() {
    const app = getApp();
    try {
      const globalSettings = (app && app.globalData && app.globalData.settings) || {};
      const savedReminder = wx.getStorageSync(STORAGE_KEYS.REMINDER_ENABLED);
      this.setData({
        notifyOn:
          typeof globalSettings.reminderEnabled === "boolean"
            ? globalSettings.reminderEnabled
            : typeof savedReminder === "boolean"
              ? savedReminder
              : true,
      });
    } catch (e) {}
  },

  saveSettings(nextPatch = {}) {
    const app = getApp();
    const next = { reminderEnabled: this.data.notifyOn, ...nextPatch };
    if (app && typeof app.setSettings === "function") {
      app.setSettings(next);
      return;
    }
    wx.setStorageSync(STORAGE_KEYS.REMINDER_ENABLED, !!next.reminderEnabled);
  },

  onNotifyChange(e) {
    const notifyOn = !!e.detail.value;
    this.setData({ notifyOn });
    this.saveSettings({ reminderEnabled: notifyOn });
  },

  goProfileEditMenu() {
    wx.navigateTo({
      url: "/pages/profile-edit-menu/index",
    });
  },

  goPrivacy() {
    wx.navigateTo({
      url: "/pages/privacy/index",
    });
  },

  onClearCache() {
    wx.showActionSheet({
      itemList: CLEAR_OPTIONS,
      itemColor: "#dc2626",
      success: (res) => {
        if (res.tapIndex === 0) {
          this.confirmClearImageCache();
          return;
        }
        if (res.tapIndex === 1) {
          this.confirmClearAllRecords();
        }
      },
    });
  },

  confirmClearImageCache() {
    wx.showModal({
      title: "清除图片缓存",
      content: buildClearConfirmContent(CLEAR_PRESET_IDS.IMAGE_CACHE),
      confirmColor: "#dc2626",
      success: (res) => {
        if (!res.confirm) return;
        const result = executeClearPreset(CLEAR_PRESET_IDS.IMAGE_CACHE);
        if (!result.ok) {
          wx.showModal({
            title: "清除失败",
            content: "图片缓存清除失败，请稍后重试",
            showCancel: false,
          });
          return;
        }
        wx.showToast({
          title: "图片缓存已清除",
          icon: "success",
        });
      },
    });
  },

  confirmClearAllRecords() {
    wx.showModal({
      title: "清除任务与哲思记录",
      content: buildClearConfirmContent(CLEAR_PRESET_IDS.TASKS_REFLECTION),
      cancelText: "取消",
      confirmText: "继续清空",
      confirmColor: "#dc2626",
      success: (res) => {
        if (!res.confirm) return;
        wx.showModal({
          title: "最终确认",
          content: buildClearFinalConfirmContent(CLEAR_PRESET_IDS.TASKS_REFLECTION),
          cancelText: "再想想",
          confirmText: "确认清空",
          confirmColor: "#dc2626",
          success: (res2) => {
            if (!res2.confirm) return;
            this._executeClearAllTasks();
          },
        });
      },
    });
  },

  _executeClearAllTasks() {
    const result = executeClearPreset(CLEAR_PRESET_IDS.TASKS_REFLECTION);
    if (!result.ok) {
      wx.showModal({
        title: "清除失败",
        content: "任务与哲思记录清空失败，请稍后重试",
        showCancel: false,
      });
      return;
    }
    wx.showToast({
      title: "任务已清空",
      icon: "success",
    });
  },

  onTapVersion() {
    wx.showToast({
      title: "即将上线",
      icon: "none",
    });
  },

  /** 退出：清会话 token，保留资料/问卷/业务数据与 pending_referrer（再登录可补分享归因） */
  onLogout() {
    const authSession = require("../../utils/authSession");
    if (authSession && typeof authSession.logout === "function") {
      authSession.logout();
    }
    wx.reLaunch({
      url: "/pages/login/index",
    });
  },

  goBack() {
    this.__safeNavigateBack("pages/my/index");
  },
});
