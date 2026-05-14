const OPTIONS = [
  { key: "睡得香", desc: "倒头就着，醒来精神" },
  { key: "做梦了", desc: "整晚做梦，跟演电影似的" },
  { key: "睡不实", desc: "老醒，或者醒了就睡不着" },
  { key: "睡不着", desc: "躺那半天，脑子停不下来" },
];

const { requireLoginOnLoad } = require("../../utils/requireLogin");

Page({
  data: {
    options: OPTIONS,
    selected: "",
  },

  onLoad() {
    if (!requireLoginOnLoad()) return;
  },

  choose(e) {
    this.setData({
      selected: e.currentTarget.dataset.key,
    });
  },

  next() {
    if (!this.data.selected) {
      wx.showToast({ title: "请选择一项", icon: "none" });
      return;
    }
    const payload = encodeURIComponent(
      JSON.stringify({ sleep: this.data.selected }),
    );
    wx.navigateTo({
      url: `/pages/body-sport/index?payload=${payload}`,
    });
  },
});
