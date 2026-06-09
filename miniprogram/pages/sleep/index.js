const STORAGE_KEYS = require("../../config/storageKeys");
const { requireLoginOnLoad } = require("../../utils/requireLogin");
const reminderRegistry = require("../../utils/reminderRegistry");
const { ensureUserTagsOrLeave } = require("../../utils/userTagsGate");
const { getTodayKey } = require("../../utils/dateKeys");
const { formatDateTime } = require("../../utils/dateFormat");
const { mapTagClassByText } = require("../../utils/taskTagStyles");

function formatMetaDateChinese(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${y}年${m}月${d}日`;
}

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
  const tags = Array.isArray(task.tags) ? task.tags : [];
  const typeClass = getTaskTypeClass(tags);
  return {
    ...task,
    title: task.title || "未命名任务",
    displayTitle: formatListTitle(task.title),
    createdAt,
    timeText: createdAt,
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

Page({
  data: {
    allTasks: [],
    tasks: [],
    metaDate: formatMetaDateChinese(new Date()),
    suppressTapOnce: false,
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
    const visibleTasks = normalized.filter((task) => {
      if (task.statusText === "已取消") return false;
      if (task.statusText === "进行中" || task.statusText === "已延期") return true;
      if (task.statusText !== "已完成") return false;
      const completedDay = (task.completedAt || "").slice(0, 10).replace(/\//g, "-");
      return completedDay === today;
    });
    const totalCount = visibleTasks.length;
    const doneCount = visibleTasks.filter((task) => task.done).length;
    this.setData({
      allTasks: normalized,
      tasks: visibleTasks,
      doneCount,
      totalCount,
      metaDate: formatMetaDateChinese(new Date()),
    });
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
    const task = this.data.allTasks.find((item) => item.id === taskId);
    if (!task) return;
    /** 与 task-why 一致：用 taskId 从本地读详情，避免长描述导致 URL 超限 */
    wx.navigateTo({
      url: `/pages/task-detail/index?taskId=${encodeURIComponent(task.id)}`,
    });
  },

  onTaskLongPress(e) {
    const taskId = e.currentTarget.dataset.id;
    const allTasks = this.data.allTasks.slice();
    const index = allTasks.findIndex((item) => item.id === taskId);
    const task = allTasks[index];
    if (!task) return;
    this.setData({ suppressTapOnce: true });
    wx.showModal({
      title: "删除任务",
      content:
        `确认删除「${task.title}」？\n\n` +
        "哲思复盘将保留，可在「我的 → 哲思复盘报告」中查看或长按删除。\n\n" +
        "若曾设置日历提醒，请自行到手机「日历」中删除相关条目。",
      confirmColor: "#12598f",
      success: (res) => {
        if (!res.confirm) return;
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
        } catch (e) {
          console.warn("delete task removeRecord", e);
        }
        try {
          const cloudDataSync = require("../../utils/cloudDataSync");
          if (typeof cloudDataSync.markTaskDeleted === "function") {
            cloudDataSync.markTaskDeleted(taskId);
          }
          cloudDataSync.deleteTaskFromCloud(taskId);
        } catch (e) {
          console.warn("delete task cloud", e);
        }
        this.loadTasks();
        wx.showToast({
          title: "已删除",
          icon: "success",
          duration: 1200,
        });
      },
    });
  },
});
