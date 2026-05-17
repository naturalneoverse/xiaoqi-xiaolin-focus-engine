const guide = require("../../utils/calendarNotifyGuide");

Component({
  data: {
    visible: false,
    neverChecked: false,
    modalText: guide.CALENDAR_NOTIFY_MODAL_TEXT,
  },
  methods: {
    open() {
      this.setData({ visible: true, neverChecked: false });
    },
    onNeverGroupChange(e) {
      const v = (e.detail && e.detail.value) || [];
      this.setData({ neverChecked: v.indexOf("on") >= 0 });
    },
    onKnow() {
      guide.markThirdGuideClosed({ neverAgain: this.data.neverChecked });
      this.setData({ visible: false });
      guide.releaseCalendarGuideUiBusy();
    },
    noop() {},
  },
});
