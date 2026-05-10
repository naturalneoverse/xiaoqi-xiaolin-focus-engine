const STORAGE_KEYS = require("../config/storageKeys");

function dateKeyFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * 已登录且当日有一次有效「录入」后调用：记当日打卡一次；同一天多次调用只保留一条。
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

/** 从今天往前连续有打卡记录的天数 */
function getCheckInStreakDays(now) {
  const ref = now || new Date();
  let arr = [];
  try {
    const raw = wx.getStorageSync(STORAGE_KEYS.DAILY_CHECK_INS);
    arr = Array.isArray(raw) ? raw : [];
  } catch (e) {
    return 0;
  }
  const set = new Set(arr);
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
  getCheckInStreakDays,
  dateKeyFromDate,
};
