Page({
  data: {
    appVersion: "1.1.6",
    copyrightYear: "2026",
  },

  onLoad() {
    const app = getApp();
    const v = app && app.globalData && app.globalData.APP_VERSION;
    if (v) {
      this.setData({ appVersion: v });
    }
  },
});
