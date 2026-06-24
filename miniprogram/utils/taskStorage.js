/**
 * 任务列表本地读写（单一入口，避免 subtask / cloudDataSync 各写一套）。
 */
const STORAGE_KEYS = require("../config/storageKeys");
const dailyCheckIn = require("./dailyCheckIn");

function readTasks() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEYS.TASKS_DATA);
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    console.error("[taskStorage] readTasks", e);
    return [];
  }
}

/**
 * @param {object[]} list
 * @param {{ recordCheckIn?: boolean }} [opts]
 */
function writeTasks(list, opts) {
  try {
    wx.setStorageSync(STORAGE_KEYS.TASKS_DATA, Array.isArray(list) ? list : []);
    if (!opts || opts.recordCheckIn !== false) {
      dailyCheckIn.recordDailyCheckIn();
    }
    return true;
  } catch (e) {
    console.error("[taskStorage] writeTasks", e);
    return false;
  }
}

module.exports = {
  readTasks,
  writeTasks,
};
