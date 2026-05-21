const STORAGE_KEYS = require("../../config/storageKeys");
const { requireLoginOnLoad } = require("../../utils/requireLogin");
const CLEAR_OPTIONS = ["清除图片缓存", "清除全部记录"];

Page({
  data: {
    notifyOn: true,
    version: "1.1.6",
  },

  onLoad() {
    if (!requireLoginOnLoad()) return;
    this.loadSettings();
    const app = getApp();
    const v = app && app.globalData && app.globalData.APP_VERSION;
    this.setData({ version: v || "1.1.6" });
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
      content: "确定清除图片缓存吗？",
      confirmColor: "#dc2626",
      success: (res) => {
        if (!res.confirm) return;
        try {
          wx.removeStorageSync(STORAGE_KEYS.CACHE_IMAGES);
          const storageInfo = wx.getStorageInfoSync ? wx.getStorageInfoSync() : null;
          const keys = (storageInfo && storageInfo.keys) || [];
          keys.forEach((key) => {
            if (/^(temp_image_|image_temp_|draft_image_)/.test(key)) {
              wx.removeStorageSync(key);
            }
          });
          wx.showToast({
            title: "图片缓存已清除",
            icon: "success",
          });
        } catch (e) {
          wx.showModal({
            title: "清除失败",
            content: "图片缓存清除失败，请稍后重试",
            showCancel: false,
          });
        }
      },
    });
  },

  confirmClearAllRecords() {
    wx.showModal({
      title: "清空提醒",
      content: "即将清空所有任务数据，数据删除后不可找回，是否继续？",
      cancelText: "取消",
      confirmText: "继续清空",
      confirmColor: "#dc2626",
      success: (res) => {
        if (!res.confirm) return;
        wx.showModal({
          title: "最终确认",
          content: "此操作不可逆，所有任务记录将彻底删除，确定执行清空吗？",
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
    try {
      wx.removeStorageSync(STORAGE_KEYS.TASKS_DATA);
      wx.removeStorageSync(STORAGE_KEYS.REFLECTION_RECORDS);
      wx.showToast({
        title: "任务已清空",
        icon: "success",
      });
    } catch (e) {
      wx.showModal({
        title: "清除失败",
        content: "任务清空失败，请稍后重试",
        showCancel: false,
      });
    }
  },

  onTapVersion() {
    wx.showToast({
      title: "即将上线",
      icon: "none",
    });
  },

  /** 仅跳转登录页，不清理 token / 缓存 / 用户资料（与产品约定一致） */
  onLogout() {
    wx.reLaunch({
      url: "/pages/login/index",
    });
  },

  goBack() {
    this.__safeNavigateBack("pages/my/index");
  },
});
