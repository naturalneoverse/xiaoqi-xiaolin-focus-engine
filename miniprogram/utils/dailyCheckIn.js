const STORAGE_KEYS = require("../config/storageKeys");

function dateKeyFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 已登录用户记当日打卡一次（App 前台打开或保存录入等均可触发）；同一天多次调用只保留一条。
 */
function recordDailyCheckIn() {
  const app = getApp();
  if (!app || !app.globalData || !app.globalData.hasLoggedIn) return;
  const today = dateKeyFromDate(new Date());
  try {
    let arr = wx.getStorageSync(STORAGE_KEYS.DAILY_CHECK_INS);
    if (!Array.isArray(arr)) arr = [];
    if (arr.includes(today)) return;
    const next = [today, ...arr.filter((k) => k !== today)];
    next.sort((a, b) => (a < b ? 1 : -1));
    wx.setStorageSync(STORAGE_KEYS.DAILY_CHECK_INS, next.slice(0, 400));
  } catch (e) {
    console.error("recordDailyCheckIn", e);
  }
}

function readCheckInDateKeys() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEYS.DAILY_CHECK_INS);
    if (!Array.isArray(raw)) return [];
    return raw.filter((k) => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k));
  } catch (e) {
    return [];
  }
}

/** 累计打卡天数（自然日去重，不要求连续） */
function getCheckInTotalDays() {
  return new Set(readCheckInDateKeys()).size;
}

/** @deprecated 产品已改用累计天数；保留供排查 */
function getCheckInStreakDays(now) {
  const ref = now || new Date();
  const set = new Set(readCheckInDateKeys());
  let streak = 0;
  const cursor = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  for (;;) {
    const k = dateKeyFromDate(cursor);
    if (set.has(k)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

module.exports = {
  recordDailyCheckIn,
  getCheckInTotalDays,
  getCheckInStreakDays,
  dateKeyFromDate,
};
