function clampText(value, maxLength) {
  const max = Number(maxLength) || 300;
  const chars = Array.from(value || "");
  if (chars.length <= max) return value || "";
  return chars.slice(0, max).join("");
}

function textLength(value) {
  return Array.from(value || "").length;
}

Component({
  properties: {
    question: {
      type: String,
      value: "",
    },
    placeholder: {
      type: String,
      value: "",
    },
    value: {
      type: String,
      value: "",
    },
    maxLength: {
      type: Number,
      value: 300,
    },
    field: {
      type: String,
      value: "",
    },
    disabled: {
      type: Boolean,
      value: false,
    },
    speechRecording: {
      type: Boolean,
      value: false,
    },
    speechMicDisabled: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    displayLength: 0,
    inputMaxLength: 350,
  },

  observers: {
    value(v) {
      this.setData({ displayLength: textLength(v) });
    },
    maxLength(max) {
      const safe = Number(max) || 300;
      this.setData({ inputMaxLength: safe + 50 });
    },
  },

  lifetimes: {
    attached() {
      const max = Number(this.properties.maxLength) || 300;
      this.setData({
        displayLength: textLength(this.properties.value),
        inputMaxLength: max + 50,
      });
    },
  },

  methods: {
    onInput(e) {
      const max = Number(this.properties.maxLength) || 300;
      const text = clampText(e.detail.value, max);
      const length = textLength(text);
      this.setData({ displayLength: length });
      this.triggerEvent("change", {
        field: this.properties.field,
        value: text,
        length,
      });
    },

    onSpeechLongPress() {
      this.triggerEvent("speechlongpress", { field: this.properties.field });
    },

    onSpeechTouchEnd() {
      this.triggerEvent("speechtouchend", { field: this.properties.field });
    },
  },
});
