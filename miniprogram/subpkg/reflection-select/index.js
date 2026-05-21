const { requireLoginOnLoad } = require("../../utils/requireLogin");
const { getQuadrantCardBg, applyReflectionNavBar } = require("../../config/reflectionTheme");
const reflectionManager = require("../../utils/reflectionManager");
const { safeDecodeURIComponent } = require("../../utils/safeDecodeURIComponent");

const QUADRANTS = [
  {
    id: 1,
    title: "观实归真",
    sub1: "放下预设",
    sub2: "看见真实",
    agent: "小麟·觉察",
  },
  {
    id: 2,
    title: "观心明己",
    sub1: "在困境里",
    sub2: "听见自己",
    agent: "小麟·觉醒",
  },
  {
    id: 3,
    title: "明辨本心",
    sub1: "分清课题",
    sub2: "找回节奏",
    agent: "小麒·解绑",
  },
  {
    id: 4,
    title: "踏实前行",
    sub1: "最小一步",
    sub2: "从看见到行动",
    agent: "小麒·行动",
  },
];

Page({
  data: {
    taskId: "",
    taskTitle: "",
    showReportEntry: false,
    quadrants: QUADRANTS.map((q) =>
      Object.assign({}, q, { completed: false, bg: getQuadrantCardBg(q.id, false) }),
    ),
  },

  onLoad(options) {
    if (!requireLoginOnLoad()) return;
    const taskId = safeDecodeURIComponent(options && options.taskId);
    let taskTitle = safeDecodeURIComponent(options && options.taskTitle);
    const record = reflectionManager.findByTaskId(taskId);
    if (record && record.taskTitle && !taskTitle) {
      taskTitle = record.taskTitle;
    }
    this.setData({ taskId, taskTitle }, () => this._refreshCompletedState());
  },

  onShow() {
    applyReflectionNavBar();
    this._refreshCompletedState();
  },

  _refreshCompletedState() {
    const { taskId } = this.data;
    if (!taskId) return;
    const record = reflectionManager.findByTaskId(taskId);
    const completedIds = reflectionManager.getCompletedQuadrantIds(record);
    const quadrants = QUADRANTS.map((q) => {
      const completed = completedIds.indexOf(q.id) >= 0;
      return Object.assign({}, q, {
        completed,
        bg: getQuadrantCardBg(q.id, completed),
      });
    });
    this.setData({
      quadrants,
      showReportEntry: completedIds.length > 0,
    });
  },

  onTapReport() {
    const { taskId, taskTitle } = this.data;
    if (!taskId) {
      wx.showToast({ title: "任务信息缺失", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: `/subpkg/reflection-report/index?taskId=${encodeURIComponent(taskId)}&taskTitle=${encodeURIComponent(taskTitle || "")}`,
    });
  },

  onTapQuadrant(e) {
    const id = Number(e.currentTarget.dataset.id);
    const { taskId, taskTitle } = this.data;
    if (!taskId) {
      wx.showToast({ title: "任务信息缺失", icon: "none" });
      return;
    }
    if (!id) return;
    wx.navigateTo({
      url: `/subpkg/reflection-quadrant/index?taskId=${encodeURIComponent(taskId)}&taskTitle=${encodeURIComponent(taskTitle || "")}&quadrant=${id}`,
    });
  },
});
