const SETTINGS_KEY = "app_settings";

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
    try {
      const saved = wx.getStorageSync(SETTINGS_KEY) || {};
      this.setData({
        notifyOn: typeof saved.notifyOn === "boolean" ? saved.notifyOn : true,
      });
    } catch (e) {}
  },

  saveSettings(nextPatch = {}) {
    const next = {
      notifyOn: this.data.notifyOn,
      ...nextPatch,
    };
    wx.setStorageSync(SETTINGS_KEY, next);
  },

  onNotifyChange(e) {
    const notifyOn = !!e.detail.value;
    this.setData({ notifyOn });
    this.saveSettings({ notifyOn });
  },

  goPrivacy() {
    wx.navigateTo({
      url: "/pages/privacy/index",
    });
  },

  onClearCache() {
    wx.showModal({
      title: "清除缓存",
      content: "确认清除本地缓存数据吗？",
      confirmColor: "#12598f",
      success: (res) => {
        if (!res.confirm) return;
        wx.clearStorageSync();
        wx.showToast({
          title: "缓存已清除",
          icon: "success",
        });
      },
    });
  },

  goBack() {
    wx.navigateBack();
  },
});
