/**
 * 提醒统一入口：权限、隐私与闹钟/日历回退均在 alarmService 内处理。此处按 scene 组参并管理 registry。
 */

const alarmService = require("./alarmService");
const reminderSchedule = require("./reminderSchedule");
const reminderRegistry = require("./reminderRegistry");

/** @typedef {'task'|'daily_report'|'weekly_report'|'check_in'|'body_record'|'daily_three'|'wake_up'} ReminderScene */

const REMINDER_SCENES = {
  TASK: "task",
  DAILY_REPORT: "daily_report",
  WEEKLY_REPORT: "weekly_report",
  CHECK_IN: "check_in",
  BODY_RECORD: "body_record",
  DAILY_THREE: "daily_three",
  WAKE_UP: "wake_up",
};

const RESERVED_SCENES = new Set([
  REMINDER_SCENES.DAILY_REPORT,
  REMINDER_SCENES.WEEKLY_REPORT,
  REMINDER_SCENES.CHECK_IN,
  REMINDER_SCENES.BODY_RECORD,
  REMINDER_SCENES.DAILY_THREE,
  REMINDER_SCENES.WAKE_UP,
]);

function buildTaskTitle(p) {
  const titleBase = (p.title && String(p.title).trim()) || "任务提醒";
  const freq = p.frequencyLabel ? String(p.frequencyLabel).trim() : "";
  return freq ? `${titleBase}（${freq}）` : titleBase;
}

function timeHHmmFromParams(hour, minute) {
  const h = Number(hour);
  const m = Number(minute);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function notifyManualCalendarCleanup() {
  try {
    wx.showToast({
      title: "请到系统日历手动删除旧提醒",
      icon: "none",
      duration: 3000,
    });
  } catch (e) {
    /* ignore */
  }
}

/**
 * @param {ReminderScene|string} scene
 * @param {{
 *   hour?: number,
 *   minute?: number,
 *   day?: string,
 *   startDate?: string,
 *   endDate?: string,
 *   title?: string,
 *   frequencyLabel?: string,
 *   taskId?: string,
 * }} params
 * @returns {Promise<boolean>}
 */
async function scheduleReminder(scene, params) {
  const p = params || {};
  try {
    if (scene === "task") {
      const freq = reminderSchedule.normalizeReminderFrequency(p.frequencyLabel);
      const title = buildTaskTitle(p);
      const taskId = String(p.taskId || "").trim();
      const startYMD = String(p.startDate || "").trim();
      const endYMD = String(p.endDate || p.startDate || "").trim();
      const timeHHmm = timeHHmmFromParams(p.hour, p.minute);

      if (freq === reminderSchedule.FREQ_DAILY && startYMD) {
        const scheduleParams = {
          startYMD,
          endYMD,
          hour: p.hour,
          minute: p.minute,
        };

        const prev = taskId ? reminderRegistry.getRecord(taskId) : null;
        if (prev && reminderRegistry.isSameSchedule(prev, scheduleParams)) {
          return true;
        }

        const hadPrevSchedule = !!prev;
        const version = (prev && prev.version ? prev.version : 0) + 1;
        const titleBase = (p.title && String(p.title).trim()) || "任务提醒";
        const result = await alarmService.scheduleDailyRange({
          startYMD,
          endYMD,
          hour: p.hour,
          minute: p.minute,
          title: titleBase,
          taskId,
          version,
        });

        if (result.ok && taskId) {
          reminderRegistry.saveRecord(taskId, {
            startYMD,
            endYMD,
            hour: p.hour,
            minute: p.minute,
            mode: result.mode,
            version,
            fingerprint: result.fingerprint,
            days: result.days,
          });
          if (hadPrevSchedule) notifyManualCalendarCleanup();
        }
        return !!result.ok;
      }

      if (freq === reminderSchedule.FREQ_START_END) {
        const days = reminderSchedule.computeStartEndPairReminderDays(startYMD, endYMD, timeHHmm);
        if (!days.length) {
          wx.showToast({ title: "区间内没有可设置的提醒时间", icon: "none" });
          return false;
        }
        return alarmService.scheduleAlarmDays(p.hour, p.minute, days, title);
      }

      const singleDay =
        reminderSchedule.computeSingleReminderDayYMD(startYMD, endYMD, timeHHmm) ||
        String(p.day || "").trim();
      if (!singleDay) {
        wx.showToast({ title: "区间内没有可设置的提醒时间", icon: "none" });
        return false;
      }
      return alarmService.scheduleAlarm(p.hour, p.minute, singleDay, title);
    }

    if (RESERVED_SCENES.has(String(scene || ""))) {
      wx.showToast({ title: "该场景提醒即将上线", icon: "none" });
      return false;
    }

    wx.showToast({ title: "该场景暂未接入提醒", icon: "none" });
    return false;
  } catch (e) {
    try {
      wx.showToast({ title: "提醒设置失败", icon: "none" });
    } catch (e2) {
      /* ignore */
    }
    return false;
  }
}

module.exports = {
  scheduleReminder,
  REMINDER_SCENES,
};
