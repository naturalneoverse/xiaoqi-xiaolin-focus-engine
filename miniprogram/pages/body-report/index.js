const STATUS_ICON_MAP = {
  身心满格: "/images/transparent background/good.png",
  状态平稳: "/images/transparent background/well.png",
  轻微失衡: "/images/transparent background/slow.png",
  需要调整: "/images/transparent background/care.png",
};

Page({
  data: {
    statusTitle: "身心满格",
    statusDesc: "保持专注与放松的平衡，让身体在规律中获得滋养.",
    statusIcon: "/images/transparent background/good.png",
  },

  onLoad() {
    this.syncStatusIcon();
  },

  syncStatusIcon() {
    const { statusTitle } = this.data;
    this.setData({
      statusIcon: STATUS_ICON_MAP[statusTitle] || STATUS_ICON_MAP["身心满格"],
    });
  },

  goBack() {
    wx.switchTab({
      url: "/pages/index/index",
    });
  },

  goHome() {
    wx.switchTab({
      url: "/pages/index/index",
    });
  },
});
