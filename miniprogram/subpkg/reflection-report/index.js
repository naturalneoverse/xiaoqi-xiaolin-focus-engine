const { requireLoginOnLoad } = require("../../utils/requireLogin");
const { applyReflectionNavBar } = require("../../config/reflectionTheme");
const { buildReportViewModel } = require("../../utils/reflectionReport");
const { safeDecodeURIComponent } = require("../../utils/safeDecodeURIComponent");
const reflectionManager = require("../../utils/reflectionManager");
const { computeQuadrantScores } = require("../../utils/reflectionScore");
const { hasGeneratingWorkForTask } = require("../../utils/reflectionArkBackground");

Page({
  data: {
    taskId: "",
    taskTitle: "",
    reportTime: "",
    sections: [],
    hasAnyQuadrant: false,
    generalEcho: null,
    reportIntro: "",
    reportOutro: "",
    donutScores: { q1: 0, q2: 0, q3: 0, q4: 0 },
    reportLoading: false,
    reportPendingHint: "",
  },

  _reportPollTimer: null,
  _fallbackVisitSeed: "",
  _reportWasHidden: false,

  onLoad(options) {
    if (!requireLoginOnLoad()) return;
    const taskId = safeDecodeURIComponent(options && options.taskId);
    const taskTitle = safeDecodeURIComponent(options && options.taskTitle);
    this._taskId = taskId;
    this._taskTitle = taskTitle;
    this._fallbackVisitSeed = String(Date.now());
    this._loadReport();
  },

  onShow() {
    applyReflectionNavBar();
    if (this._reportWasHidden) {
      this._fallbackVisitSeed = String(Date.now());
      this._reportWasHidden = false;
    }
    if (!this._fallbackVisitSeed) {
      this._fallbackVisitSeed = String(Date.now());
    }
    this._loadReport();
  },

  onHide() {
    this._reportWasHidden = true;
    this._stopReportPoll();
  },

  onUnload() {
    this._stopReportPoll();
  },

  _stopReportPoll() {
    if (this._reportPollTimer) {
      clearInterval(this._reportPollTimer);
      this._reportPollTimer = null;
    }
  },

  _syncReportPoll(taskId) {
    this._stopReportPoll();
    if (!taskId || !hasGeneratingWorkForTask(taskId)) return;
    this._reportPollTimer = setInterval(() => {
      if (!hasGeneratingWorkForTask(this._taskId || this.data.taskId)) {
        this._stopReportPoll();
        return;
      }
      this._loadReport(true);
    }, 4500);
  },

  async _loadReport(fromPoll) {
    const taskId = this._taskId || this.data.taskId;
    if (!taskId) {
      wx.showToast({ title: "任务信息缺失", icon: "none" });
      return;
    }
    if (!fromPoll && !this._fallbackVisitSeed) {
      this._fallbackVisitSeed = String(Date.now());
    }
    this.setData({ reportLoading: true });
    let vm;
    try {
      vm = await buildReportViewModel(taskId, this._fallbackVisitSeed);
    } catch (err) {
      console.error("[reflection-report] buildReportViewModel", err && (err.stack || err.message || err));
      wx.showToast({ title: "报告加载失败", icon: "none" });
      this.setData({
        reportLoading: false,
        sections: [],
        hasAnyQuadrant: false,
        generalEcho: null,
        reportIntro: "",
        reportOutro: "",
        donutScores: { q1: 0, q2: 0, q3: 0, q4: 0 },
      });
      this.__reportVm = null;
      return;
    }
    if (!vm) {
      this.setData({ reportLoading: false });
      return;
    }
    const record = reflectionManager.findByTaskId(taskId);
    const donutScores = computeQuadrantScores(record);
    const taskTitle = vm.taskTitle || this._taskTitle || "";
    const sections = Array.isArray(vm.sections)
      ? vm.sections.map((s) =>
          Object.assign({}, s, {
            echoParagraphs: Array.isArray(s.echoParagraphs)
              ? s.echoParagraphs.map((row, ri) => {
                  if (row && typeof row === "object") {
                    const echoText =
                      row.echoText != null
                        ? String(row.echoText)
                        : row.text != null
                          ? String(row.text)
                          : "";
                    return {
                      echoKey: row.echoKey || row.key || `q${s.id}-${ri}`,
                      echoText,
                    };
                  }
                  return {
                    echoKey: `q${s.id}-${ri}`,
                    echoText: String(row == null ? "" : row),
                  };
                })
              : [],
          }),
        )
      : [];
    const payload = {
      taskId: vm.taskId,
      taskTitle,
      reportTime: vm.reportTime,
      sections,
      hasAnyQuadrant: vm.hasAnyQuadrant,
      generalEcho: vm.generalEcho,
      reportIntro: vm.reportIntro || "",
      reportOutro: vm.reportOutro || "",
      reportPendingHint: vm.reportPendingHint || "",
      donutScores,
    };
    payload.reportLoading = false;
    try {
      this.setData(payload);
      this._syncReportPoll(taskId);
    } catch (err) {
      console.error("[reflection-report] setData", err && (err.stack || err.message || err));
      wx.showToast({ title: "报告加载失败", icon: "none" });
      this.setData({
        reportLoading: false,
        sections: [],
        hasAnyQuadrant: false,
        generalEcho: null,
        reportIntro: "",
        reportOutro: "",
        donutScores: { q1: 0, q2: 0, q3: 0, q4: 0 },
      });
      this.__reportVm = null;
      return;
    }
    this.__reportVm = Object.assign({}, vm, { sections, donutScores });
  },
});
