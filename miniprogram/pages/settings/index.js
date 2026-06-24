const STORAGE_KEYS = require("../../config/storageKeys");
const { requireLoginOnLoad } = require("../../utils/requireLogin");
const {
  executeClearPreset,
  buildClearConfirmContent,
  CLEAR_PRESET_IDS,
} = require("../../utils/localDataClear");

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
    wx.showModal({
      title: "清除缓存",
      content: buildClearConfirmContent(CLEAR_PRESET_IDS.APP_CACHE),
      cancelText: "取消",
      confirmText: "清除",
      confirmColor: "#dc2626",
      success: (res) => {
        if (!res.confirm) return;
        const result = executeClearPreset(CLEAR_PRESET_IDS.APP_CACHE);
        if (!result.ok) {
          wx.showModal({
            title: "清除失败",
            content: "缓存清除失败，请稍后重试",
            showCancel: false,
          });
          return;
        }
        wx.showToast({
          title: "缓存已清除",
          icon: "success",
        });
      },
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
