function clampText(value, maxLength) {
  const max = Number(maxLength) || 25;
  const chars = Array.from(value || "");
  if (chars.length <= max) return value || "";
  return chars.slice(0, max).join("");
}

function textLength(value) {
  return Array.from(value || "").length;
}

Component({
  properties: {
    question: { type: String, value: "" },
    options: { type: Array, value: [] },
    selected: { type: Array, value: [] },
    field: { type: String, value: "" },
    accent: { type: String, value: "#C0713B" },
    selectedBg: {
      type: String,
      value: "linear-gradient(135deg, rgba(253,247,240,0.60) 0%, rgba(245,232,216,0.60) 100%)",
    },
    exclusiveId: { type: String, value: "nothing" },
    hasExpand: { type: Boolean, value: false },
    expandRows: { type: Array, value: [] },
    expandValues: {
      type: Object,
      value: { experience: "", feeling: "", decision: "" },
    },
    speechRecordingKey: { type: String, value: "" },
    speechMicMap: { type: Object, value: {} },
    inputDisabledMap: { type: Object, value: {} },
  },

  data: {
    lengthMap: {},
    selectedMap: {},
    expandMetaMap: {},
  },

  observers: {
    selected(sel) {
      this._syncSelectedMap(sel);
    },
    expandValues(v) {
      this._syncLengths(v);
    },
    expandRows(rows) {
      this._syncExpandMetaMap(rows);
    },
  },

  lifetimes: {
    attached() {
      this._syncSelectedMap(this.properties.selected);
      this._syncExpandMetaMap(this.properties.expandRows);
      this._syncLengths(this.properties.expandValues);
    },
  },

  methods: {
    _syncExpandMetaMap(rows) {
      const map = {};
      (rows || []).forEach((row) => {
        if (!row || !row.optionId) return;
        const max = Number(row.maxLength) || 25;
        map[row.optionId] = Object.assign({}, row, { inputMaxLength: max + 50 });
      });
      this.setData({ expandMetaMap: map });
    },

    _syncSelectedMap(selected) {
      const map = {};
      (selected || []).forEach((id) => {
        if (id) map[id] = true;
      });
      this.setData({ selectedMap: map });
    },

    _syncLengths(values) {
      const rows = this.properties.expandRows || [];
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

    _getExpandRow(subKey) {
      return (this.properties.expandRows || []).find((r) => r && r.key === subKey) || null;
    },

    onToggle(e) {
      const id = e.currentTarget.dataset.id;
      if (!id) return;
      const exclusiveId = this.properties.exclusiveId || "nothing";
      const prev = (this.properties.selected || []).slice();
      let next;

      if (id === exclusiveId) {
        next = prev.indexOf(exclusiveId) >= 0 ? [] : [exclusiveId];
      } else {
        next = prev.filter((x) => x !== exclusiveId);
        const idx = next.indexOf(id);
        if (idx >= 0) {
          next.splice(idx, 1);
        } else {
          next.push(id);
        }
      }

      this.triggerEvent("change", {
        field: this.properties.field,
        selected: next,
      });
    },

    onExpandInput(e) {
      const subKey = e.currentTarget.dataset.key;
      if (!subKey) return;
      const row = this._getExpandRow(subKey);
      const max = (row && row.maxLength) || 25;
      const text = clampText(e.detail.value, max);
      const next = Object.assign({}, this.properties.expandValues || {}, { [subKey]: text });
      this._syncLengths(next);
      this.triggerEvent("expandchange", {
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
