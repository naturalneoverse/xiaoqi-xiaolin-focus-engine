const calendarView = require("../../utils/checkInCalendarView");

Component({
  properties: {
    year: { type: Number, value: 0 },
    month: { type: Number, value: 0 },
    checkedMap: { type: Object, value: {} },
    todayKey: { type: String, value: "" },
  },

  data: {
    weekLabels: calendarView.WEEK_LABELS,
    monthTitle: "",
    cells: [],
  },

  observers: {
    "year, month, checkedMap, todayKey": function onCalendarInputs() {
      this._rebuild();
    },
  },

  lifetimes: {
    attached() {
      this._rebuild();
    },
  },

  methods: {
    _rebuild() {
      const year = Number(this.properties.year);
      const month = Number(this.properties.month);
      if (!year || !month) return;
      const cells = calendarView.buildMonthCells(
        year,
        month,
        this.properties.checkedMap || {},
        this.properties.todayKey || calendarView.todayDateKey(),
      );
      this.setData({
        monthTitle: calendarView.formatMonthTitle(year, month),
        cells,
      });
    },

    onPrevMonth() {
      this.triggerEvent("monthchange", { delta: -1 });
    },

    onNextMonth() {
      this.triggerEvent("monthchange", { delta: 1 });
    },

    onTapDay(e) {
      const dateKey = e.currentTarget.dataset.dateKey;
      const checked = !!e.currentTarget.dataset.checked;
      if (!dateKey || !checked) return;
      this.triggerEvent("daytap", { dateKey });
    },
  },
});
