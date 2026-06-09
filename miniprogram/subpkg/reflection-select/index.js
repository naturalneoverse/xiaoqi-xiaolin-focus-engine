const { requireLoginOnLoad } = require("../../utils/requireLogin");
const { getQuadrantCardBg, applyReflectionNavBar } = require("../../config/reflectionTheme");
const reflectionManager = require("../../utils/reflectionManager");
const { safeDecodeURIComponent } = require("../../utils/safeDecodeURIComponent");
const {
  hasGeneratingWorkForTask,
  isQuadrantGenerating,
  getPendingCardFields,
  resumePendingGenerationsForTask,
} = require("../../utils/reflectionArkBackground");

const SELECT_POLL_MS = 4500;

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
    title: "自我主宰",
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

/** @param {boolean} completed @param {string} taskId @param {number} quadrantId */
function resolveQuadrantBadge(completed, taskId, quadrantId) {
  if (!completed) {
    return { badge: "not_started", badgeLabel: "未开始" };
  }
  if (isQuadrantGenerating(taskId, quadrantId)) {
    return { badge: "generating", badgeLabel: "生成中" };
  }
  return { badge: "completed", badgeLabel: "已完成" };
}

Page({
  data: {
    taskId: "",
    taskTitle: "",
    showReportEntry: false,
    showStatusGenerating: false,
    showStatusReady: false,
    /** idle | generating | ready */
    globalStatus: "idle",
    quadrants: QUADRANTS.map((q) =>
      Object.assign({}, q, {
        completed: false,
        badge: "not_started",
        badgeLabel: "未开始",
        bg: getQuadrantCardBg(q.id, false),
      }),
    ),
  },

  onLoad(options) {
    if (!requireLoginOnLoad()) return;
    this._selectHadPending = false;
    const taskId = safeDecodeURIComponent(options && options.taskId);
    let taskTitle = safeDecodeURIComponent(options && options.taskTitle);
    const record = reflectionManager.findByTaskId(taskId);
    if (record && record.taskTitle && !taskTitle) {
      taskTitle = record.taskTitle;
    }
    this.setData({ taskId, taskTitle }, () => this._refreshSelectState());
  },

  onShow() {
    try {
      const syncConflict = require("../../utils/syncConflict");
      if (syncConflict.hasConflicts()) {
        syncConflict.tryShowPendingConflicts();
      }
    } catch (e) {
      /* ignore */
    }
    applyReflectionNavBar();
    this._refreshSelectState();
  },

  onHide() {
    this._stopSelectPoll();
  },

  onUnload() {
    this._stopSelectPoll();
  },

  _stopSelectPoll() {
    if (this._selectPollTimer) {
      clearInterval(this._selectPollTimer);
      this._selectPollTimer = null;
    }
  },

  _syncSelectPoll() {
    this._stopSelectPoll();
    const taskId = this.data.taskId;
    if (!taskId || !hasGeneratingWorkForTask(taskId)) return;
    this._selectPollTimer = setInterval(() => {
      const tid = this.data.taskId;
      if (!tid) {
        this._stopSelectPoll();
        return;
      }
      this._refreshSelectState();
      if (!hasGeneratingWorkForTask(tid)) {
        this._stopSelectPoll();
      }
    }, SELECT_POLL_MS);
  },

  _resolveGlobalStatus(taskId) {
    const pending = hasGeneratingWorkForTask(taskId);
    if (pending) {
      this._selectHadPending = true;
      return "generating";
    }
    if (this._selectHadPending) {
      return "ready";
    }
    return "idle";
  },

  _refreshSelectState() {
    const { taskId } = this.data;
    if (!taskId) return;

    resumePendingGenerationsForTask(taskId);
    const record = reflectionManager.findByTaskId(taskId);
    const completedIds = reflectionManager.getCompletedQuadrantIds(record);

    const quadrants = QUADRANTS.map((q) => {
      const completed = completedIds.indexOf(q.id) >= 0;
      const badgeInfo = resolveQuadrantBadge(completed, taskId, q.id);
      return Object.assign({}, q, badgeInfo, {
        completed,
        bg: getQuadrantCardBg(q.id, completed),
      });
    });

    const globalStatus = this._resolveGlobalStatus(taskId);

    this.setData({
      quadrants,
      showReportEntry: completedIds.length > 0,
      globalStatus,
      showStatusGenerating: globalStatus === "generating",
      showStatusReady: globalStatus === "ready",
    });
    this._syncSelectPoll();
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
