const STORAGE_KEYS = require("../config/storageKeys");

const MAX_CHECK_IN_DAYS = 400;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** 统一为 YYYY-MM-DD，兼容历史斜杠或个位数月日 */
function normalizeDateKey(raw) {
  if (typeof raw !== "string") return "";
  const s = raw.trim().replace(/\//g, "-");
  if (DATE_KEY_RE.test(s)) return s;
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return "";
  return `${m[1]}-${pad2(Number(m[2]))}-${pad2(Number(m[3]))}`;
}

function dateKeyFromDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeCheckInArray(raw) {
  if (Array.isArray(raw)) {
    return raw.map((k) => normalizeDateKey(k)).filter(Boolean);
  }
  if (raw && typeof raw === "object" && Array.isArray(raw.dates)) {
    return normalizeCheckInArray(raw.dates);
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return normalizeCheckInArray(parsed);
    } catch (e) {
      /* ignore */
    }
  }
  return [];
}

function mergeCheckInDateKeys(...lists) {
  const set = new Set();
  lists.forEach((list) => {
    normalizeCheckInArray(list).forEach((k) => set.add(k));
  });
  return Array.from(set)
    .sort((a, b) => (a < b ? 1 : -1))
    .slice(0, MAX_CHECK_IN_DAYS);
}

function readStorageRaw(key) {
  try {
    return wx.getStorageSync(key);
  } catch (e) {
    return null;
  }
}

function readBackupCheckInDateKeys() {
  return mergeCheckInDateKeys(normalizeCheckInArray(readStorageRaw(STORAGE_KEYS.DAILY_CHECK_INS_BACKUP)));
}

function persistCheckInBackup(keys) {
  const next = mergeCheckInDateKeys(keys, readBackupCheckInDateKeys());
  if (!next.length) return;
  try {
    wx.setStorageSync(STORAGE_KEYS.DAILY_CHECK_INS_BACKUP, next);
  } catch (e) {
    console.warn("[dailyCheckIn] persistCheckInBackup", e);
  }
}

/** 从主键原始值尽力恢复（含历史对象/字符串格式） */
function recoverCheckInFromRawStorage() {
  const raw = readStorageRaw(STORAGE_KEYS.DAILY_CHECK_INS);
  return mergeCheckInDateKeys(normalizeCheckInArray(raw));
}

function dateKeyFromLooseDateTime(raw) {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return dateKeyFromDate(new Date(raw));
  }
  const s = String(raw || "").trim().replace(/\//g, "-");
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return "";
  return `${m[1]}-${pad2(Number(m[2]))}-${pad2(Number(m[3]))}`;
}

function addDateKeyToSet(set, raw) {
  const k = dateKeyFromLooseDateTime(raw);
  if (k) set.add(k);
}

/**
 * 从任务/身体/哲思等业务痕迹推断「当日有使用」的日期（与产品规则一致：录入即打卡）。
 * 用于正式版与开发版共用存储时，历史未写入 daily_check_ins 的回补。
 */
function collectImplicitCheckInDateKeys() {
  if (!isUserLoggedIn()) return [];
  const set = new Set();

  try {
    const tasks = wx.getStorageSync(STORAGE_KEYS.TASKS_DATA);
    if (Array.isArray(tasks)) {
      tasks.forEach((t) => {
        if (!t) return;
        addDateKeyToSet(set, t.createdAt);
        addDateKeyToSet(set, t.timeText);
        addDateKeyToSet(set, t.updatedAt);
      });
    }
  } catch (e) {
    /* ignore */
  }

  try {
    const bodies = wx.getStorageSync(STORAGE_KEYS.BODY_RECORDS);
    if (Array.isArray(bodies)) {
      bodies.forEach((r) => {
        if (!r) return;
        addDateKeyToSet(set, r.dateKey);
        addDateKeyToSet(set, r.createdAt);
        addDateKeyToSet(set, r.updatedAt);
      });
    }
  } catch (e) {
    /* ignore */
  }

  try {
    const reflections = wx.getStorageSync(STORAGE_KEYS.REFLECTION_RECORDS);
    if (Array.isArray(reflections)) {
      reflections.forEach((rec) => {
        if (!rec) return;
        addDateKeyToSet(set, rec.createdAt);
        addDateKeyToSet(set, rec.updatedAt);
        addDateKeyToSet(set, rec.latestCompletedAtMs);
        const quads = rec.quadrants;
        if (quads && typeof quads === "object") {
          Object.keys(quads).forEach((qk) => {
            const q = quads[qk];
            if (!q) return;
            addDateKeyToSet(set, q.completedAtMs);
            addDateKeyToSet(set, q.completedAt);
          });
        }
      });
    }
  } catch (e) {
    /* ignore */
  }

  return Array.from(set)
    .sort((a, b) => (a < b ? 1 : -1))
    .slice(0, MAX_CHECK_IN_DAYS);
}

let _lastActivityRepairAt = 0;
const ACTIVITY_REPAIR_INTERVAL_MS = 45000;

/** 用业务数据回补打卡日期（只增不减） */
function repairCheckInsFromActivity(force) {
  if (!isUserLoggedIn()) return readCheckInDateKeysCore();
  const now = Date.now();
  if (!force && now - _lastActivityRepairAt < ACTIVITY_REPAIR_INTERVAL_MS) {
    return readCheckInDateKeysCore();
  }
  _lastActivityRepairAt = now;

  const current = readCheckInDateKeysCore();
  const implicit = collectImplicitCheckInDateKeys();
  const merged = mergeCheckInDateKeys(current, readBackupCheckInDateKeys(), implicit);
  if (merged.length > current.length) {
    console.info("[dailyCheckIn] activity backfill", current.length, "->", merged.length);
    writeCheckInDateKeys(merged);
    scheduleCloudSync();
    return merged;
  }
  return current;
}

function buildCheckInFloor(opts, ...extraLists) {
  const includeImplicit = !opts || opts.includeImplicit !== false;
  const implicit = includeImplicit && isUserLoggedIn() ? collectImplicitCheckInDateKeys() : [];
  return mergeCheckInDateKeys(
    recoverCheckInFromRawStorage(),
    readBackupCheckInDateKeys(),
    readStorageRaw(STORAGE_KEYS.DAILY_CHECK_INS),
    implicit,
    ...extraLists,
  );
}

function persistCheckInKeys(next) {
  try {
    wx.setStorageSync(STORAGE_KEYS.DAILY_CHECK_INS, next);
    persistCheckInBackup(next);
    return next;
  } catch (e) {
    console.error("persistCheckInKeys", e);
    return next;
  }
}

function readCheckInDateKeysCore() {
  const merged = buildCheckInFloor({ includeImplicit: false });
  const primary = recoverCheckInFromRawStorage();
  if (merged.length > primary.length) {
    persistCheckInKeys(merged);
  } else if (merged.length > readBackupCheckInDateKeys().length) {
    persistCheckInBackup(merged);
  }
  return merged;
}

function readCheckInDateKeysWithRecovery() {
  return readCheckInDateKeysCore();
}

function isUserLoggedIn() {
  try {
    const auth = require("./authSession");
    if (auth && typeof auth.isLoggedIn === "function" && auth.isLoggedIn()) {
      return true;
    }
  } catch (e) {
    /* ignore */
  }
  try {
    const app = getApp();
    return !!(app && app.globalData && app.globalData.hasLoggedIn);
  } catch (e2) {
    return false;
  }
}

function scheduleCloudSync() {
  try {
    const sync = require("./checkInCloudSync");
    if (sync && typeof sync.schedulePushCheckIns === "function") {
      sync.schedulePushCheckIns();
    }
  } catch (e) {
    /* ignore */
  }
}

function readCheckInDateKeys() {
  return readCheckInDateKeysWithRecovery();
}

/**
 * 写入打卡列表：与当前主键/备份/恢复结果取并集，拒绝变少。
 * @param {string[]} keys
 * @returns {string[]}
 */
function writeCheckInDateKeys(keys) {
  repairCheckInsFromActivity(false);
  const floor = buildCheckInFloor({ includeImplicit: true });
  const next = mergeCheckInDateKeys(floor, keys);
  if (next.length < floor.length) {
    console.warn("[dailyCheckIn] write refused shrink", floor.length, next.length);
    return persistCheckInKeys(floor);
  }
  return persistCheckInKeys(next);
}

/**
 * 合并云端结果写回本地：与当前本地取并集，拒绝变少（防止云同步覆盖丢历史）。
 * @param {string[][]} localSnapshots 同步前后本地快照（可传多份）
 * @param {string[]} [cloudDates]
 * @returns {string[]}
 */
function mergeAndPersistCheckIns(localSnapshots, cloudDates) {
  repairCheckInsFromActivity(false);
  const snaps = Array.isArray(localSnapshots) ? localSnapshots : [];
  const floor = buildCheckInFloor({ includeImplicit: true }, ...snaps, cloudDates || []);
  const beforeCount = Math.max(
    0,
    ...snaps.map((s) => (Array.isArray(s) ? s.length : 0)),
    buildCheckInFloor({ includeImplicit: true }).length,
  );
  if (floor.length < beforeCount) {
    console.warn("[dailyCheckIn] merge refused shrink", beforeCount, floor.length);
    return writeCheckInDateKeys(buildCheckInFloor({ includeImplicit: true }, ...snaps));
  }
  return writeCheckInDateKeys(floor);
}

/**
 * 已登录用户记当日打卡一次（App 前台打开或保存录入等均可触发）；同一天多次调用只保留一条。
 * @returns {boolean} 是否新写入今日
 */
function recordDailyCheckIn() {
  if (!isUserLoggedIn()) return false;
  repairCheckInsFromActivity(false);
  const today = dateKeyFromDate(new Date());
  const arr = readCheckInDateKeysWithRecovery();
  if (arr.includes(today)) {
    scheduleCloudSync();
    return false;
  }
  writeCheckInDateKeys([today, ...arr]);
  scheduleCloudSync();
  return true;
}

/** 累计打卡天数（自然日去重，不要求连续） */
function getCheckInTotalDays() {
  repairCheckInsFromActivity(false);
  return readCheckInDateKeysWithRecovery().length;
}

/** @deprecated 产品已改用累计天数；保留供排查 */
function getCheckInStreakDays(now) {
  const ref = now || new Date();
  const set = new Set(readCheckInDateKeysWithRecovery());
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
  readCheckInDateKeys,
  readCheckInDateKeysWithRecovery,
  repairCheckInsFromActivity,
  collectImplicitCheckInDateKeys,
  writeCheckInDateKeys,
  mergeCheckInDateKeys,
  mergeAndPersistCheckIns,
  normalizeDateKey,
};
