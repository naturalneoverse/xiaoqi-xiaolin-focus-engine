Page({
  goBack() {
    this.closeToMy();
  },

  goHome() {
    this.closeToMy();
  },

  closeToMy() {
    const pages = getCurrentPages();
    const targetRoute = "pages/my/index";
    const targetIndex = pages.findIndex((page) => page.route === targetRoute);

    if (targetIndex >= 0) {
      const delta = pages.length - targetIndex - 1;
      if (delta > 0) {
        wx.navigateBack({ delta });
        return;
      }
    }

    wx.switchTab({
      url: "/pages/my/index",
    });
  },
});
