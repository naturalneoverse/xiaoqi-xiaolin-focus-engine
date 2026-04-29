const TASKS_STORAGE_KEY = "sleep_tasks";

function getTodayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

function normalizeTask(task) {
  const statusText = normalizeStatus(task);
  const createdAt = task.createdAt || task.timeText || formatDateTime(new Date());
  const tags = Array.isArray(task.tags) ? task.tags : [];
  const typeClass = getTaskTypeClass(tags);
  return {
    ...task,
    createdAt,
    timeText: createdAt,
    statusText,
    done: statusText === "已完成",
    typeClass,
    tags: tags.map((tag) => ({
      ...tag,
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
    tasks: [
      {
        id: "t1",
        title: "晨间冥想",
        timeText: "2024/05/20 09:15",
        done: true,
        tags: [
          { text: "重要紧急", className: "tag-red" },
          { text: "自我", className: "tag-gray" },
          { text: "真我", className: "tag-green" },
        ],
        statusText: "已完成",
      },
      {
        id: "t2",
        title: "核心代码重构",
        timeText: "2024/05/20 10:30",
        done: false,
        tags: [
          { text: "高优先", className: "tag-blue-light" },
          { text: "技术影", className: "tag-blue" },
          { text: "生产力", className: "tag-blue-light" },
        ],
        statusText: "进行中",
      },
      {
        id: "t3",
        title: "阅读《高效能人士》",
        timeText: "2024/05/20 14:00",
        done: true,
        tags: [
          { text: "重要不紧急", className: "tag-amber" },
          { text: "个人成长", className: "tag-gray" },
        ],
        statusText: "已完成",
      },
      {
        id: "t4",
        title: "晚间瑜伽拉伸",
        timeText: "2024/05/20 21:00",
        done: false,
        tags: [
          { text: "身心平衡", className: "tag-green" },
          { text: "日常", className: "tag-gray" },
        ],
        statusText: "进行中",
      },
    ],
    suppressTapOnce: false,
    doneCount: 0,
    totalCount: 0,
  },

  onLoad() {
    this.loadTasks();
  },

  onShow() {
    this.loadTasks();
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
  },

  loadTasks() {
    const storedTasks = wx.getStorageSync(TASKS_STORAGE_KEY);
    let normalized = [];
    if (Array.isArray(storedTasks) && storedTasks.length) {
      normalized = storedTasks.map(normalizeTask);
    } else {
      normalized = this.data.tasks.map(normalizeTask);
      wx.setStorageSync(TASKS_STORAGE_KEY, normalized);
    }
    const today = getTodayKey();
    const visibleTasks = normalized.filter((task) => {
      if (task.statusText === "进行中") return true;
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
        wx.setStorageSync(TASKS_STORAGE_KEY, allTasks);
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
