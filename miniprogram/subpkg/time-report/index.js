const STORAGE_KEYS = require("../../config/storageKeys");
const momentScore = require("../../utils/momentScore");
const { goSleepHome } = require("../../utils/goTabHome");
const { requireLoginOnLoad } = require("../../utils/requireLogin");

function toDateLabel(dateKey) {
  if (!dateKey) return "未分组";
  const parts = dateKey.split("-");
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!m || !d) return "未分组";
  const yi = Number(y);
  const cy = new Date().getFullYear();
  if (yi && !Number.isNaN(yi) && yi !== cy) {
    return `${yi}年${Number(m)}月${Number(d)}日`;
  }
  return `${Number(m)}月${Number(d)}日`;
}

function getDoneTasks(tasks) {
  return tasks.filter((task) => task.statusText === "已完成");
}

function normalizeCompletedDateKey(completedAt) {
  if (!completedAt) return "";
  const slice = String(completedAt).slice(0, 10).replace(/\//g, "-");
  if (/^\d{4}-\d{2}-\d{2}$/.test(slice)) return slice;
  return "";
}

function buildGroups(doneTasks) {
  const map = {};
  doneTasks.forEach((task) => {
    const dateKey = normalizeCompletedDateKey(task.completedAt);
    if (!dateKey) return;
    if (!map[dateKey]) map[dateKey] = [];
    map[dateKey].push({
      taskId: task.id || "",
      name: task.title,
      tag: (task.tags && task.tags[0] && task.tags[0].text) || "任务",
    });
  });
  return Object.keys(map)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((dateKey, index) => ({
      range: `${toDateLabel(dateKey)} 完成`,
      expanded: index === 0,
      tasks: map[dateKey],
    }));
}

/** 当下质地：本周完成率 = 已完成数 / 本周创建任务数（与 momentScore 周口径一致） */
function presenceTierName(doneCount, createdCount) {
  if (!createdCount || createdCount <= 0) return "暂无";
  const rate = (doneCount / createdCount) * 100;
  if (rate >= 80) return "沉浸";
  if (rate >= 60) return "专注";
  if (rate >= 30) return "铺展";
  return "酝酿";
}

function presenceHintFor(doneCount, createdCount) {
  if (!createdCount || createdCount <= 0) return "本周还没有新任务，先去创建一条吧。";
  return "";
}

function buildEmptyLatest(curSummary) {
  const c = curSummary || momentScore.getCurrentWeekSummary([], new Date());
  return {
    range: c.rangeLabel,
    moments: 0,
    doneCount: 0,
    presenceName: "暂无",
    presenceHint: presenceHintFor(0, 0),
    weekMondayKey: c.weekMondayKey,
  };
}

Page({
  data: {
    latest: buildEmptyLatest(),
    historyReports: [],
    pastTaskGroups: [{ range: "暂无完成任务", expanded: true, tasks: [] }],
  },

  onLoad() {
    if (!requireLoginOnLoad()) return;
  },

  onShow() {
    this.loadReportFromTasks();
  },

  loadReportFromTasks() {
    let tasks = [];
    try {
      const raw = wx.getStorageSync(STORAGE_KEYS.TASKS_DATA);
      tasks = Array.isArray(raw) ? raw : [];
    } catch (e) {
      console.error("loadReportFromTasks getStorageSync", e);
      tasks = [];
    }
    const doneTasks = getDoneTasks(tasks);
    const groups = buildGroups(doneTasks);
    const cur = momentScore.getCurrentWeekSummary(tasks, new Date());
    const presenceName = presenceTierName(cur.doneCount, cur.createdCount);
    const presenceHint = presenceHintFor(cur.doneCount, cur.createdCount);
    const summaries = momentScore.buildWeekSummaries(tasks);
    const rest = summaries.filter((s) => s.weekMondayKey !== cur.weekMondayKey);
    const latest = {
      range: cur.rangeLabel,
      moments: cur.momentScore,
      doneCount: cur.doneCount,
      presenceName,
      presenceHint,
      weekMondayKey: cur.weekMondayKey,
    };
    const historyReports = rest.map((s) => ({
      range: s.rangeLabel,
      moments: s.momentScore,
      presenceName: presenceTierName(s.doneCount, s.createdCount),
      weekMondayKey: s.weekMondayKey,
    }));
    this.setData({
      latest,
      historyReports,
      pastTaskGroups: groups.length ? groups : [{ range: "暂无完成任务", expanded: true, tasks: [] }],
    });
  },

  goBack() {
    goSleepHome();
  },

  goHome() {
    goSleepHome();
  },

  goWeeklyFromLatest() {
    const key =
      (this.data.latest && this.data.latest.weekMondayKey) ||
      momentScore.weekMondayKey(momentScore.getIsoWeekMonday(new Date()));
    wx.navigateTo({
      url: `/subpkg/weekly-report/index?weekStart=${encodeURIComponent(key)}`,
    });
  },

  goHistoryReport(e) {
    const index = Number(e.currentTarget.dataset.index);
    const item = this.data.historyReports[index];
    if (!item || !item.weekMondayKey) return;
    wx.navigateTo({
      url: `/subpkg/weekly-report/index?weekStart=${encodeURIComponent(item.weekMondayKey)}`,
    });
  },

  toggleTaskGroup(e) {
    const index = Number(e.currentTarget.dataset.index);
    const groups = this.data.pastTaskGroups.slice();
    if (!groups[index]) return;
    groups[index].expanded = !groups[index].expanded;
    this.setData({
      pastTaskGroups: groups,
    });
  },

  goPastTaskDetail(e) {
    const taskId = e.currentTarget.dataset.taskId;
    if (!taskId) {
      wx.showToast({ title: "任务信息缺失", icon: "none" });
      return;
    }
    wx.navigateTo({
      url: `/pages/task-detail/index?taskId=${encodeURIComponent(String(taskId))}`,
    });
  },
});
