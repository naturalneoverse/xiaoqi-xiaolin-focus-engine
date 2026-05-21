Component({
  properties: {
    question: { type: String, value: "" },
    options: { type: Array, value: [] },
    selected: { type: String, value: "" },
    field: { type: String, value: "" },
    accent: { type: String, value: "#12598F" },
    selectedBg: {
      type: String,
      value: "linear-gradient(135deg, rgba(239,247,253,0.60) 0%, rgba(214,235,247,0.60) 100%)",
    },
  },

  methods: {
    onSelect(e) {
      const id = e.currentTarget.dataset.id;
      if (!id) return;
      this.triggerEvent("change", {
        field: this.properties.field,
        selected: id,
        label: this._labelFor(id),
      });
    },

    _labelFor(id) {
      const opt = (this.properties.options || []).find((o) => o && o.id === id);
      return opt ? opt.label : "";
    },
  },
});
