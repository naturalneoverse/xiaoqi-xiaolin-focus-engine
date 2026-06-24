/**
 * 发版一次性本地迁移：仅清会话与品牌引导已读，保留 profile / 任务 / 反思等业务数据。
 * 1.4.2：全员再走「游客时间首页 → 引导弹窗/15 屏 → 需要时再登录」。
 */

const STORAGE_KEYS = require("../config/storageKeys");

/** 已执行过的迁移 id 列表，存于 RELEASE_MIGRATIONS_APPLIED */
const MIGRATION_GUEST_INTRO_EXPERIENCE_V1 = "guest_intro_experience_v1";

const MIGRATIONS = [
  {
    id: MIGRATION_GUEST_INTRO_EXPERIENCE_V1,
    introducedIn: "1.4.2",
    apply(deps) {
      deps.clearSessionStorage();
      deps.removeStorage(STORAGE_KEYS.BRAND_INTRO_SEEN);
      if (deps.resetBrandIntroSessionDismissed) {
        deps.resetBrandIntroSessionDismissed();
      }
    },
  },
];

function readAppliedIds(getStorageSync) {
  try {
    const raw = getStorageSync(STORAGE_KEYS.RELEASE_MIGRATIONS_APPLIED);
    if (Array.isArray(raw)) {
      return raw.filter((id) => typeof id === "string" && id.trim());
    }
    return [];
  } catch (e) {
    return [];
  }
}

function writeAppliedIds(setStorageSync, ids) {
  try {
    setStorageSync(STORAGE_KEYS.RELEASE_MIGRATIONS_APPLIED, ids);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * @param {{ getStorageSync: Function, setStorageSync: Function, clearSessionStorage: Function, removeStorage: Function, resetBrandIntroSessionDismissed?: Function }} deps
 * @returns {string[]} 本次新执行的 migration id
 */
function runPendingReleaseMigrationsWithDeps(deps) {
  const getStorageSync = deps && deps.getStorageSync;
  const setStorageSync = deps && deps.setStorageSync;
  if (typeof getStorageSync !== "function" || typeof setStorageSync !== "function") {
    return [];
  }
  const applied = readAppliedIds(getStorageSync);
  const appliedSet = new Set(applied);
  const ran = [];

  for (let i = 0; i < MIGRATIONS.length; i += 1) {
    const m = MIGRATIONS[i];
    if (!m || appliedSet.has(m.id)) continue;
    if (typeof m.apply !== "function") continue;
    m.apply(deps);
    appliedSet.add(m.id);
    ran.push(m.id);
  }

  if (ran.length) {
    writeAppliedIds(setStorageSync, Array.from(appliedSet));
  }
  return ran;
}

function runPendingReleaseMigrations() {
  const authSession = require("./authSession");
  return runPendingReleaseMigrationsWithDeps({
    getStorageSync: (key) => wx.getStorageSync(key),
    setStorageSync: (key, value) => wx.setStorageSync(key, value),
    removeStorage: (key) => {
      try {
        wx.removeStorageSync(key);
      } catch (e) {
        /* ignore */
      }
    },
    clearSessionStorage: () => {
      if (authSession && typeof authSession.clearSessionStorage === "function") {
        authSession.clearSessionStorage();
      }
    },
    resetBrandIntroSessionDismissed: () => {
      try {
        const app = getApp();
        if (app && app.globalData) app.globalData.brandIntroSessionDismissed = false;
      } catch (e) {
        /* ignore */
      }
    },
  });
}

module.exports = {
  MIGRATION_GUEST_INTRO_EXPERIENCE_V1,
  MIGRATIONS,
  readAppliedIds,
  runPendingReleaseMigrations,
  runPendingReleaseMigrationsWithDeps,
};
