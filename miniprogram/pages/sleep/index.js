const STORAGE_KEYS = require("../../config/storageKeys");
const { ensureUserTagsOrLeave } = require("../../utils/userTagsGate");

function getTodayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatMetaDateChinese(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return `${y}年${m}月${d}日`;
}

function formatDateTime(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${d} ${hh}:${mm}`;
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

function getPriorityTagClass(text) {
  if (text === "重要且紧急") return "tag-red";
  if (text === "重要不紧急") return "tag-orange";
  if (text === "紧急不重要") return "tag-blue";
  if (text === "不重要不紧急") return "tag-gray";
  return "";
}

function getForWhomTagClass(text) {
  if (text === "自己") return "tag-berry";
  if (text === "至亲") return "tag-lavender";
  if (text === "外缘") return "tag-sky";
  if (text === "不二") return "tag-violet";
  return "";
}

function getWhyTagClass(text) {
  if (text === "生计") return "tag-amber";
  if (text === "职责") return "tag-teal";
  if (text === "真我") return "tag-gold";
  if (text === "合一") return "tag-deep";
  return "";
}

function mapTagClassByText(text, fallbackClassName) {
  const mappedClassName =
    getPriorityTagClass(text) || getForWhomTagClass(text) || getWhyTagClass(text);
  return mappedClassName || fallbackClassName || "tag";
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

Page({
  data: {
    allTasks: [],
    tasks: [],
    metaDate: formatMetaDateChinese(new Date()),
    suppressTapOnce: false,
    doneCount: 0,
    totalCount: 0,
  },

  onLoad() {
    this.loadTasks();
  },

  onShow() {
    ensureUserTagsOrLeave().then((ok) => {
      if (!ok) return;
      this.loadTasks();
      if (typeof this.getTabBar === "function" && this.getTabBar()) {
        this.getTabBar().setData({ selected: 0 });
      }
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
    const normalized = storedTasks.length ? storedTasks.map(normalizeTask) : [];
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
      url: "/pages/time-report/index",
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
    const payload = encodeURIComponent(
      JSON.stringify({
        taskId: task.id,
        taskName: task.title,
        taskContent: task.content || "暂无描述",
        dateValue: task.dateValue || (task.timeText ? task.timeText.split(" ")[0].replace(/\//g, "-") : ""),
        priority: task.tags[0] && task.tags[0].text,
        forWhom: task.tags[1] && task.tags[1].text,
        why: task.tags[2] && task.tags[2].text,
        statusText: task.statusText || normalizeStatus(task),
        reminderDate: task.reminderDate || "",
        reminderTime: task.reminderTime || "",
        reminderFrequency: task.reminderFrequency || "不重复",
      }),
    );
    wx.navigateTo({
      url: `/pages/task-detail/index?payload=${payload}`,
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
      content: `确认删除“${task.title}”？`,
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
