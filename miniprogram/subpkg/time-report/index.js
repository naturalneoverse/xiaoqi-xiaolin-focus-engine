const STORAGE_KEYS = require("../../config/storageKeys");
const momentScore = require("../../utils/momentScore");
const { buildPastWeeklyReportRows } = require("../../utils/reportHistoryLists");
const { goSleepHome } = require("../../utils/goTabHome");
const {
  getPastTaskAllTags,
  buildPastDateDisplay,
} = require("../../utils/taskListDisplay");

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
    map[dateKey].push(task);
  });
  return Object.keys(map)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((dateKey) => ({
      dateKey,
      range: toDateLabel(dateKey),
      expanded: false,
      isEmpty: false,
      tasks: map[dateKey].map((task) => ({
        taskId: task.id || "",
        name: task.title || "未命名任务",
        tags: getPastTaskAllTags(task),
      })),
    }));
}

function buildEmptyPastGroup() {
  return [{ isEmpty: true, dateKey: "", range: "暂无完成任务", expanded: false, tasks: [] }];
}

/** 当下质地：见 momentScore.presenceTierName */
function presenceTierName(doneCount, createdCount, activeMomentCount) {
  return momentScore.presenceTierName(doneCount, createdCount, activeMomentCount);
}

function presenceHintFor(doneCount, createdCount, activeMomentCount) {
  return momentScore.presenceHintFor(doneCount, createdCount, activeMomentCount);
}

function buildEmptyLatest(curSummary) {
  const c = curSummary || momentScore.getCurrentWeekSummary([], new Date());
  const momentView = momentScore.buildMomentScoreView(0);
  return {
    range: c.rangeLabel,
    moments: 0,
    momentDisplayText: momentView.displayText,
    momentUnitText: momentView.unitText,
    doneCount: 0,
    presenceName: "暂无",
    presenceHint: presenceHintFor(0, 0),
    weekMondayKey: c.weekMondayKey,
  };
}

function previousWeekMondayKey(refDate) {
  const mon = momentScore.getIsoWeekMonday(refDate || new Date());
  const prev = new Date(mon);
  prev.setDate(prev.getDate() - 7);
  return momentScore.weekMondayKey(prev);
}

function summaryToHistoryRow(summary, tasks) {
  const createdCount = momentScore.countCreatedInWeek(tasks, summary.weekMonday);
  return {
    range: summary.rangeLabel,
    moments: summary.momentScore,
    presenceName: presenceTierName(summary.doneCount, createdCount, 0),
    weekMondayKey: summary.weekMondayKey,
  };
}

function applyPastGroupsToPage(page, allGroups) {
  const datesExpanded = !!page.data.pastDatesExpanded;
  const dateDisplay = buildPastDateDisplay(allGroups, datesExpanded);
  page.setData({
    allPastTaskGroups: allGroups,
    pastTaskGroups: dateDisplay.visible,
    pastDatesHiddenCount: dateDisplay.hiddenCount,
    showPastDatesExpand: dateDisplay.showExpand,
    showPastDatesCollapse: dateDisplay.showCollapse,
    pastTasksEmpty: allGroups.length === 0 || !!allGroups[0].isEmpty,
  });
}

Page({
  data: {
    latest: buildEmptyLatest(),
    lastWeekReport: null,
    showAllPastLink: false,
    lastWeekEmptyHint: "上周暂无完成任务记录",
    allPastTaskGroups: [],
    pastTaskGroups: buildEmptyPastGroup(),
    pastTasksEmpty: true,
    pastDatesExpanded: false,
    pastDatesHiddenCount: 0,
    showPastDatesExpand: false,
    showPastDatesCollapse: false,
  },

  onLoad() {
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
    const built = buildGroups(doneTasks);
    const expandedKeys = new Set(
      (this.data.allPastTaskGroups || [])
        .filter((group) => group.expanded && group.dateKey)
        .map((group) => group.dateKey)
    );
    const allGroups = built.length
      ? built.map((group) => ({
          ...group,
          expanded: expandedKeys.has(group.dateKey),
        }))
      : buildEmptyPastGroup();
    const cur = momentScore.getCurrentWeekSummary(tasks, new Date());
    const presenceName = cur.presenceName || presenceTierName(cur.doneCount, cur.createdCount, cur.activeMomentCount);
    const presenceHint = presenceHintFor(cur.doneCount, cur.createdCount, cur.activeMomentCount);
    const summaries = momentScore.buildWeekSummaries(tasks);
    const prevKey = previousWeekMondayKey(new Date());
    const prevSummary = summaries.find((s) => s.weekMondayKey === prevKey) || null;
    const pastRows = buildPastWeeklyReportRows(tasks);
    const momentView = momentScore.buildMomentScoreView(cur.momentScore);
    const latest = {
      range: cur.rangeLabel,
      moments: cur.momentScore,
      momentDisplayText: momentView.displayText,
      momentUnitText: momentView.unitText,
      doneCount: cur.doneCount,
      presenceName,
      presenceHint,
      weekMondayKey: cur.weekMondayKey,
    };
    this.setData({
      latest,
      lastWeekReport: prevSummary ? summaryToHistoryRow(prevSummary, tasks) : null,
      showAllPastLink: pastRows.length > 0,
      lastWeekEmptyHint: pastRows.length > 0
        ? "上周暂无完成任务记录，更早的周报在下方查看"
        : "上周暂无完成任务记录",
    });
    applyPastGroupsToPage(this, allGroups);
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

  goLastWeekReport() {
    const item = this.data.lastWeekReport;
    if (!item || !item.weekMondayKey) return;
    wx.navigateTo({
      url: `/subpkg/weekly-report/index?weekStart=${encodeURIComponent(item.weekMondayKey)}`,
    });
  },

  goAllPastReports() {
    wx.navigateTo({
      url: "/subpkg/weekly-report-list/index",
    });
  },

  togglePastDatesExpand() {
    this.setData({ pastDatesExpanded: !this.data.pastDatesExpanded }, () => {
      applyPastGroupsToPage(this, this.data.allPastTaskGroups);
    });
  },

  toggleTaskGroup(e) {
    const dateKey = e.currentTarget.dataset.dateKey;
    if (!dateKey) return;
    const allGroups = (this.data.allPastTaskGroups || []).map((group) => {
      if (group.isEmpty) return group;
      if (group.dateKey === dateKey) {
        return { ...group, expanded: !group.expanded };
      }
      return { ...group, expanded: false };
    });
    applyPastGroupsToPage(this, allGroups);
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
