function clampText(value, maxLength) {
  const max = Number(maxLength) || 50;
  const chars = Array.from(value || "");
  if (chars.length <= max) return value || "";
  return chars.slice(0, max).join("");
}

function textLength(value) {
  return Array.from(value || "").length;
}

Component({
  properties: {
    title: { type: String, value: "极简复盘" },
    values: {
      type: Object,
      value: { keep: "", improve: "", start: "", stop: "" },
    },
    rows: { type: Array, value: [] },
    maxLength: { type: Number, value: 50 },
    field: { type: String, value: "kiss" },
    accent: { type: String, value: "#C0713B" },
    speechRecordingKey: { type: String, value: "" },
    speechMicMap: { type: Object, value: {} },
    inputDisabledMap: { type: Object, value: {} },
  },

  data: {
    lengthMap: {},
    inputMaxLength: 80,
  },

  observers: {
    values(v) {
      this._syncLengths(v);
    },
    maxLength(max) {
      const safe = Number(max) || 50;
      this.setData({ inputMaxLength: safe + 50 });
    },
  },

  lifetimes: {
    attached() {
      const max = Number(this.properties.maxLength) || 50;
      this.setData({ inputMaxLength: max + 50 });
      this._syncLengths(this.properties.values);
    },
  },

  methods: {
    _syncLengths(values) {
      const rows = this.properties.rows || [];
      const lengthMap = {};
      rows.forEach((row) => {
        if (!row || !row.key) return;
        lengthMap[row.key] = textLength((values && values[row.key]) || "");
      });
      this.setData({ lengthMap });
    },

    _speechKey(subKey) {
      return `${this.properties.field}_${subKey}`;
    },

    onInput(e) {
      const subKey = e.currentTarget.dataset.key;
      if (!subKey) return;
      const max = Number(this.properties.maxLength) || 50;
      const text = clampText(e.detail.value, max);
      const next = Object.assign({}, this.properties.values || {}, { [subKey]: text });
      this._syncLengths(next);
      this.triggerEvent("change", {
        field: this.properties.field,
        values: next,
      });
    },

    onSpeechLongPress(e) {
      const subKey = e.currentTarget.dataset.key;
      if (!subKey) return;
      this.triggerEvent("speechlongpress", {
        field: this.properties.field,
        subKey,
        speechKey: this._speechKey(subKey),
      });
    },

    onSpeechTouchEnd(e) {
      const subKey = e.currentTarget.dataset.key;
      this.triggerEvent("speechtouchend", {
        field: this.properties.field,
        subKey,
        speechKey: subKey ? this._speechKey(subKey) : "",
      });
    },
  },
});
