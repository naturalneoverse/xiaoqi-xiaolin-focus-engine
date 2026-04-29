const OPTIONS = [
  { key: "动够了", desc: "一周好几次，出汗了" },
  { key: "动了点", desc: "散散步、拉拉筋，没闲着" },
  { key: "没咋动", desc: "光坐着了，屁股快生根" },
  { key: "动过头了", desc: "累散架了，缓不过来" },
];

function parsePayload(payload) {
  try {
    return payload ? JSON.parse(decodeURIComponent(payload)) : {};
  } catch (e) {
    return {};
  }
}

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
      JSON.stringify({
        ...this.data.payload,
        sport: this.data.selected,
      }),
    );
    wx.navigateTo({
      url: `/pages/body/index?payload=${payload}`,
    });
  },
});
