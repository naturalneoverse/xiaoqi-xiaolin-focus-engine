function parsePayload(payload) {
  try {
    return payload ? JSON.parse(decodeURIComponent(payload)) : {};
  } catch (e) {
    return {};
  }
}

Page({
  data: {
    sleepText: "未记录",
    sportText: "未记录",
    signalText: "未记录",
  },

  onLoad(options) {
    const payload = parsePayload(options.payload);
    this.setData({
      sleepText: payload.sleep || "未记录",
      sportText: payload.sport || "未记录",
      signalText: payload.signal || "未记录",
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

  backHome() {
    wx.switchTab({
      url: "/pages/index/index",
    });
  },
});
