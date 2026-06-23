const STORAGE_KEYS = require("../../config/storageKeys");
const { requireLoginOnLoad } = require("../../utils/requireLogin");
const reminderRegistry = require("../../utils/reminderRegistry");
const { ensureUserTagsOrLeave } = require("../../utils/userTagsGate");
const { getTodayKey } = require("../../utils/dateKeys");
const { formatDateTime } = require("../../utils/dateFormat");
const { mapTagClassByText } = require("../../utils/taskTagStyles");
const {
  sortIncompleteTasks,
  sortCompletedTasksNewestFirst,
  buildPendingDisplay,
  buildDoneTodayDisplay,
} = require("../../utils/taskListDisplay");

function formatMetaDateChinese(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${y}年${m}月${d}日`;
}

const subtaskUtil = require("../../utils/subtask");

function normalizeStatus(task) {
  if (task.statusText) return task.statusText;
  return task.done ? "已完成" : "进行中";
}

function formatListTitle(title) {
  const text = (title || "").trim();
  const chars = Array.from(text);
  if (chars.length <= 10) return text || "未命名任务";
  return `${chars.slice(0, 10).join("")}...`;
}

function normalizeTask(task) {
  const statusText = normalizeStatus(task);
  const createdAt = task.createdAt || task.timeText || formatDateTime(new Date());
  const updatedAt =
    Number(task.updatedAt) > 0
      ? Number(task.updatedAt)
      : getTaskSortMs({ ...task, createdAt, timeText: createdAt }) || Date.now();
  const tags = Array.isArray(task.tags) ? task.tags : [];
  const typeClass = getTaskTypeClass(tags);
  return {
    ...task,
    title: task.title || "未命名任务",
    displayTitle: formatListTitle(task.title),
    createdAt,
    timeText: createdAt,
    updatedAt,
    statusText,
    done: statusText === "已完成",
    typeClass,
    tags: tags.map((tag) => ({
      ...tag,
      className: mapTagClassByText(tag.text || "", tag.className),
      isPriority: /优先/.test(tag.text || ""),
    })),
  };
}

function getTaskTypeClass(tags) {
  const tagText = tags.map((tag) => tag.text || "").join("|");
  if (/技术/.test(tagText)) return "task-type-tech";
  if (/身心/.test(tagText)) return "task-type-balance";
  return "task-type-default";
}

function getTaskSortMs(task) {
  try {
    const cloudDataSync = require("../../utils/cloudDataSync");
    if (cloudDataSync && typeof cloudDataSync.getTaskEffectiveMs === "function") {
      return cloudDataSync.getTaskEffectiveMs(task);
    }
  } catch (e) {
    /* ignore */
  }
  const u = Number(task && task.updatedAt);
  if (Number.isFinite(u) && u > 0) return u;
  const c = Date.parse(String((task && (task.createdAt || task.timeText)) || "").replace(/\//g, "-"));
  return Number.isFinite(c) ? c : 0;
}

function sortTasksNewestFirst(list) {
  return list.slice().sort((a, b) => getTaskSortMs(b) - getTaskSortMs(a));
}

function isVisibleOnSleepTab(task, today) {
  if (subtaskUtil.isSubtask(task)) return false;
  if (task.statusText === "已取消") return false;
  if (task.statusText === "进行中" || task.statusText === "已延期") return true;
  if (task.statusText !== "已完成") return false;
  const completedDay = (task.completedAt || "").slice(0, 10).replace(/\//g, "-");
  return completedDay === today;
}

function isIncompleteTask(task) {
  return task.statusText === "进行中" || task.statusText === "已延期";
}

Page({
  data: {
    allTasks: [],
    hasVisibleTasks: false,
    pendingTasks: [],
    pendingHiddenCount: 0,
    showPendingExpand: false,
    showPendingCollapse: false,
    doneTodayTasks: [],
    doneTodayCount: 0,
    doneTodayHiddenCount: 0,
    showDoneTodayExpand: false,
    showDoneTodayCollapse: false,
    pendingExpanded: false,
    doneTodayExpanded: false,
    subtaskExpandedMap: {},
    metaDate: formatMetaDateChinese(new Date()),
    highlightAddBtn: false,
    doneCount: 0,
    totalCount: 0,
  },

  onLoad(options) {
    try {
      const shareRef = require("../../utils/shareReferrer");
      const auth = require("../../utils/authSession");
      shareRef.handleColdLaunchForQr(!!auth.hasLocalCredentials());
    } catch (e) {
      /* ignore */
    }
    try {
      const shareRef = require("../../utils/shareReferrer");
      if (shareRef.gateUnauthenticatedShareEntry(options)) {
        return;
      }
    } catch (e) {
      /* ignore */
    }
    if (!requireLoginOnLoad()) return;
    this.loadTasks();
  },

  onShow() {
    ensureUserTagsOrLeave().then((ok) => {
      if (!ok) return;
      const refreshUi = () => {
        this.loadTasks();
        if (typeof this.getTabBar === "function" && this.getTabBar()) {
          this.getTabBar().setData({ selected: 0 });
        }
      };
      let pull = Promise.resolve();
      try {
        const cloudDataSync = require("../../utils/cloudDataSync");
        if (cloudDataSync && typeof cloudDataSync.ensureCloudCallable === "function") {
          pull = cloudDataSync.ensureCloudCallable().then((ok) => {
            if (!ok || typeof cloudDataSync.pullAndMergeFromCloud !== "function") return;
            return cloudDataSync.pullAndMergeFromCloud();
          });
        }
      } catch (e) {
        /* ignore */
      }
      pull.catch(() => {}).finally(refreshUi);
    });
  },

  loadTasks() {
    let storedTasks = [];
    try {
      const raw = wx.getStorageSync(STORAGE_KEYS.TASKS_DATA);
      storedTasks = Array.isArray(raw) ? raw : [];
    } catch (e) {
      console.error("loadTasks getStorageSync", e);
      storedTasks = [];
    }
    const normalized = sortTasksNewestFirst(
      storedTasks.length ? storedTasks.map(normalizeTask) : []
    );
    const today = getTodayKey();
    const visibleTasks = normalized.filter((task) => isVisibleOnSleepTab(task, today));
    const pendingAll = sortIncompleteTasks(
      visibleTasks.filter(isIncompleteTask),
      getTaskSortMs
    );
    const doneTodayAll = sortCompletedTasksNewestFirst(
      visibleTasks.filter((task) => task.statusText === "已完成"),
      getTaskSortMs
    );
    const pendingExpanded = !!this.data.pendingExpanded;
    const doneTodayExpanded = !!this.data.doneTodayExpanded;
    const subtaskExpandedMap = subtaskUtil.readTreeExpandedMap();
    const pendingDisplay = buildPendingDisplay(pendingAll, pendingExpanded);
    const doneTodayDisplay = buildDoneTodayDisplay(doneTodayAll, doneTodayExpanded);
    const pendingTasks = subtaskUtil.buildSleepTreeRows(
      pendingDisplay.visible,
      normalized,
      subtaskExpandedMap,
    );
    const doneTodayTasks = subtaskUtil.buildSleepTreeRows(
      doneTodayDisplay.visible,
      normalized,
      subtaskExpandedMap,
    );
    const totalCount = visibleTasks.length;
    const doneCount = doneTodayAll.length;
    this.setData({
      allTasks: normalized,
      hasVisibleTasks: visibleTasks.length > 0,
      pendingTasks,
      pendingHiddenCount: pendingDisplay.hiddenCount,
      showPendingExpand: pendingDisplay.showExpand,
      showPendingCollapse: pendingDisplay.showCollapse,
      doneTodayTasks,
      doneTodayCount: doneTodayAll.length,
      doneTodayHiddenCount: doneTodayDisplay.hiddenCount,
      showDoneTodayExpand: doneTodayDisplay.showExpand,
      showDoneTodayCollapse: doneTodayDisplay.showCollapse,
      doneCount,
      totalCount,
      metaDate: formatMetaDateChinese(new Date()),
      subtaskExpandedMap,
    });
  },

  toggleSubtaskTree(e) {
    const parentId = e.currentTarget.dataset.id;
    if (!parentId) return;
    subtaskUtil.toggleTreeExpanded(parentId);
    this.loadTasks();
  },

  onToggleSubtaskFromTree(e) {
    const id = e.currentTarget.dataset.id;
    if (!id) return;
    const res = subtaskUtil.toggleSubtaskDone(id);
    if (!res.ok) {
      wx.showToast({ title: res.message || "操作失败", icon: "none" });
      return;
    }
    this.loadTasks();
  },

  togglePendingExpand() {
    this.setData({ pendingExpanded: !this.data.pendingExpanded }, () => this.loadTasks());
  },

  toggleDoneTodayExpand() {
    this.setData({ doneTodayExpanded: !this.data.doneTodayExpanded }, () => this.loadTasks());
  },

  goTaskCreate() {
    wx.navigateTo({
      url: "/pages/task-create/index",
    });
  },

  goTimeReport() {
    wx.navigateTo({
      url: "/subpkg/time-report/index",
    });
  },

  openTaskDetail(e) {
    if (this.data.suppressTapOnce) {
      this.setData({ suppressTapOnce: false });
      return;
    }
    const taskId = e.currentTarget.dataset.id;
    const rowType = e.currentTarget.dataset.rowType || "parent";
    if (rowType === "subtask") {
      wx.navigateTo({
        url: `/pages/subtask-detail/index?taskId=${encodeURIComponent(taskId)}`,
      });
      return;
    }
    const task = this.data.allTasks.find((item) => item.id === taskId);
    if (!task) return;
    wx.navigateTo({
      url: `/pages/task-detail/index?taskId=${encodeURIComponent(task.id)}`,
    });
  },

  onTaskLongPress(e) {
    const taskId = e.currentTarget.dataset.id;
    const rowType = e.currentTarget.dataset.rowType || "parent";
    this.setData({ suppressTapOnce: true });

    if (rowType === "subtask") {
      const sub = subtaskUtil.findTaskById(this.data.allTasks, taskId);
      if (!sub) return;
      wx.showModal({
        title: "删除子任务",
        content: `确认删除「${sub.title || "未命名"}」？`,
        confirmColor: "#12598f",
        success: (res) => {
          if (!res.confirm) return;
          const r = subtaskUtil.deleteSubtask(taskId);
          if (!r.ok) {
            wx.showToast({ title: r.message || "删除失败", icon: "none" });
            return;
          }
          this.loadTasks();
          wx.showToast({ title: "已删除", icon: "success", duration: 1200 });
        },
      });
      return;
    }

    const allTasks = this.data.allTasks.slice();
    const task = allTasks.find((item) => item.id === taskId);
    if (!task) return;
    const subCount = subtaskUtil.getSubtasksForParent(allTasks, taskId).length;
    const subtaskLine =
      subCount > 0 ? `\n\n将同时删除 ${subCount} 个子任务。` : "";
    wx.showModal({
      title: "删除任务",
      content:
        `确认删除「${task.title}」？${subtaskLine}\n\n` +
        "哲思复盘将保留，可在「我的 → 哲思复盘报告」中查看或长按删除。\n\n" +
        "若曾设置日历提醒，请自行到手机「日历」中删除相关条目。",
      confirmColor: "#12598f",
      success: (res) => {
        if (!res.confirm) return;
        if (subCount > 0) {
          const r = subtaskUtil.deleteParentTaskCascade(taskId);
          if (!r.ok) {
            wx.showToast({ title: r.message || "删除失败", icon: "none" });
            return;
          }
          try {
            reminderRegistry.removeRecord(taskId);
          } catch (err) {
            console.warn("delete task removeRecord", err);
          }
          this.loadTasks();
          wx.showToast({ title: "已删除", icon: "success", duration: 1200 });
          return;
        }
        const index = allTasks.findIndex((item) => item.id === taskId);
        if (index < 0) return;
        allTasks.splice(index, 1);
        try {
          wx.setStorageSync(STORAGE_KEYS.TASKS_DATA, allTasks);
        } catch (err) {
          console.error("delete task setStorageSync", err);
          wx.showToast({ title: "删除失败", icon: "none" });
          return;
        }
        try {
          reminderRegistry.removeRecord(taskId);
        } catch (err) {
          console.warn("delete task removeRecord", err);
        }
        try {
          const cloudDataSync = require("../../utils/cloudDataSync");
          if (typeof cloudDataSync.markTaskDeleted === "function") {
            cloudDataSync.markTaskDeleted(taskId);
          }
          cloudDataSync.deleteTaskFromCloud(taskId);
        } catch (err) {
          console.warn("delete task cloud", err);
        }
        this.loadTasks();
        wx.showToast({ title: "已删除", icon: "success", duration: 1200 });
      },
    });
  },
});
