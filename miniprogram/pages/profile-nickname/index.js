const dailyCheckIn = require("../../utils/dailyCheckIn");

Page({
  data: {
    value: "",
  },

  onLoad() {
    const app = getApp();
    const p = app && typeof app.getUserProfile === "function" ? app.getUserProfile() : {};
    const n = (p && p.nickname) || "";
    this.setData({
      value: n === "用户名" ? "" : n,
    });
  },

  goBack() {
    this.__safeNavigateBack("pages/my/index");
  },

  onInput(e) {
    this.setData({
      value: (e.detail && e.detail.value) || "",
    });
  },

  save() {
    const app = getApp();
    const raw = (this.data.value || "").trim();
    const next = raw ? raw.slice(0, 20) : "用户名";
    if (!app || typeof app.setUserProfile !== "function" || !app.setUserProfile({ nickname: next })) {
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
