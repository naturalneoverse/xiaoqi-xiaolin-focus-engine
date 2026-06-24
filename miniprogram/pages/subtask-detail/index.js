const subtask = require("../../utils/subtask");
const { requireLoginOnLoad } = require("../../utils/requireLogin");
const { TASK_CONTENT_MAX, TASK_NAME_MAX } = require("../../config/taskLimits");

const STATUS_OPTIONS = ["进行中", "已完成"];
function clampTextByLength(value, maxLength) {
  const chars = Array.from(value || "");
  if (chars.length <= maxLength) return value || "";
  return chars.slice(0, maxLength).join("");
}

function formatDateRangeText(startDate, endDate) {  if (!startDate) return "未设置";
  return endDate ? `${startDate} → ${endDate}` : startDate;
}

Page({
  data: {
    taskId: "",
    parentTaskId: "",
    parentTitle: "",
    taskName: "",
    taskContent: "",
    contentEditing: false,
    contentDraft: "",
    dateText: "",
    tags: [],
    statusText: "进行中",
    statusIndex: 0,
    statusOptions: STATUS_OPTIONS,
    taskContentMax: TASK_CONTENT_MAX,
    taskNameMax: TASK_NAME_MAX,
  },

  onLoad(options) {
    if (!requireLoginOnLoad()) return;
    const taskId = options && options.taskId ? decodeURIComponent(String(options.taskId)) : "";
    if (!taskId) {
      wx.showToast({ title: "缺少任务", icon: "none" });
      setTimeout(() => wx.navigateBack(), 400);
      return;
    }
    this.__taskId = taskId;
    this.loadTask();
  },

  onShow() {
    if (this.__taskId) this.loadTask();
  },

  loadTask() {
    const tasks = subtask.readTasks();
    const task = subtask.findTaskById(tasks, this.__taskId);
    if (!task || !subtask.isSubtask(task)) {
      wx.showToast({ title: "子任务不存在", icon: "none" });
      setTimeout(() => wx.navigateBack(), 400);
      return;
    }
    const parentTaskId = subtask.getParentTaskId(task);
    const parent = subtask.findTaskById(tasks, parentTaskId);
    const tagTexts = (task.tags || []).map((t) => (t && t.text) || "").filter(Boolean);
    const startDate = task.startDate || "";
    const endDate = task.endDate || "";
    const dateText =
      (startDate || endDate ? formatDateRangeText(startDate, endDate) : "") ||
      task.dateValue ||
      "未设置";
    const statusText = task.statusText === "已完成" ? "已完成" : "进行中";
    this.setData({
      taskId: task.id,
      parentTaskId,
      parentTitle: (parent && parent.title) || "未命名任务",
      taskName: task.title || "未命名",
      taskContent: task.content || "暂无描述",
      dateText,
      tags: tagTexts,
      statusText,
      statusIndex: statusText === "已完成" ? 1 : 0,
    });
  },

  goBack() {
    wx.navigateBack();
  },

  goParent() {
    const pid = this.data.parentTaskId;
    if (!pid) return;
    wx.redirectTo({
      url: `/pages/task-detail/index?taskId=${encodeURIComponent(pid)}`,
    });
  },

  onTaskNameInput(e) {
    const v = clampTextByLength((e.detail && e.detail.value) || "", TASK_NAME_MAX);
    this.setData({ taskName: v });
    this.persist({ title: v });
  },

  enterContentEdit() {
    this.setData({
      contentEditing: true,
      contentDraft: this.data.taskContent === "暂无描述" ? "" : this.data.taskContent,
    });
  },

  cancelContentEdit() {
    this.setData({ contentEditing: false, contentDraft: "" });
  },

  onContentDraftInput(e) {
    this.setData({ contentDraft: clampTextByLength((e.detail && e.detail.value) || "", TASK_CONTENT_MAX) });
  },

  saveContentEdit() {
    const content = String(this.data.contentDraft || "").trim() || "暂无描述";
    this.setData({ contentEditing: false, taskContent: content });
    this.persist({ content });
  },

  onStatusChange(e) {
    const idx = Number(e.detail.value);
    const statusText = STATUS_OPTIONS[idx] || "进行中";
    const patch = {
      statusText,
      done: statusText === "已完成",
      completedAt: statusText === "已完成" ? subtask.toCompletedAt() : "",
    };
    this.setData({ statusText, statusIndex: idx });
    this.persist(patch, true);
  },

  persist(patch, recountParent) {
    const r = subtask.updateSubtaskFields(this.data.taskId, patch, { recountParent });
    if (!r.ok) {
      wx.showToast({ title: r.message || "保存失败", icon: "none" });
    }
  },
  onDelete() {
    wx.showModal({
      title: "删除子任务",
      content: `确认删除「${this.data.taskName}」？`,
      confirmColor: "#12598f",
      success: (res) => {
        if (!res.confirm) return;
        const r = subtask.deleteSubtask(this.data.taskId);
        if (!r.ok) {
          wx.showToast({ title: r.message || "删除失败", icon: "none" });
          return;
        }
        wx.showToast({ title: "已删除", icon: "success" });
        setTimeout(() => wx.navigateBack(), 400);
      },
    });
  },
});
