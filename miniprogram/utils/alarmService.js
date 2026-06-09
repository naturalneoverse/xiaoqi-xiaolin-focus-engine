/**
 * 日历提醒：单次 setAlarmClock / addPhoneCalendar；区间内「每天」走 addPhoneRepeatCalendar 或逐日队列。
 * 仅在日历成功写入后 toast，并在其后弹一次「开启日历通知」温馨提示。
 */

const alarmPermission = require("./alarmPermission");
const reminderSchedule = require("./reminderSchedule");
const { showCalendarNotifyGuideModal } = require("./calendarNotifyGuide");
const deviceEnv = require("./deviceEnv");

const CAL_DESCRIPTION = "由小麒小麟专注引擎创建";
const MAX_RANGE_DAYS = 90;
const BATCH_GAP_MS = 350;

function toast(title, icon) {
  const t = (title && String(title).trim()) || "操作失败";
  try {
    wx.showToast({
      title: t.length > 20 ? `${t.slice(0, 20)}…` : t,
      icon: icon === "success" ? "success" : "none",
    });
  } catch (e) {
    /* ignore */
  }
}

function buildCalDescription(taskId, version) {
  const id = String(taskId || "").trim() || "unknown";
  const v = Number(version) > 0 ? Number(version) : 1;
  return `${CAL_DESCRIPTION} | taskId=${id} | v${v}`;
}

function ensurePrivacyAuthorizeIfNeeded() {
  return new Promise((resolve) => {
    try {
      if (typeof wx.requirePrivacyAuthorize !== "function") {
        resolve(true);
        return;
      }
      wx.requirePrivacyAuthorize({
        success: () => resolve(true),
        fail: () => {
          try {
            wx.showToast({ title: "请先同意隐私保护指引", icon: "none" });
          } catch (e2) {
            /* ignore */
          }
          resolve(false);
        },
      });
    } catch (e) {
      resolve(true);
    }
  });
}

async function ensureCalendarReady() {
  if (deviceEnv.isDesktopWechat()) {
    await deviceEnv.showMobileOnlyModal({ feature: "日历提醒" });
    return false;
  }
  const privOk = await ensurePrivacyAuthorizeIfNeeded();
  if (!privOk) return false;
  return alarmPermission.ensureAddPhoneCalendarPermission();
}

/**
 * @param {string} safeTitle
 * @param {number} startSec
 * @param {string} [description]
 * @returns {Promise<{ ok: boolean, err?: object }>}
 */
function addPhoneCalendarOnce(safeTitle, startSec, description) {
  return new Promise((resolve) => {
    let settled = false;
    try {
      wx.addPhoneCalendar({
        title: safeTitle,
        startTime: startSec,
        alarm: true,
        alarmOffset: 0,
        description: description || CAL_DESCRIPTION,
        allDay: false,
        success: () => {
          if (settled) return;
          settled = true;
          resolve({ ok: true });
        },
        fail: (err) => {
          if (settled) return;
          settled = true;
          resolve({ ok: false, err });
        },
      });
    } catch (e) {
      if (settled) return;
      settled = true;
      resolve({ ok: false, err: e });
    }
  });
}

/**
 * @param {{ title: string, startTimeSec: number, repeatEndTimeSec: number, description: string }}
 */
function addPhoneRepeatCalendarOnce(opts) {
  return new Promise((resolve) => {
    let settled = false;
    try {
      wx.addPhoneRepeatCalendar({
        title: opts.title,
        startTime: opts.startTimeSec,
        repeatInterval: "day",
        repeatEndTime: opts.repeatEndTimeSec,
        alarm: true,
        alarmOffset: 0,
        description: opts.description,
        allDay: false,
        success: () => {
          if (settled) return;
          settled = true;
          resolve({ ok: true });
        },
        fail: (err) => {
          if (settled) return;
          settled = true;
          resolve({ ok: false, err });
        },
      });
    } catch (e) {
      if (settled) return;
      settled = true;
      resolve({ ok: false, err: e });
    }
  });
}

function scheduleModalAfterToast() {
  const run = () => showCalendarNotifyGuideModal();
  if (typeof wx.nextTick === "function") {
    wx.nextTick(run);
  } else {
    setTimeout(run, 0);
  }
}

function finishRangeSuccess(total) {
  toast(total > 1 ? `已写入 ${total} 天日历提醒` : "已写入系统日历提醒", "success");
  scheduleModalAfterToast();
}

async function runSerialQueue(items, worker, gapMs) {
  const gap = gapMs != null ? gapMs : BATCH_GAP_MS;
  const results = [];
  for (let i = 0; i < items.length; i++) {
    results.push(await worker(items[i], i));
    if (i < items.length - 1) {
      await new Promise((r) => setTimeout(r, gap));
    }
  }
  return results;
}

/**
 * @param {Date} fire
 * @param {string} safeTitle
 * @param {{ showGuide?: boolean, description?: string }} [opts]
 * @returns {Promise<boolean>}
 */
async function addPhoneCalendarSingle(fire, safeTitle, opts) {
  const o = opts || {};
  const startSec = Math.floor(fire.getTime() / 1000);
  const r = await addPhoneCalendarOnce(safeTitle, startSec, o.description);
  if (r.ok) {
    toast("已写入系统日历提醒", "success");
    if (o.showGuide !== false) scheduleModalAfterToast();
    return true;
  }
  return false;
}

function runCalendarPath(fire, safeTitle, resolve, description) {
  ensureCalendarReady().then((calOk) => {
    if (!calOk) {
      resolve(false);
      return;
    }
    addPhoneCalendarSingle(fire, safeTitle, { description }).then(resolve);
  });
}

function scheduleAlarm(hour, minute, day, title) {
  return new Promise((resolve) => {
    try {
      const h = Number(hour);
      const m = Number(minute);
      if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
        toast("时间无效");
        resolve(false);
        return;
      }
      const ds = typeof day === "string" ? day.trim() : "";
      const segs = ds.split("-").map((x) => Number(x));
      if (segs.length !== 3 || segs.some((n) => !Number.isFinite(n))) {
        toast("日期无效");
        resolve(false);
        return;
      }
      const y = segs[0];
      const mo = segs[1] - 1;
      const d = segs[2];
      const fire = new Date(y, mo, d, h, m, 0, 0);
      if (Number.isNaN(fire.getTime())) {
        toast("日期无效");
        resolve(false);
        return;
      }
      const diffMs = fire.getTime() - Date.now();
      if (diffMs < 60 * 1000) {
        toast("提醒须晚于当前至少1分钟");
        resolve(false);
        return;
      }
      const safeTitle = String(title || "提醒").trim() || "提醒";
      const startSec = Math.floor(fire.getTime() / 1000);

      if (deviceEnv.isDesktopWechat()) {
        deviceEnv.showMobileOnlyModal({ feature: "日历提醒" }).then(() => resolve(false));
        return;
      }

      if (typeof wx.setAlarmClock === "function") {
        alarmPermission.ensureAlarmPermission().then((alarmOk) => {
          if (!alarmOk) {
            runCalendarPath(fire, safeTitle, resolve);
            return;
          }
          wx.setAlarmClock({
            hour: h,
            minute: m,
            relateDate: startSec,
            title: safeTitle,
            success: () => {
              toast("已设置系统闹钟", "success");
              resolve(true);
            },
            fail: () => {
              runCalendarPath(fire, safeTitle, resolve);
            },
          });
        });
        return;
      }

      if (typeof wx.addPhoneCalendar === "function") {
        runCalendarPath(fire, safeTitle, resolve);
        return;
      }

      toast("当前环境不支持闹钟或日历提醒");
      resolve(false);
    } catch (e) {
      toast("设置异常，请稍后重试");
      resolve(false);
    }
  });
}

/**
 * 日期区间内每天固定时刻提醒（优先重复日程，不支持则逐日写入）
 * @param {{ startYMD: string, endYMD: string, hour: number, minute: number, title: string, taskId?: string, version?: number }}
 * @returns {Promise<{ ok: boolean, mode?: string, days?: string[], fingerprint?: object, created?: number, failed?: number }>}
 */
async function scheduleDailyRange(opts) {
  if (deviceEnv.isDesktopWechat()) {
    await deviceEnv.showMobileOnlyModal({ feature: "日历提醒" });
    return { ok: false };
  }
  const o = opts || {};
  const h = Number(o.hour);
  const m = Number(o.minute);
  const startYMD = String(o.startYMD || "").trim();
  const endYMD = String(o.endYMD || startYMD).trim();
  const title = String(o.title || "提醒").trim() || "提醒";
  const taskId = String(o.taskId || "").trim();
  const version = Number(o.version) > 0 ? Number(o.version) : 1;
  const description = buildCalDescription(taskId, version);

  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    toast("时间无效");
    return { ok: false };
  }
  if (!startYMD || !endYMD) {
    toast("请先选择任务日期");
    return { ok: false };
  }

  const days = reminderSchedule.filterFutureReminderDays(
    reminderSchedule.enumerateDateRangeYMD(startYMD, endYMD),
    h,
    m,
  );
  if (!days.length) {
    toast("区间内没有可设置的提醒时间");
    return { ok: false };
  }
  if (days.length > MAX_RANGE_DAYS) {
    toast(`提醒天数不能超过${MAX_RANGE_DAYS}天`);
    return { ok: false };
  }

  const calOk = await ensureCalendarReady();
  if (!calOk) return { ok: false };

  const total = days.length;
  const rangeTitle =
    total > 1 ? `${title}（第1-${total}天/共${total}天）` : title;

  if (typeof wx.addPhoneRepeatCalendar === "function") {
    const first = reminderSchedule.localDateTimeFromYMDAndHM(days[0], h, m);
    const last = reminderSchedule.localDateTimeFromYMDAndHM(days[total - 1], h, m);
    if (first && last) {
      const startTimeSec = Math.floor(first.getTime() / 1000);
      const repeatEndTimeSec = Math.floor(last.getTime() / 1000);
      const r = await addPhoneRepeatCalendarOnce({
        title: rangeTitle,
        startTimeSec,
        repeatEndTimeSec,
        description,
      });
      if (r.ok) {
        finishRangeSuccess(total);
        return {
          ok: true,
          mode: "repeat",
          days,
          created: total,
          failed: 0,
          fingerprint: {
            startTimeSec,
            repeatEndTimeSec,
            repeatInterval: "day",
          },
        };
      }
    }
  }

  if (typeof wx.addPhoneCalendar !== "function") {
    toast("当前环境不支持日历提醒");
    return { ok: false };
  }

  let created = 0;
  let failed = 0;
  await runSerialQueue(days, async (ymd, index) => {
    const fire = reminderSchedule.localDateTimeFromYMDAndHM(ymd, h, m);
    if (!fire) {
      failed += 1;
      return false;
    }
    const dayTitle =
      total > 1 ? `${title}（第${index + 1}天/共${total}天）` : title;
    const startSec = Math.floor(fire.getTime() / 1000);
    const r = await addPhoneCalendarOnce(dayTitle, startSec, description);
    if (r.ok) created += 1;
    else failed += 1;
    return r.ok;
  });

  if (created > 0) {
    finishRangeSuccess(created);
    return {
      ok: true,
      mode: "batch",
      days,
      created,
      failed,
      fingerprint: { days: days.slice(0, created) },
    };
  }

  toast("日历提醒写入失败");
  return { ok: false, mode: "batch", days, created: 0, failed };
}

module.exports = {
  scheduleAlarm,
  scheduleDailyRange,
};
