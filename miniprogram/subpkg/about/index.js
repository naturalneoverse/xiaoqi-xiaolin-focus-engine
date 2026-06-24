const { requireLoginOnLoad } = require("../../utils/requireLogin");

Page({
  data: {
    appVersion: "1.4.2",
    copyrightYear: "2026",
  },

  onLoad() {
    if (!requireLoginOnLoad()) return;
    const app = getApp();
    const v = app && app.globalData && app.globalData.APP_VERSION;
    if (v) {
      this.setData({ appVersion: v });
    }
  },

  goBrandIntro() {
    const { openBrandIntro } = require("../../utils/brandIntroNavigate");
    openBrandIntro({ from: "about" });
  },
});
