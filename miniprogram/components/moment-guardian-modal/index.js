Component({
  properties: {
    visible: { type: Boolean, value: false },
    message: { type: String, value: "" },
  },

  methods: {
    noop() {},

    onSettle() {
      this.triggerEvent("settle");
    },

    onProceed() {
      this.triggerEvent("proceed");
    },
  },
});
