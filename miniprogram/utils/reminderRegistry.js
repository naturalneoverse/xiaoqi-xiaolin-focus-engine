/**
 * 本地记录已写入系统日历的提醒参数（微信无删除日历 API，用于幂等与更新提示）。
 */

const STORAGE_KEY = "task_calendar_reminder_registry";

function loadRegistry() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY);
    return raw && typeof raw === "object" ? raw : {};
  } catch (e) {
    return {};
  }
}

function writeRegistry(all) {
  try {
    wx.setStorageSync(STORAGE_KEY, all);
  } catch (e) {
    /* ignore */
  }
}

function getRecord(taskId) {
  const id = String(taskId || "").trim();
  if (!id) return null;
  const all = loadRegistry();
  return all[id] || null;
}

/**
 * @param {string} taskId
 * @param {object} record
 */
function saveRecord(taskId, record) {
  const id = String(taskId || "").trim();
  if (!id || !record) return;
  const all = loadRegistry();
  all[id] = { ...record, taskId: id, updatedAt: Date.now() };
  writeRegistry(all);
}

/** 将创建阶段的 draftId 迁移为正式 taskId */
function migrateRecord(fromId, toId) {
  const from = String(fromId || "").trim();
  const to = String(toId || "").trim();
  if (!from || !to || from === to) return;
  const all = loadRegistry();
  if (!all[from]) return;
  all[to] = { ...all[from], taskId: to, updatedAt: Date.now() };
  delete all[from];
  writeRegistry(all);
}

function isSameSchedule(prev, next) {
  if (!prev || !next) return false;
  return (
    prev.startYMD === next.startYMD &&
    prev.endYMD === next.endYMD &&
    prev.hour === next.hour &&
    prev.minute === next.minute
  );
}

function confirmRescheduleUpdate() {
  return new Promise((resolve) => {
    wx.showModal({
      title: "更新提醒",
      content:
        "系统无法自动删除旧日历提醒。继续将新建提醒；请到手机「日历」中手动删除旧条目（描述含任务编号）。",
      confirmText: "继续创建",
      cancelText: "取消",
      success: (res) => resolve(!!(res && res.confirm)),
      fail: () => resolve(false),
    });
  });
}

module.exports = {
  getRecord,
  saveRecord,
  migrateRecord,
  isSameSchedule,
  confirmRescheduleUpdate,
};
