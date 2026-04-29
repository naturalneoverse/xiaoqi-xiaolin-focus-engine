const STORAGE_KEYS = require("../../config/storageKeys");

function toDateLabel(dateKey) {
  if (!dateKey) return "未分组";
  const [y, m, d] = dateKey.split("-");
  return `${m}月${d}日`;
}

function getDoneTasks(tasks) {
  return tasks.filter((task) => task.statusText === "已完成");
}

function buildGroups(doneTasks) {
  const map = {};
  doneTasks.forEach((task) => {
    const dateKey = (task.completedAt || "").slice(0, 10);
    if (!dateKey) return;
    if (!map[dateKey]) map[dateKey] = [];
    map[dateKey].push({
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

Page({
  data: {
    latest: {
      range: "3月10日 — 3月16日",
      moments: 8,
      doneCount: 12,
      status: "状态平稳",
    },
    historyReports: [
      { range: "3月3日 — 3月9日", moments: 3, status: "状态平稳" },
      { range: "2月24日 — 3月2日", moments: 2, status: "状态平稳" },
      { range: "2月17日 — 2月23日", moments: 4, status: "状态平稳" },
    ],
    pastTaskGroups: [
      {
        range: "3月10日 — 3月16日",
        expanded: true,
        tasks: [
          { name: "晨间冥想", tag: "重要不紧急" },
          { name: "陪孩子画画", tag: "重要不紧急" },
        ],
      },
      {
        range: "3月3日 — 3月9日",
        expanded: false,
        tasks: [],
      },
    ],
  },

  onShow() {
    this.loadReportFromTasks();
  },

  loadReportFromTasks() {
    const tasks = wx.getStorageSync(STORAGE_KEYS.TASKS_DATA);
    if (!Array.isArray(tasks)) return;
    const doneTasks = getDoneTasks(tasks);
    const groups = buildGroups(doneTasks);
    this.setData({
      latest: {
        ...this.data.latest,
        doneCount: doneTasks.length,
        moments: doneTasks.length,
      },
      pastTaskGroups: groups.length ? groups : [{ range: "暂无完成任务", expanded: true, tasks: [] }],
    });
  },

  goBack() {
    wx.switchTab({
      url: "/pages/sleep/index",
    });
  },

  goHome() {
    wx.switchTab({
      url: "/pages/sleep/index",
    });
  },

  goWeeklyFromLatest() {
    wx.navigateTo({
      url: "/pages/weekly-report/index?source=latest&status=状态平稳",
    });
  },

  goHistoryReport(e) {
    const index = Number(e.currentTarget.dataset.index);
    const item = this.data.historyReports[index];
    if (!item) return;
    wx.navigateTo({
      url: `/pages/weekly-report/index?source=history&status=${encodeURIComponent(item.status)}`,
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
});
