Page({
  goBack() {
    wx.switchTab({
      url: "/pages/sleep/index",
    });
  },

  goHome() {
    wx.switchTab({
      url: "/pages/sleep/index",
    });
  },

  goPoster() {
    wx.navigateTo({
      url: "/pages/poster/index",
    });
  },

  onShareToFriend() {
    wx.showToast({
      title: "请使用微信分享",
      icon: "none",
      duration: 1400,
    });
  },
});
