const OPTIONS = [
  { key: "自己", desc: "照顾身体、日常事务、自己的事" },
  { key: "至亲", desc: "家人、长辈、孩子、伴侣" },
  { key: "外缘", desc: "老板、同事、客户、社会事务" },
  { key: "不二", desc: "自他不二，同时为自己也为别人" },
];

const { parsePayload } = require("../../utils/parsePayload");

Page({
  data: {
    options: OPTIONS,
    selected: "",
    payload: {},
  },

  onLoad(options) {
    const payload = parsePayload(options.payload);
    this.setData({
      payload,
      selected: payload.forWhom || "",
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
      JSON.stringify({ ...payload, forWhom: selected }),
    );
    wx.navigateTo({
      url: `/pages/task-why/index?payload=${nextPayload}`,
    });
  },
});
