const OPTIONS = [
  { key: "没事", desc: "身体好好的，吃睡都香" },
  { key: "有劲", desc: "浑身是劲，想蹦跶" },
  { key: "累了", desc: "就是累，歇不过来那种" },
  { key: "疼了", desc: "哪儿疼，身体在喊你" },
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
    showMascotModal: false,
    nextPayload: "",
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

  save() {
    if (!this.data.selected) {
      wx.showToast({ title: "请选择一项", icon: "none" });
      return;
    }
    const payload = encodeURIComponent(
      JSON.stringify({
        ...this.data.payload,
        signal: this.data.selected,
      }),
    );
    this.setData({
      nextPayload: payload,
      showMascotModal: true,
    });
  },

  confirmMascot() {
    const { nextPayload } = this.data;
    if (!nextPayload) return;
    this.setData({
      showMascotModal: false,
    });
    wx.redirectTo({
      url: `/pages/today-report/index?payload=${nextPayload}`,
    });
  },
});
