const { requireLoginOnLoad } = require("../../utils/requireLogin");
const calendarView = require("../../utils/checkInCalendarView");
const dailyCheckIn = require("../../utils/dailyCheckIn");

Page({
  data: {
    totalDays: 0,
    monthDays: 0,
    viewYear: 0,
    viewMonth: 0,
    checkedMap: {},
    todayKey: "",
  },

  onLoad() {
    if (!requireLoginOnLoad()) return;
    const now = new Date();
    this._viewYear = now.getFullYear();
    this._viewMonth = now.getMonth() + 1;
    this._touchStartX = 0;
  },

  onShow() {
    dailyCheckIn.repairCheckInsFromActivity(true);
    this._refresh();
  },

  _refresh() {
    const state = calendarView.loadCheckInCalendarState(this._viewYear, this._viewMonth);
    this._viewYear = state.viewYear;
    this._viewMonth = state.viewMonth;
    this.setData({
      totalDays: state.totalDays,
      monthDays: state.monthDays,
      viewYear: state.viewYear,
      viewMonth: state.viewMonth,
      checkedMap: state.checkedMap,
      todayKey: state.todayKey,
    });
  },

  onMonthChange(e) {
    const delta = e.detail && Number(e.detail.delta);
    if (!delta) return;
    const next = calendarView.shiftMonth(this._viewYear, this._viewMonth, delta);
    this._viewYear = next.year;
    this._viewMonth = next.month;
    this._refresh();
  },

  onDayTap(e) {
    const dateKey = e.detail && e.detail.dateKey;
    if (!dateKey) return;
    wx.showToast({
      title: "该日已打卡",
      icon: "none",
      duration: 1600,
    });
  },

  onTouchStart(e) {
    const t = e.changedTouches && e.changedTouches[0];
    if (!t) return;
    this._touchStartX = t.clientX;
  },

  onTouchEnd(e) {
    const t = e.changedTouches && e.changedTouches[0];
    if (!t || this._touchStartX == null) return;
    const dx = t.clientX - this._touchStartX;
    this._touchStartX = null;
    if (Math.abs(dx) < 56) return;
    const delta = dx < 0 ? 1 : -1;
    const next = calendarView.shiftMonth(this._viewYear, this._viewMonth, delta);
    this._viewYear = next.year;
    this._viewMonth = next.month;
    this._refresh();
  },
});
