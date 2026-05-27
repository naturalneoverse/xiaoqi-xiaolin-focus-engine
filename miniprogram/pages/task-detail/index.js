const STORAGE_KEYS = require("../../config/storageKeys");
const { requireLoginOnLoad } = require("../../utils/requireLogin");
const dailyCheckIn = require("../../utils/dailyCheckIn");
const mascotCopyClient = require("../../utils/mascotCopyClient");
const mascotCopyStats = require("../../utils/mascotCopyStats");
const { raceResolve, MASCOT_ENGINE_TIMEOUT_MS } = require("../../utils/raceResolve");
const { goSleepHome } = require("../../utils/goTabHome");
const reminderSchedule = require("../../utils/reminderSchedule");
const { formatCompanionBubbleLines } = require("../../utils/formatCompanionBubble");
const STATUS_OPTIONS = ["进行中", "已完成", "已延期", "已取消"];

/** 提交成功气泡：两行小麒模式（与副标题「小麒来为您庆祝啦」分工） */
const TASK_SUCCESS_LINE1 = "恭喜您完成全部选择～";
const TASK_SUCCESS_INTRO_CORE = "恭喜您完成全部选择";
const TASK_SUCCESS_LINE2_DEFAULT = "小麒陪你从当下这一刻开始，不必急着证明什么。";

/** 云端 taskReply.fullPrefix 已含祝贺语时，不再由前端重复拼接 */
function hasTaskSuccessIntro(text) {
  const s = String(text || "").trim();
  return s.indexOf(TASK_SUCCESS_INTRO_CORE) === 0;
}

function buildTaskSuccessBubble(secondLine) {
  const s = (secondLine || "").trim();
  if (!s) return `${TASK_SUCCESS_LINE1}\n${TASK_SUCCESS_LINE2_DEFAULT}`;
  if (s.indexOf(TASK_SUCCESS_LINE1) === 0 || hasTaskSuccessIntro(s)) return s;
  return `${TASK_SUCCESS_LINE1}\n${s}`;
}

function getStatusClass(statusText) {
  if (statusText === "已完成") return "status-value-completed";
  if (statusText === "已延期") return "status-value-delayed";
  if (statusText === "已取消") return "status-value-cancelled";
  return "";
}

/** 哲思复盘：除已取消外均可进入；不弹窗、不 Toast 引导 */
function canShowReflectionEntry(statusText) {
  return statusText !== "已取消";
}

function toCompletedAt() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function readTasksFromStorage() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEYS.TASKS_DATA);
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    return [];
  }
}

function findTaskById(taskId) {
  if (!taskId) return null;
  const tasks = readTasksFromStorage();
  return tasks.find((t) => t && t.id === taskId) || null;
}

/** 标签展示与 task_create 分类：why 优先取末项；兼容 { text } 与纯字符串 */
function taskCategoryFromTagTexts(tagTexts) {
  const arr = Array.isArray(tagTexts) ? tagTexts : [];
  const pick = (x) => {
    if (x == null) return "";
    if (typeof x === "object" && x.text) return String(x.text);
    return String(x);
  };
  return pick(arr[2]) || pick(arr[0]) || "未分类";
}

Page({
  data: {
    taskName: "未命名任务",
    taskContent: "暂无描述",
    dateText: "未设置",
    statusText: "进行中",
    statusOptions: STATUS_OPTIONS,
    statusIndex: 0,
    statusClass: "",
    taskId: "",
    reminderDate: "",
    reminderTime: "",
    reminderFrequency: "不重复",
    detailReminderFreqOptions: ["不重复", "每天"],
    detailReminderFreqIndex: 0,
    tags: [],
    showReflectionBtn: false,
    mascotAnimPaused: false,
    showMascotModal: false,
    /** 云端陪伴语拆行展示；有值时用圆角卡片，无值时用 chat-bubble */
    companionBubbleLines: null,
    xiaoqiImage: "/images/transparent background/xiaoqi.png",
    mascotBubbleText:
      "恭喜您完成全部选择～\n认真梳理轻重、对象与初心，\n慢慢理清生活的秩序感，\n每一次向内梳理，都是在好好爱自己。",
  },

  onLoad(options) {
    if (!requireLoginOnLoad()) return;
    const app = getApp();
    const imageAssets = (app && app.globalData && app.globalData.imageAssets) || {};
    const showSuccess = options && options.showSuccess === "1";
    const taskIdOpt = options && options.taskId ? decodeURIComponent(String(options.taskId)) : "";

    if (!taskIdOpt) {
      wx.showToast({ title: "请从任务列表打开", icon: "none" });
      setTimeout(() => goSleepHome(), 400);
      return;
    }

    const task = findTaskById(taskIdOpt);
    if (!task) {
      wx.showToast({ title: "任务不存在或已删除", icon: "none" });
      setTimeout(() => goSleepHome(), 400);
      return;
    }

    const statusText = task.statusText || "进行中";
    const tagTexts = (task.tags || []).map((t) => (t && t.text) || "").filter(Boolean);
    const dateText =
      task.dateValue ||
      (task.timeText ? String(task.timeText).split(" ")[0].replace(/\//g, "-") : "") ||
      "未设置";
    const rf = reminderSchedule.normalizeReminderFrequency(task.reminderFrequency);
    const rt = task.reminderTime || "";
    const rd = rt ? reminderSchedule.computeNextReminderDateYMD(rt) : "";
    this.setData({
      taskId: task.id,
      taskName: task.title || "未命名任务",
      taskContent: task.content || "暂无描述",
      dateText,
      statusText,
      showReflectionBtn: canShowReflectionEntry(statusText),
      statusIndex: Math.max(0, STATUS_OPTIONS.indexOf(statusText)),
      statusClass: getStatusClass(statusText),
      reminderDate: rd,
      reminderTime: rt,
      reminderFrequency: rf,
      detailReminderFreqIndex: rf === "每天" ? 1 : 0,
      tags: tagTexts,
      showMascotModal: showSuccess,
      xiaoqiImage: imageAssets.xiaoqi || "/images/transparent background/xiaoqi.png",
      mascotBubbleText: showSuccess
        ? buildTaskSuccessBubble(TASK_SUCCESS_LINE2_DEFAULT)
        : this.data.mascotBubbleText,
    });
    if (showSuccess) {
      this.applyCreateSuccessBubble(task, tagTexts);
    }
  },

  /**
   * 云端陪伴语：首句 / 前缀余下 / reply 分行，左对齐，原文不删减。
   * @returns {boolean} 是否已用拆行卡片展示
   */
  setCompanionBubbleDisplay(companionText) {
    const lines = formatCompanionBubbleLines(companionText);
    if (lines && lines.length) {
      this.setData({ companionBubbleLines: lines, mascotBubbleText: "" });
      return true;
    }
    this.setData({
      companionBubbleLines: null,
      mascotBubbleText: buildTaskSuccessBubble(companionText),
    });
    return false;
  },

  /** 优先展示 taskReply 个性化陪伴语；无则回退 mascotEngine */
  applyCreateSuccessBubble(task, tagTexts) {
    const companion = String((task && task.companionText) || "").trim();
    if (companion) {
      this.setCompanionBubbleDisplay(companion);
      return;
    }
    this.setData({ companionBubbleLines: null });
    this.loadCreateMascotTextFromCategory(tagTexts);
  },

  loadCreateMascotTextFromCategory(tagTexts) {
    const tasks = readTasksFromStorage();
    const taskCategory = taskCategoryFromTagTexts(tagTexts);
    const stats = mascotCopyStats.buildTaskCreateStats(tasks, taskCategory);
    const localLine = mascotCopyClient.composeLocalCopy("task_create", stats).text;
    this.setData({
      companionBubbleLines: null,
      mascotBubbleText: buildTaskSuccessBubble(localLine || TASK_SUCCESS_LINE2_DEFAULT),
    });
    raceResolve(
      mascotCopyClient.fetchMascotCopy("task_create", stats),
      MASCOT_ENGINE_TIMEOUT_MS,
    )
      .then((res) => {
        if (!res) return;
        if (res.infraError) {
          this.setData({
            companionBubbleLines: null,
            mascotBubbleText: buildTaskSuccessBubble(TASK_SUCCESS_LINE2_DEFAULT),
          });
          return;
        }
        this.setData({
          companionBubbleLines: null,
          mascotBubbleText: buildTaskSuccessBubble(res.text),
        });
      })
      .catch((e) => {
        console.error("task-detail task_create mascot", e);
      });
  },

  onStatusChange(e) {
    const index = Number(e.detail.value);
    const nextStatus = STATUS_OPTIONS[index] || STATUS_OPTIONS[0];
    const hadReminder = !!this.data.reminderTime;
    const clearReminder = nextStatus === "已完成" || nextStatus === "已取消";
    const nextReminderDate = clearReminder ? "" : this.data.reminderDate;
    const nextReminderTime = clearReminder ? "" : this.data.reminderTime;
    const nextReminderFrequency = clearReminder ? "不重复" : this.data.reminderFrequency;
    const nextFreqIndex = clearReminder ? 0 : nextReminderFrequency === "每天" ? 1 : 0;

    this.setData({
      statusText: nextStatus,
      showReflectionBtn: !!this.data.taskId && canShowReflectionEntry(nextStatus),
      statusIndex: index,
      statusClass: getStatusClass(nextStatus),
      reminderDate: nextReminderDate,
      reminderTime: nextReminderTime,
      reminderFrequency: nextReminderFrequency,
      detailReminderFreqIndex: nextFreqIndex,
    });
    if (clearReminder && hadReminder) {
      wx.showToast({
        title: "任务已结束，提醒已停止",
        icon: "none",
      });
    }
    this.persistStatus(nextStatus, {
      reminderDate: nextReminderDate,
      reminderTime: nextReminderTime,
      reminderFrequency: nextReminderFrequency,
    });
  },

  persistStatus(nextStatus, reminderFields) {
    const { taskId } = this.data;
    if (!taskId) {
      wx.showToast({ title: "无法保存：缺少任务标识", icon: "none" });
      return;
    }
    const rf = reminderFields || {
      reminderDate: this.data.reminderDate,
      reminderTime: this.data.reminderTime,
      reminderFrequency: this.data.reminderFrequency,
    };
    let tasks = [];
    try {
      const raw = wx.getStorageSync(STORAGE_KEYS.TASKS_DATA);
      tasks = Array.isArray(raw) ? raw : [];
    } catch (err) {
      console.error("persistStatus getStorageSync", err);
      return;
    }
    const nextTasks = tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            statusText: nextStatus,
            done: nextStatus === "已完成",
            completedAt: nextStatus === "已完成" ? toCompletedAt() : "",
            reminderDate: rf.reminderDate,
            reminderTime: rf.reminderTime,
            reminderFrequency: rf.reminderFrequency,
            updatedAt: Date.now(),
          }
        : task,
    );
    try {
      wx.setStorageSync(STORAGE_KEYS.TASKS_DATA, nextTasks);
      dailyCheckIn.recordDailyCheckIn();
    } catch (err) {
      console.error("persistStatus setStorageSync", err);
      wx.showToast({ title: "保存失败", icon: "none" });
      return;
    }
    try {
      const saved = nextTasks.find((t) => t && t.id === taskId) || null;
      if (saved) {
        const cloudDataSync = require("../../utils/cloudDataSync");
        cloudDataSync.afterTaskSaved(saved);
      }
    } catch (e) {
      console.warn("[task-detail] cloudDataSync", e);
    }
  },

  onDetailReminderTimeChange(e) {
    const reminderTime = (e.detail && e.detail.value) || "";
    const reminderDate = reminderTime ? reminderSchedule.computeNextReminderDateYMD(reminderTime) : "";
    this.setData({ reminderTime, reminderDate });
    this.persistStatus(this.data.statusText, {
      reminderDate,
      reminderTime,
      reminderFrequency: this.data.reminderFrequency,
    });
  },

  onDetailReminderFreqChange(e) {
    const idx = Number(e.detail.value);
    const opts = this.data.detailReminderFreqOptions || ["不重复", "每天"];
    const reminderFrequency = opts[idx] || "不重复";
    const reminderDate = this.data.reminderTime
      ? reminderSchedule.computeNextReminderDateYMD(this.data.reminderTime)
      : "";
    this.setData({
      reminderFrequency,
      detailReminderFreqIndex: idx,
      reminderDate,
    });
    this.persistStatus(this.data.statusText, {
      reminderDate,
      reminderTime: this.data.reminderTime,
      reminderFrequency,
    });
  },

  goReflection() {
    const { taskId, taskName, statusText } = this.data;
    if (!taskId || !canShowReflectionEntry(statusText)) return;
    wx.navigateTo({
      url: `/subpkg/reflection-select/index?taskId=${encodeURIComponent(taskId)}&taskTitle=${encodeURIComponent(taskName || "")}`,
    });
  },

  closeMascotModal() {
    this.setData({
      showMascotModal: false,
    });
  },

  /** 自定义顶栏关闭：回「时间」Tab（创建成功经 reLaunch 进详情，无系统返回键） */
  goHome() {
    goSleepHome();
  },

  // Defensive handlers: avoid runtime crash if stale WXML binds old events.
  toggleAgree() {},

  onLoginTap() {},

  noop() {},
});
