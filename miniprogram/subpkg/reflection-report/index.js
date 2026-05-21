const { requireLoginOnLoad } = require("../../utils/requireLogin");
const { applyReflectionNavBar } = require("../../config/reflectionTheme");
const { buildReportViewModel } = require("../../utils/reflectionReport");
const { safeDecodeURIComponent } = require("../../utils/safeDecodeURIComponent");
const reflectionManager = require("../../utils/reflectionManager");
const { computeQuadrantScores } = require("../../utils/reflectionScore");

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
    saving: false,
  },

  onLoad(options) {
    if (!requireLoginOnLoad()) return;
    const taskId = safeDecodeURIComponent(options && options.taskId);
    const taskTitle = safeDecodeURIComponent(options && options.taskTitle);
    this._taskId = taskId;
    this._taskTitle = taskTitle;
    this._loadReport();
  },

  onShow() {
    applyReflectionNavBar();
    this._loadReport();
  },

  _loadReport() {
    const taskId = this._taskId || this.data.taskId;
    if (!taskId) {
      wx.showToast({ title: "任务信息缺失", icon: "none" });
      return;
    }
    let vm;
    try {
      vm = buildReportViewModel(taskId);
    } catch (err) {
      console.error("[reflection-report] buildReportViewModel", err && (err.stack || err.message || err));
      wx.showToast({ title: "报告加载失败", icon: "none" });
      this.setData({
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
    if (!vm) return;
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
      donutScores,
    };
    try {
      this.setData(payload);
    } catch (err) {
      console.error("[reflection-report] setData", err && (err.stack || err.message || err));
      wx.showToast({ title: "报告加载失败", icon: "none" });
      this.setData({
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

  onTapRestartReflection() {
    const taskId = String(this._taskId || this.data.taskId || "").trim();
    if (!taskId) {
      wx.showToast({ title: "任务信息缺失", icon: "none" });
      return;
    }
    const taskTitleForNav = this.data.taskTitle || this._taskTitle || "";
    wx.showModal({
      title: "重新复盘",
      content: "清空当前任务的所有复盘数据，重新开始？此操作不可撤销。",
      confirmText: "清空并开始",
      cancelText: "取消",
      success: (res) => {
        if (!res || res.confirm !== true) return;
        const removed = reflectionManager.removeByTaskId(taskId);
        if (!removed) {
          console.warn("[reflection-report] removeByTaskId: no matching record or write failed", taskId);
        }
        wx.showToast({ title: "已清空，开始新的复盘", icon: "none", duration: 1800 });
        const targetUrl = `/subpkg/reflection-select/index?taskId=${encodeURIComponent(
          taskId,
        )}&taskTitle=${encodeURIComponent(taskTitleForNav)}`;
        setTimeout(() => {
          wx.redirectTo({
            url: targetUrl,
            fail: (err) => {
              console.warn("[reflection-report] redirectTo failed, try reLaunch", err);
              wx.reLaunch({ url: targetUrl });
            },
          });
        }, 280);
      },
      fail: (err) => {
        console.warn("[reflection-report] showModal fail", err);
      },
    });
  },

  async onSaveAlbum() {
    if (this.data.saving) return;
    const vm = this.__reportVm;
    if (!vm || !vm.hasAnyQuadrant) {
      wx.showToast({ title: "暂无可保存内容", icon: "none" });
      return;
    }
    this.setData({ saving: true });
    wx.showLoading({ title: "生成中...", mask: true });
    try {
      const { exportReportImage, saveImageToAlbum } = require("../../utils/reflectionReportCanvas");
      const filePath = await exportReportImage(this, vm);
      await saveImageToAlbum(filePath);
      wx.showToast({ title: "已保存到相册", icon: "success" });
    } catch (err) {
      const msg = (err && err.errMsg) || "";
      if (msg.indexOf("auth deny") >= 0 || msg.indexOf("authorize") >= 0) {
        wx.showModal({
          title: "需要相册权限",
          content: "请在设置中允许保存到相册后重试",
          confirmText: "去设置",
          success: (res) => {
            if (res.confirm) wx.openSetting({});
          },
        });
      } else {
        wx.showToast({ title: "保存失败，请重试", icon: "none" });
        console.warn("[reflection-report] save album", err);
      }
    } finally {
      wx.hideLoading();
      this.setData({ saving: false });
    }
  },
});
