const dailyCheckIn = require("../../utils/dailyCheckIn");
const { clampSignature } = require("../../config/profileTextLimits");
const { requireLoginOnLoad } = require("../../utils/requireLogin");

Page({
  data: {
    value: "",
  },

  onLoad() {
    if (!requireLoginOnLoad()) return;
    const app = getApp();
    const p = app && typeof app.getUserProfile === "function" ? app.getUserProfile() : {};
    const s = (p && p.signature) || "";
    this.setData({
      value: s === "我的个性签名" ? "" : s,
    });
  },

  goBack() {
    this.__safeNavigateBack("pages/my/index");
  },

  onInput(e) {
    this.setData({
      value: clampSignature((e.detail && e.detail.value) || ""),
    });
  },

  save() {
    const app = getApp();
    const raw = clampSignature(this.data.value || "").trim();
    const next = raw;
    if (!app || typeof app.setUserProfile !== "function" || !app.setUserProfile({ signature: next })) {
      wx.showToast({ title: "保存失败", icon: "none" });
      return;
    }
    try {
      dailyCheckIn.recordDailyCheckIn();
    } catch (e) {
      /* ignore */
    }
    wx.showToast({ title: "已保存", icon: "success" });
    setTimeout(() => {
      wx.navigateBack({ delta: 1 });
    }, 400);
  },
});
