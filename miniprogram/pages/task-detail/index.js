const STORAGE_KEYS = require("../../config/storageKeys");
const { TASK_CONTENT_MAX } = require("../../config/taskLimits");
const { requireLoginOnLoad } = require("../../utils/requireLogin");
const dailyCheckIn = require("../../utils/dailyCheckIn");
const mascotCopyClient = require("../../utils/mascotCopyClient");
const mascotCopyStats = require("../../utils/mascotCopyStats");
const { raceResolve, MASCOT_ENGINE_TIMEOUT_MS } = require("../../utils/raceResolve");
const { goSleepHome } = require("../../utils/goTabHome");
const reminderSchedule = require("../../utils/reminderSchedule");
const { scheduleReminder } = require("../../utils/reminderManager");
const deviceEnv = require("../../utils/deviceEnv");
const alarmService = require("../../utils/alarmService");
const speechRecognition = require("../../utils/speechRecognition");
const { formatCompanionBubbleLines } = require("../../utils/formatCompanionBubble");
const STATUS_OPTIONS = ["进行中", "已完成", "已延期", "已取消"];
const { REMINDER_FREQ_OPTIONS, FREQ_SINGLE } = reminderSchedule;

/** 提交成功气泡：两行小麒模式（与副标题「小麒来为您庆祝啦」分工） */
const TASK_SUCCESS_LINE1 = "恭喜您完成全部选择～";
const TASK_SUCCESS_INTRO_CORE = "恭喜您完成全部选择";
const TASK_SUCCESS_LINE2_DEFAULT = "小麒陪您从当下这一刻开始，不必急着证明什么。";

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
  return readTasksFromStorage().find((t) => t && t.id === taskId) || null;
}

function getTextLength(value) {
  return Array.from(String(value || "")).length;
}

function clampTextByLength(value, maxLength) {
  const chars = Array.from(value || "");
  if (chars.length <= maxLength) return value || "";
  return chars.slice(0, maxLength).join("");
}

function contentDisplayFromSaved(saved) {
  const t = String(saved || "").trim();
  return t || "暂无描述";
}

function resolveReminderDateRange(task) {
  const startDate = String((task && task.startDate) || "").trim();
  const endDate = String((task && task.endDate) || "").trim();
  const dateValue = String((task && task.dateValue) || "").trim();
  const fallback =
    dateValue && dateValue !== "未设置"
      ? dateValue
      : task && task.timeText
        ? String(task.timeText).split(" ")[0].replace(/\//g, "-")
        : "";
  return {
    startDate: startDate || fallback,
    endDate: endDate || "",
  };
}

function buildReminderPreviewFields(fields) {
  const preview = reminderSchedule.computeReminderPreview(
    fields.reminderStartDate,
    fields.reminderEndDate,
    fields.reminderTime,
    fields.reminderFrequency,
    fields.statusText,
  );
  return {
    reminderDate: preview.days[0] || "",
    nextReminderLabel: preview.label,
    reminderSummaryLine: reminderSchedule.formatReminderSummaryLine(fields),
  };
}

function contentNeedsExpandToggle(text) {
  const s = String(text || "").trim();
  if (!s || s === "暂无描述") return false;
  if (s.split(/\n/).length > 3) return true;
  return Array.from(s).length > 72;
}

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
    savedTaskContent: "",
    contentDisplayText: "暂无描述",
    contentExpanded: false,
    contentShowExpandToggle: false,
    contentEditing: false,
    contentEditingFocus: false,
    contentDraft: "",
    contentDraftLength: 0,
    taskContentMax: TASK_CONTENT_MAX,
    speechRecordingTarget: "",
    speechContentMicDisabled: false,
    dateText: "未设置",
    statusText: "进行中",
    statusOptions: STATUS_OPTIONS,
    statusIndex: 0,
    statusClass: "",
    taskId: "",
    reminderStartDate: "",
    reminderEndDate: "",
    reminderDate: "",
    reminderTime: "",
    reminderFrequency: FREQ_SINGLE,
    nextReminderLabel: "",
    reminderSummaryLine: "提醒：未设置",
    reminderExpanded: false,
    reminderCalendarSubmitting: false,
    detailReminderFreqOptions: REMINDER_FREQ_OPTIONS,
    detailReminderFreqIndex: 0,
    tags: [],
    showReflectionBtn: false,
    mascotAnimPaused: false,
    showMascotModal: false,
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

    const range = resolveReminderDateRange(task);
    const statusText = task.statusText || "进行中";
    const tagTexts = (task.tags || []).map((t) => (t && t.text) || "").filter(Boolean);
    const dateText =
      task.dateValue ||
      (task.timeText ? String(task.timeText).split(" ")[0].replace(/\//g, "-") : "") ||
      "未设置";
    const rf = reminderSchedule.normalizeReminderFrequency(task.reminderFrequency);
    const rt = task.reminderTime || "";
    const previewExtra = buildReminderPreviewFields({
      reminderStartDate: range.startDate,
      reminderEndDate: range.endDate,
      reminderTime: rt,
      reminderFrequency: rf,
      statusText,
    });
    const savedContent = task.content != null ? String(task.content) : "";
    const contentDisplayText = contentDisplayFromSaved(savedContent);
    this.setData({
      taskId: task.id,
      taskName: task.title || "未命名任务",
      taskContent: contentDisplayText,
      savedTaskContent: savedContent,
      contentDisplayText,
      contentExpanded: false,
      contentShowExpandToggle: contentNeedsExpandToggle(contentDisplayText),
      dateText,
      statusText,
      showReflectionBtn: canShowReflectionEntry(statusText),
      statusIndex: Math.max(0, STATUS_OPTIONS.indexOf(statusText)),
      statusClass: getStatusClass(statusText),
      reminderStartDate: range.startDate,
      reminderEndDate: range.endDate,
      reminderDate: previewExtra.reminderDate,
      reminderTime: rt,
      reminderFrequency: rf,
      detailReminderFreqIndex: reminderSchedule.reminderFrequencyIndex(rf),
      nextReminderLabel: previewExtra.nextReminderLabel,
      reminderSummaryLine: previewExtra.reminderSummaryLine,
      reminderExpanded: false,
      tags: tagTexts,
      showMascotModal: showSuccess,
      xiaoqiImage: imageAssets.xiaoqi || "/images/transparent background/xiaoqi.png",
      mascotBubbleText: showSuccess
        ? buildTaskSuccessBubble(TASK_SUCCESS_LINE2_DEFAULT)
        : this.data.mascotBubbleText,
      ...this._syncSpeechMicState({ contentDraftLength: getTextLength(savedContent) }),
    });
    if (showSuccess) {
      this.applyCreateSuccessBubble(task, tagTexts);
    }
  },

  onShow() {
    speechRecognition.prepare();
    speechRecognition.warmUp().catch(() => {});
    if (!deviceEnv.isDesktopWechat()) {
      alarmService.warmCalendarSession().catch(() => {});
    }
  },

  onHide() {
    speechRecognition.abort();
  },

  onUnload() {
    speechRecognition.abort();
  },

  _syncSpeechMicState(patch) {
    const data = Object.assign({}, this.data, patch || {});
    const rec = data.speechRecordingTarget || "";
    return {
      speechContentMicDisabled:
        !data.contentEditing ||
        rec === "content" ||
        data.contentDraftLength >= data.taskContentMax,
    };
  },

  isContentDirty() {
    if (!this.data.contentEditing) return false;
    return String(this.data.contentDraft || "") !== String(this.data.savedTaskContent || "");
  },

  enterContentEdit() {
    const draft = this.data.savedTaskContent || "";
    this.setData(
      Object.assign(
        {
          contentEditing: true,
          contentEditingFocus: true,
          contentExpanded: true,
          contentDraft: draft,
          contentDraftLength: getTextLength(draft),
        },
        this._syncSpeechMicState({ contentEditing: true, contentDraftLength: getTextLength(draft) }),
      ),
    );
  },

  toggleContentExpand() {
    this.setData({ contentExpanded: !this.data.contentExpanded });
  },

  toggleReminderExpand() {
    const next = !this.data.reminderExpanded;
    this.setData({ reminderExpanded: next });
    if (next && !deviceEnv.isDesktopWechat()) {
      alarmService.warmCalendarSession().catch(() => {});
    }
  },

  cancelContentEdit() {
    speechRecognition.abort();
    const contentDisplayText = contentDisplayFromSaved(this.data.savedTaskContent);
    this.setData(
      Object.assign(
        {
          contentEditing: false,
          contentEditingFocus: false,
          contentExpanded: false,
          contentDraft: "",
          contentDraftLength: 0,
          speechRecordingTarget: "",
          contentDisplayText,
          contentShowExpandToggle: contentNeedsExpandToggle(contentDisplayText),
        },
        this._syncSpeechMicState({
          contentEditing: false,
          contentDraftLength: 0,
          speechRecordingTarget: "",
        }),
      ),
    );
  },

  onContentDraftInput(e) {
    const contentDraft = (e.detail && e.detail.value) != null ? String(e.detail.value) : "";
    const contentDraftLength = getTextLength(contentDraft);
    this.setData(
      Object.assign({ contentDraft, contentDraftLength }, this._syncSpeechMicState({ contentDraftLength })),
    );
  },

  appendSpeechToContentDraft(text) {
    const merged = `${this.data.contentDraft || ""}${text}`;
    const next = clampTextByLength(merged, TASK_CONTENT_MAX);
    const contentDraftLength = getTextLength(next);
    this.setData(
      Object.assign({ contentDraft: next, contentDraftLength }, this._syncSpeechMicState({ contentDraftLength })),
    );
  },

  _speechFieldFromEvent(e) {
    return (e.currentTarget.dataset && e.currentTarget.dataset.field) || "";
  },

  _onSpeechAutoEnd(field, result) {
    this.setData(
      Object.assign(
        { speechRecordingTarget: "" },
        this._syncSpeechMicState({ speechRecordingTarget: "" }),
      ),
    );
    if (result && result.ok && result.text && field === "content") {
      this.appendSpeechToContentDraft(result.text);
    }
  },

  onSpeechLongPress(e) {
    const field = this._speechFieldFromEvent(e);
    if (field !== "content" || !this.data.contentEditing) return;
    if (this.data.contentDraftLength >= TASK_CONTENT_MAX) {
      wx.showToast({ title: speechRecognition.TOAST_CONTENT_FULL, icon: "none" });
      return;
    }
    if (this.data.speechRecordingTarget) return;
    speechRecognition
      .start(field, (result) => this._onSpeechAutoEnd(field, result))
      .then((started) => {
        if (!started) return;
        this.setData(
          Object.assign(
            { speechRecordingTarget: field },
            this._syncSpeechMicState({ speechRecordingTarget: field }),
          ),
        );
      })
      .catch(() => {});
  },

  onSpeechTouchEnd(e) {
    const field = this._speechFieldFromEvent(e);
    if (!speechRecognition.hasActiveSession()) return;
    speechRecognition.stopForField(field) || speechRecognition.stopActive();
  },

  saveContentEdit(opts) {
    const silent = !!(opts && opts.silent);
    const { contentDraft, taskContentMax } = this.data;
    if (getTextLength(contentDraft) > taskContentMax) {
      if (!silent) wx.showToast({ title: "字数超限", icon: "none" });
      return false;
    }
    const nextContent = String(contentDraft || "");
    const ok = this.persistTaskUpdates({ content: nextContent }, { scheduleReminder: false });
    if (!ok) return false;
    speechRecognition.abort();
    const contentDisplayText = contentDisplayFromSaved(nextContent);
    this.setData(
      Object.assign(
        {
          contentEditing: false,
          contentEditingFocus: false,
          contentExpanded: false,
          savedTaskContent: nextContent,
          contentDisplayText,
          contentShowExpandToggle: contentNeedsExpandToggle(contentDisplayText),
          contentDraft: "",
          contentDraftLength: 0,
          taskContent: contentDisplayText,
          speechRecordingTarget: "",
        },
        this._syncSpeechMicState({
          contentEditing: false,
          contentDraftLength: 0,
          speechRecordingTarget: "",
        }),
      ),
    );
    if (!silent) wx.showToast({ title: "已保存", icon: "success" });
    return true;
  },

  promptUnsavedContent(action) {
    const labels =
      action === "reflection"
        ? ["保存并进入", "放弃修改", "继续编辑"]
        : ["保存并离开", "放弃修改", "继续编辑"];
    wx.showActionSheet({
      itemList: labels,
      success: (res) => {
        const idx = res.tapIndex;
        if (idx === 0) {
          if (!this.saveContentEdit()) return;
          if (action === "reflection") this.navigateReflection();
          else goSleepHome();
        } else if (idx === 1) {
          this.cancelContentEdit();
          if (action === "reflection") this.navigateReflection();
          else goSleepHome();
        }
      },
    });
  },

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
    raceResolve(mascotCopyClient.fetchMascotCopy("task_create", stats), MASCOT_ENGINE_TIMEOUT_MS)
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

  _reminderPatchFromData(extra) {
    const d = this.data;
    const preview = buildReminderPreviewFields({
      reminderStartDate: extra.reminderStartDate != null ? extra.reminderStartDate : d.reminderStartDate,
      reminderEndDate: extra.reminderEndDate != null ? extra.reminderEndDate : d.reminderEndDate,
      reminderTime: extra.reminderTime != null ? extra.reminderTime : d.reminderTime,
      reminderFrequency: extra.reminderFrequency != null ? extra.reminderFrequency : d.reminderFrequency,
      statusText: extra.statusText != null ? extra.statusText : d.statusText,
    });
    return {
      startDate: extra.reminderStartDate != null ? extra.reminderStartDate : d.reminderStartDate,
      endDate: extra.reminderEndDate != null ? extra.reminderEndDate : d.reminderEndDate,
      reminderTime: extra.reminderTime != null ? extra.reminderTime : d.reminderTime,
      reminderFrequency: extra.reminderFrequency != null ? extra.reminderFrequency : d.reminderFrequency,
      reminderDate: preview.reminderDate,
    };
  },

  onStatusChange(e) {
    const index = Number(e.detail.value);
    const nextStatus = STATUS_OPTIONS[index] || STATUS_OPTIONS[0];
    const hadReminder = !!this.data.reminderTime;
    const clearReminder = nextStatus === "已完成" || nextStatus === "已取消";
    const nextReminderTime = clearReminder ? "" : this.data.reminderTime;
    const nextReminderFrequency = clearReminder ? FREQ_SINGLE : this.data.reminderFrequency;
    const previewExtra = buildReminderPreviewFields({
      reminderStartDate: this.data.reminderStartDate,
      reminderEndDate: this.data.reminderEndDate,
      reminderTime: nextReminderTime,
      reminderFrequency: nextReminderFrequency,
      statusText: nextStatus,
    });

    this.setData({
      statusText: nextStatus,
      showReflectionBtn: !!this.data.taskId && canShowReflectionEntry(nextStatus),
      statusIndex: index,
      statusClass: getStatusClass(nextStatus),
      reminderTime: nextReminderTime,
      reminderFrequency: nextReminderFrequency,
      detailReminderFreqIndex: reminderSchedule.reminderFrequencyIndex(nextReminderFrequency),
      reminderDate: previewExtra.reminderDate,
      nextReminderLabel: previewExtra.nextReminderLabel,
      reminderSummaryLine: previewExtra.reminderSummaryLine,
    });
    if (clearReminder && hadReminder) {
      wx.showToast({ title: "任务已结束，提醒已停止", icon: "none" });
    }
    this.persistTaskUpdates(
      {
        statusText: nextStatus,
        done: nextStatus === "已完成",
        completedAt: nextStatus === "已完成" ? toCompletedAt() : "",
        ...this._reminderPatchFromData({
          reminderTime: nextReminderTime,
          reminderFrequency: nextReminderFrequency,
          statusText: nextStatus,
        }),
      },
      { scheduleReminder: false },
    );
  },

  persistTaskUpdates(patch, options) {
    const opts = options || {};
    const { taskId } = this.data;
    if (!taskId) {
      wx.showToast({ title: "无法保存：缺少任务标识", icon: "none" });
      return false;
    }
    let tasks = [];
    try {
      tasks = readTasksFromStorage();
    } catch (err) {
      console.error("persistTaskUpdates getStorageSync", err);
      return false;
    }
    let saved = null;
    const nextTasks = tasks.map((task) => {
      if (task.id !== taskId) return task;
      const merged = { ...task, ...patch, updatedAt: Date.now() };
      if (patch.statusText != null) {
        merged.statusText = patch.statusText;
        merged.done = patch.done != null ? patch.done : patch.statusText === "已完成";
        if (patch.statusText === "已完成") {
          merged.completedAt = patch.completedAt || toCompletedAt();
        } else if (patch.completedAt === "") {
          merged.completedAt = "";
        }
      }
      saved = merged;
      return merged;
    });
    try {
      wx.setStorageSync(STORAGE_KEYS.TASKS_DATA, nextTasks);
      dailyCheckIn.recordDailyCheckIn();
    } catch (err) {
      console.error("persistTaskUpdates setStorageSync", err);
      wx.showToast({ title: "保存失败", icon: "none" });
      return false;
    }
    try {
      if (saved) {
        const cloudDataSync = require("../../utils/cloudDataSync");
        cloudDataSync.afterTaskSaved(saved);
        if (opts.scheduleReminder !== false) {
          this.maybeScheduleTaskReminder(saved);
        }
      }
    } catch (e) {
      console.warn("[task-detail] cloudDataSync", e);
    }
    return true;
  },

  validateReminderScheduleInput(state) {
    const reminderTime = state.reminderTime;
    if (!reminderTime) return { ok: true };
    const parts = String(reminderTime).split(":");
    const hour = Number(parts[0]);
    const minute = Number(parts[1]);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
      wx.showToast({ title: "时间格式无效", icon: "none" });
      return { ok: false };
    }
    const freq = reminderSchedule.normalizeReminderFrequency(state.reminderFrequency);
    const startDate = String(state.reminderStartDate || "").trim();
    const endDate = String(state.reminderEndDate || "").trim();
    if (!startDate) {
      wx.showToast({ title: "请先选择起始日期", icon: "none" });
      return { ok: false };
    }
    if (freq === reminderSchedule.FREQ_DAILY || freq === reminderSchedule.FREQ_START_END) {
      if (!endDate) {
        wx.showToast({ title: "请先选择结束日期", icon: "none" });
        return { ok: false };
      }
      if (endDate < startDate) {
        wx.showToast({ title: "结束日期不能早于起始日期", icon: "none" });
        return { ok: false };
      }
    }
    const preview = reminderSchedule.computeReminderPreview(
      startDate,
      endDate,
      reminderTime,
      freq,
      state.statusText,
    );
    if (!preview.days.length) {
      wx.showToast({ title: "区间内没有可设置的提醒时间", icon: "none" });
      return { ok: false };
    }
    return {
      ok: true,
      hour,
      minute,
      freq,
      startDate,
      endDate,
      preview,
    };
  },

  maybeScheduleTaskReminder(task) {
    if (!task || !task.reminderTime) return Promise.resolve(true);
    if (task.statusText === "已完成" || task.statusText === "已取消") return Promise.resolve(true);

    const check = this.validateReminderScheduleInput({
      reminderTime: task.reminderTime,
      reminderFrequency: task.reminderFrequency,
      reminderStartDate: task.startDate,
      reminderEndDate: task.endDate,
      statusText: task.statusText,
    });
    if (!check.ok) return Promise.resolve(false);

    const finishLocal = () => {
      const preview = check.preview;
      const summaryFields = {
        reminderStartDate: check.startDate,
        reminderEndDate: check.endDate,
        reminderTime: task.reminderTime,
        reminderFrequency: task.reminderFrequency,
        statusText: task.statusText,
      };
      this.setData({
        reminderDate: preview.days[0] || "",
        nextReminderLabel: preview.label,
        reminderSummaryLine: reminderSchedule.formatReminderSummaryLine(summaryFields),
      });
    };

    if (deviceEnv.isDesktopWechat()) {
      finishLocal();
      deviceEnv.showMobileOnlyModal({ feature: "日历提醒" });
      return Promise.resolve(true);
    }

    if (this._reminderScheduling) {
      this._pendingReminderTask = task;
      return Promise.resolve(false);
    }
    this._reminderScheduling = true;
    const titleBase = `${String(task.title || "").trim() || "任务"} 提醒`;
    return scheduleReminder("task", {
      hour: check.hour,
      minute: check.minute,
      day: check.preview.days[0] || "",
      startDate: check.startDate,
      endDate: check.endDate || check.startDate,
      taskId: task.id,
      title: titleBase,
      frequencyLabel: check.freq,
    })
      .then((ok) => {
        if (ok) finishLocal();
        return ok;
      })
      .catch(() => false)
      .then((ok) => {
        this._reminderScheduling = false;
        const pending = this._pendingReminderTask;
        this._pendingReminderTask = null;
        if (pending) {
          return this.maybeScheduleTaskReminder(pending).then((nextOk) => ok || nextOk);
        }
        return ok;
      });
  },

  _applyReminderFieldChange(extra) {
    const merged = {
      reminderStartDate: extra.reminderStartDate != null ? extra.reminderStartDate : this.data.reminderStartDate,
      reminderEndDate: extra.reminderEndDate != null ? extra.reminderEndDate : this.data.reminderEndDate,
      reminderTime: extra.reminderTime != null ? extra.reminderTime : this.data.reminderTime,
      reminderFrequency: extra.reminderFrequency != null ? extra.reminderFrequency : this.data.reminderFrequency,
      statusText: this.data.statusText,
    };
    const previewExtra = buildReminderPreviewFields(merged);
    const patch = this._reminderPatchFromData(extra);
    this.setData(
      Object.assign(
        {
          reminderStartDate: merged.reminderStartDate,
          reminderEndDate: merged.reminderEndDate,
          reminderTime: merged.reminderTime,
          reminderFrequency: merged.reminderFrequency,
          detailReminderFreqIndex: reminderSchedule.reminderFrequencyIndex(merged.reminderFrequency),
          reminderDate: previewExtra.reminderDate,
          nextReminderLabel: previewExtra.nextReminderLabel,
          reminderSummaryLine: previewExtra.reminderSummaryLine,
        },
        extra.detailReminderFreqIndex != null ? { detailReminderFreqIndex: extra.detailReminderFreqIndex } : {},
      ),
    );
    this.persistTaskUpdates(patch, { scheduleReminder: false });
  },

  confirmDetailReminderCalendar() {
    if (this.data.statusText === "已完成" || this.data.statusText === "已取消") return;
    if (this._reminderScheduling || this.data.reminderCalendarSubmitting) return;

    const merged = {
      reminderStartDate: this.data.reminderStartDate,
      reminderEndDate: this.data.reminderEndDate,
      reminderTime: this.data.reminderTime,
      reminderFrequency: this.data.reminderFrequency,
      statusText: this.data.statusText,
    };
    if (!merged.reminderTime) {
      wx.showToast({ title: "请先选择提醒时间", icon: "none" });
      return;
    }
    const check = this.validateReminderScheduleInput(merged);
    if (!check.ok) return;

    const patch = this._reminderPatchFromData({});
    this.persistTaskUpdates(patch, { scheduleReminder: false });

    this.setData({ reminderCalendarSubmitting: true });
    return this.maybeScheduleTaskReminder({
      id: this.data.taskId,
      title: this.data.taskName,
      reminderTime: merged.reminderTime,
      reminderFrequency: merged.reminderFrequency,
      startDate: check.startDate,
      endDate: check.endDate,
      statusText: merged.statusText,
    })
      .catch(() => false)
      .then((ok) => {
        this.setData({ reminderCalendarSubmitting: false });
        return ok;
      });
  },

  onDetailReminderStartChange(e) {
    const reminderStartDate = (e.detail && e.detail.value) || "";
    let reminderEndDate = this.data.reminderEndDate;
    if (reminderEndDate && reminderStartDate && reminderEndDate < reminderStartDate) {
      reminderEndDate = "";
    }
    this._applyReminderFieldChange({ reminderStartDate, reminderEndDate });
  },

  onDetailReminderEndChange(e) {
    const reminderEndDate = (e.detail && e.detail.value) || "";
    this._applyReminderFieldChange({ reminderEndDate });
  },

  clearReminderEndDate() {
    this._applyReminderFieldChange({ reminderEndDate: "" });
  },

  onDetailReminderTimeChange(e) {
    const reminderTime = (e.detail && e.detail.value) || "";
    this._applyReminderFieldChange({ reminderTime });
  },

  onDetailReminderFreqChange(e) {
    const idx = Number(e.detail.value);
    const reminderFrequency = REMINDER_FREQ_OPTIONS[idx] || FREQ_SINGLE;
    this._applyReminderFieldChange({ reminderFrequency, detailReminderFreqIndex: idx });
  },

  navigateReflection() {
    const { taskId, taskName } = this.data;
    wx.navigateTo({
      url: `/subpkg/reflection-select/index?taskId=${encodeURIComponent(taskId)}&taskTitle=${encodeURIComponent(taskName || "")}`,
    });
  },

  goReflection() {
    const { taskId, statusText } = this.data;
    if (!taskId || !canShowReflectionEntry(statusText)) return;
    if (this.isContentDirty()) {
      this.promptUnsavedContent("reflection");
      return;
    }
    this.navigateReflection();
  },

  closeMascotModal() {
    this.setData({ showMascotModal: false });
  },

  goHome() {
    if (this.isContentDirty()) {
      this.promptUnsavedContent("leave");
      return;
    }
    goSleepHome();
  },

  toggleAgree() {},

  onLoginTap() {},

  noop() {},
});
