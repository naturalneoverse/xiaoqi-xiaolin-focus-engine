const STORAGE_KEYS = require("../../config/storageKeys");
const PROFILE_EDIT_OPTIONS = ["头像", "昵称", "个性签名"];
const CLEAR_OPTIONS = ["清除图片缓存", "清除全部记录"];

function getVersion() {
  try {
    const info = wx.getAccountInfoSync ? wx.getAccountInfoSync() : null;
    const mini = info && info.miniProgram;
    return (mini && (mini.version || mini.envVersion)) || "1.0.0";
  } catch (e) {
    return "1.0.0";
  }
}

Page({
  data: {
    notifyOn: true,
    version: "1.0.0",
  },

  onLoad() {
    this.loadSettings();
    this.setData({
      version: getVersion(),
    });
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

  goEditProfile() {
    wx.showActionSheet({
      itemList: PROFILE_EDIT_OPTIONS,
      success: (res) => {
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.pendingProfileEditField = PROFILE_EDIT_OPTIONS[res.tapIndex] || "";
        }
        wx.switchTab({
          url: "/pages/my/index",
        });
      },
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
      title: "清除全部记录",
      content: "确定清除全部任务和身体记录吗？此操作不可恢复。",
      confirmColor: "#dc2626",
      success: (res) => {
        if (!res.confirm) return;
        try {
          wx.removeStorageSync(STORAGE_KEYS.TASKS_DATA);
          wx.removeStorageSync(STORAGE_KEYS.BODY_RECORDS);
          wx.showToast({
            title: "记录已清除",
            icon: "success",
          });
        } catch (e) {
          wx.showModal({
            title: "清除失败",
            content: "记录清除失败，请稍后重试",
            showCancel: false,
          });
        }
      },
    });
  },

  onTapVersion() {
    wx.showToast({
      title: "即将上线",
      icon: "none",
    });
  },

  goBack() {
    this.__safeNavigateBack("/pages/my/index");
  },
});
