const MASCOT_IMAGES = {
  xiaolin: "/images/transparent background/xiaolin.png",
  xiaoqi: "/images/transparent background/xiaoqi.png",
};

Component({
  properties: {
    visible: { type: Boolean, value: false },
    bubbles: { type: Array, value: [] },
    agent: { type: String, value: "xiaolin" },
    bubbleColor: { type: String, value: "#b7d6ea" },
    accentColor: { type: String, value: "#12598f" },
    mascotAnimPaused: { type: Boolean, value: false },
  },

  data: {
    step: 0,
    currentText: "",
    btnText: "继续",
    mascotImage: MASCOT_IMAGES.xiaolin,
  },

  observers: {
    visible(v) {
      if (v) {
        this.setData({ step: 0 });
        this._renderStep(0);
      } else {
        this.setData({ step: 0, currentText: "", btnText: "继续" });
      }
    },
    agent(a) {
      this._updateMascot(a);
    },
    bubbles() {
      if (this.properties.visible) {
        this._renderStep(this.data.step);
      }
    },
  },

  lifetimes: {
    attached() {
      this._updateMascot(this.properties.agent);
    },
  },

  methods: {
    noop() {},

    _updateMascot(agent) {
      const key = agent === "xiaoqi" ? "xiaoqi" : "xiaolin";
      this.setData({ mascotImage: MASCOT_IMAGES[key] });
    },

    _renderStep(step) {
      const bubbles = this.properties.bubbles || [];
      const text = bubbles[step] || "";
      const isLast = step >= bubbles.length - 1;
      this.setData({
        currentText: text,
        btnText: isLast ? "知道了" : "继续",
      });
    },

    onNext() {
      const bubbles = this.properties.bubbles || [];
      const next = this.data.step + 1;
      if (next >= bubbles.length) {
        this.triggerEvent("complete");
        return;
      }
      this.setData({ step: next });
      this._renderStep(next);
    },
  },
});
