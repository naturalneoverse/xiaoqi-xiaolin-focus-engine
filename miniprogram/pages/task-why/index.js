const OPTIONS = [
  { key: "生计", desc: "为了生存，做了才能活下去" },
  { key: "职责", desc: "角色赋予你的责任，你在建造什么" },
  { key: "真我", desc: "发自内心的，让你更接近自己的事" },
  { key: "合一", desc: "生计、职责、真我，三层合一" },
];

function parsePayload(payload) {
  try {
    return payload ? JSON.parse(decodeURIComponent(payload)) : {};
  } catch (e) {
    return {};
  }
}

const TASKS_STORAGE_KEY = "sleep_tasks";

function formatDateTime(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${d} ${hh}:${mm}`;
}

function buildTags(payload, selectedWhy) {
  return [
    payload.priority ? { text: payload.priority, className: "tag-red" } : null,
    payload.forWhom ? { text: payload.forWhom, className: "tag-gray" } : null,
    selectedWhy ? { text: selectedWhy, className: "tag-green" } : null,
  ].filter(Boolean);
}

Page({
  data: {
    options: OPTIONS,
    selected: "",
    payload: {},
  },

  onLoad(options) {
    const payload = parsePayload(options.payload);
    this.setData({
      payload,
      selected: payload.why || "",
    });
  },

  chooseOption(e) {
    this.setData({
      selected: e.currentTarget.dataset.key,
    });
  },

  goPrev() {
    wx.navigateBack();
  },

  saveTask() {
    const { selected, payload } = this.data;
    if (!selected) {
      wx.showToast({ title: "请选择一项", icon: "none" });
      return;
    }
    const mergedPayload = { ...payload, why: selected };
    const now = new Date();
    const taskId = `t_${Date.now()}`;
    const createdAt = formatDateTime(now);
    const task = {
      id: taskId,
      title: mergedPayload.taskName || "未命名任务",
      content: mergedPayload.taskContent || "暂无描述",
      timeText: createdAt,
      createdAt,
      dateValue: mergedPayload.dateValue || "",
      statusText: "进行中",
      done: false,
      reminderDate: mergedPayload.reminderDate || "",
      reminderTime: mergedPayload.reminderTime || "",
      reminderFrequency: mergedPayload.reminderFrequency || "不重复",
      tags: buildTags(mergedPayload, selected),
    };
    const tasks = wx.getStorageSync(TASKS_STORAGE_KEY);
    const nextTasks = Array.isArray(tasks) ? [task, ...tasks] : [task];
    wx.setStorageSync(TASKS_STORAGE_KEY, nextTasks);

    const nextPayload = encodeURIComponent(
      JSON.stringify({
        ...mergedPayload,
        taskId,
        taskName: task.title,
        taskContent: task.content,
        dateValue: task.dateValue,
        statusText: task.statusText,
      }),
    );
    wx.redirectTo({
      url: `/pages/task-detail/index?payload=${nextPayload}&showSuccess=1`,
    });
  },
});
