const OPTIONS = [
  { key: "重要且紧急", desc: "必须马上做，不做会出事" },
  { key: "重要不紧急", desc: "真正重要的事，可以慢慢做" },
  { key: "紧急不重要", desc: "别人催得紧，对你没那么重要" },
  { key: "不重要不紧急", desc: "这件事，真的需要做吗？" },
];

const { parsePayload } = require("../../utils/parsePayload");

Page({
  data: {
    options: OPTIONS,
    selected: "",
    payload: {},
  },

  onLoad(options) {
    this.setData({
      payload: parsePayload(options.payload),
    });
  },

  chooseOption(e) {
    this.setData({
      selected: e.currentTarget.dataset.key,
    });
  },

  goPrev() {
    this.__safeNavigateBack("/pages/sleep/index");
  },

  goNext() {
    const { selected, payload } = this.data;
    if (!selected) {
      wx.showToast({ title: "请选择一项", icon: "none" });
      return;
    }
    const nextPayload = encodeURIComponent(
      JSON.stringify({ ...payload, priority: selected }),
    );
    wx.navigateTo({
      url: `/pages/task-for-whom/index?payload=${nextPayload}`,
    });
  },
});
