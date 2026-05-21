const { CIRCLE_OPTIONS } = require("../../config/taskQuizChoices");
const { parsePayload } = require("../../utils/parsePayload");
const { requireLoginOnLoad } = require("../../utils/requireLogin");

const OPTIONS = CIRCLE_OPTIONS.map((o) => ({ key: o.title, desc: o.desc, id: o.id }));

Page({
  data: {
    options: OPTIONS,
    selected: "",
    payload: {},
  },

  onLoad(options) {
    if (!requireLoginOnLoad()) return;
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
    const row = OPTIONS.find((o) => o.key === selected);
    const nextPayload = encodeURIComponent(
      JSON.stringify({
        ...payload,
        forWhom: selected,
        quizSelections: {
          ...(payload.quizSelections || {}),
          circle: row ? row.id : 0,
        },
      }),
    );
    wx.navigateTo({
      url: `/pages/task-why/index?payload=${nextPayload}`,
    });
  },
});
