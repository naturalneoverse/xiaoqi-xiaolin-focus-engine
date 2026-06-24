/**
 * 本地登录态（与微信官方 wx.checkSession 配合使用）。
 * 存储键名按产品约定：wx.setStorageSync('token'|'userInfo', ...)
 * 同时与既有云开发登录态 HAS_LOGGED_IN / USER_PROFILE 兼容。
 */

const STORAGE_KEYS = require("../config/storageKeys");

/** @type {string} */
const KEY_TOKEN = "token";
/** @type {string} */
const KEY_USER_INFO = "userInfo";

/**
 * 判断 userInfo 是否为可接受的非空对象（不编造字段，仅做类型与最小内容校验）。
 * @param {unknown} v
 */
function isValidUserInfoShape(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = /** @type {Record<string, unknown>} */ (v);
  const openid = typeof o.openid === "string" ? o.openid.trim() : "";
  const nick = typeof o.nickName === "string" ? o.nickName.trim() : "";
  return openid.length > 0 || nick.length > 0;
}

function readToken() {
  try {
    const t = wx.getStorageSync(KEY_TOKEN);
    return typeof t === "string" && t.trim().length > 0 ? t.trim() : "";
  } catch (e) {
    return "";
  }
}

function readUserInfo() {
  try {
    return wx.getStorageSync(KEY_USER_INFO);
  } catch (e) {
    return null;
  }
}

function readUserProfileRaw() {
  try {
    const saved = wx.getStorageSync(STORAGE_KEYS.USER_PROFILE);
    return saved && typeof saved === "object" ? saved : {};
  } catch (e) {
    return {};
  }
}

function isProfileCustomized() {
  try {
    return !!wx.getStorageSync(STORAGE_KEYS.PROFILE_CUSTOMIZED);
  } catch (e) {
    return false;
  }
}

function markProfileCustomized(value) {
  try {
    if (value !== false) {
      wx.setStorageSync(STORAGE_KEYS.PROFILE_CUSTOMIZED, true);
    } else {
      wx.removeStorageSync(STORAGE_KEYS.PROFILE_CUSTOMIZED);
    }
  } catch (e) {
    /* ignore */
  }
}

function profileDiffersFromUserInfo(profile, ui) {
  if (!ui || typeof ui !== "object") return false;
  const p = profile || {};
  return (
    String(p.nickname || "") !== String(ui.nickName || "") ||
    String(p.avatarUrl || "") !== String(ui.avatarUrl || "") ||
    String(p.signature || "") !== String(ui.signature || "")
  );
}

/**
 * 将 user_profile 同步到 userInfo（保留 openid；无 token 时跳过）。
 * @param {{ nickname?: string, avatarUrl?: string, signature?: string }} profile
 */
function syncUserInfoFromProfile(profile) {
  if (!readToken()) return false;
  const p = profile || {};
  const prev = readUserInfo();
  const prevObj = prev && typeof prev === "object" && !Array.isArray(prev) ? prev : {};
  let openid = typeof prevObj.openid === "string" ? prevObj.openid.trim() : "";
  if (!openid) {
    try {
      const oid = wx.getStorageSync(STORAGE_KEYS.USER_OPENID);
      if (typeof oid === "string") openid = oid.trim();
    } catch (e) {
      /* ignore */
    }
  }
  const userInfo = {
    nickName: typeof p.nickname === "string" ? p.nickname : "",
    avatarUrl: typeof p.avatarUrl === "string" ? p.avatarUrl : "",
    signature: typeof p.signature === "string" ? p.signature : "",
    openid,
  };
  try {
    wx.setStorageSync(KEY_USER_INFO, userInfo);
    return true;
  } catch (e) {
    return false;
  }
}

function hasValidTokenAndUserInfo() {
  const token = readToken();
  const userInfo = readUserInfo();
  return token.length > 0 && isValidUserInfoShape(userInfo);
}

function hasLegacyLoginFlag() {
  try {
    return !!wx.getStorageSync(STORAGE_KEYS.HAS_LOGGED_IN);
  } catch (e) {
    return false;
  }
}

/** 启动页 / 各页 gate：是否具备任一可继续的本地登录标识。 */
function hasLocalCredentials() {
  return hasValidTokenAndUserInfo() || hasLegacyLoginFlag();
}

function isLoggedIn() {
  return hasLocalCredentials();
}

/** 本机问卷是否已填（COMPLETE 或 LOCAL 结构完整）。 */
function isLocalTagsComplete() {
  try {
    if (wx.getStorageSync(STORAGE_KEYS.USER_TAGS_COMPLETE)) return true;
    const lo = wx.getStorageSync(STORAGE_KEYS.USER_TAGS_LOCAL);
    return !!(lo && lo.gender && lo.lifeStage && Array.isArray(lo.roles) && lo.roles.length >= 2);
  } catch (e) {
    return false;
  }
}

/** 清除本机标签完成标记与暂存答案（云端明确未完成时调用） */
function clearLocalUserTags() {
  try {
    wx.removeStorageSync(STORAGE_KEYS.USER_TAGS_COMPLETE);
    wx.removeStorageSync(STORAGE_KEYS.USER_TAGS_LOCAL);
  } catch (e) {
    /* ignore */
  }
  try {
    const app = getApp();
    if (app && app.globalData) app.globalData.userTagsComplete = false;
  } catch (e) {
    /* ignore */
  }
}

/**
 * 云端 getUserTags / loginByCode 结果写入本机标签态。
 * @returns {boolean|null} true/false 表示已确定；null 表示云端未给出有效结果，调用方自行兜底
 */
function applyCloudTagsStatus(result) {
  const r = result && typeof result === "object" ? result : {};
  if (r.success !== true) return null;
  if (r.tagsComplete) {
    try {
      wx.setStorageSync(STORAGE_KEYS.USER_TAGS_COMPLETE, true);
    } catch (e) {
      /* ignore */
    }
    try {
      const app = getApp();
      if (app && app.globalData) app.globalData.userTagsComplete = true;
    } catch (e) {
      /* ignore */
    }
    return true;
  }
  clearLocalUserTags();
  return false;
}

function persistAfterLogin(loginResult, profile) {
  const lr = loginResult || {};
  const p = profile || {};
  const oid = typeof lr.openid === "string" ? lr.openid.trim() : "";
  const token =
    typeof lr.sessionToken === "string" && lr.sessionToken.trim()
      ? lr.sessionToken.trim()
      : oid
        ? `cloud_${oid}`
        : `cloud_${Date.now()}`;
  const userInfo = {
    nickName: typeof p.nickname === "string" ? p.nickname : "",
    avatarUrl: typeof p.avatarUrl === "string" ? p.avatarUrl : "",
    signature: typeof p.signature === "string" ? p.signature : "",
    openid: oid,
  };
  try {
    wx.setStorageSync(KEY_TOKEN, token);
    wx.setStorageSync(KEY_USER_INFO, userInfo);
  } catch (e) {
    /* ignore */
  }
}

/**
 * 会话失效 / 主动退出：清 token 与会话标记。
 * 保留：user_profile、profile_customized、问卷标记、业务数据、pending_referrer_*（退出后再登录可补上报分享归因）。
 */
function clearSessionStorage() {
  try {
    wx.removeStorageSync(KEY_TOKEN);
    wx.removeStorageSync(KEY_USER_INFO);
  } catch (e) {
    /* ignore */
  }
  try {
    wx.removeStorageSync(STORAGE_KEYS.HAS_LOGGED_IN);
    wx.removeStorageSync(STORAGE_KEYS.USER_OPENID);
  } catch (e2) {
    /* ignore */
  }
  try {
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.hasLoggedIn = false;
      app.globalData.userOpenId = "";
    }
  } catch (e3) {
    /* ignore */
  }
}

function logout() {
  clearSessionStorage();
}

function backfillTokenUserInfoFromLegacy() {
  if (hasValidTokenAndUserInfo()) return true;
  if (!hasLegacyLoginFlag()) return false;
  try {
    const profile = readUserProfileRaw();
    const oid = wx.getStorageSync(STORAGE_KEYS.USER_OPENID);
    const openid = typeof oid === "string" ? oid.trim() : "";
    const token = openid ? `cloud_${openid}` : `cloud_legacy_${Date.now()}`;
    const userInfo = {
      nickName: typeof profile.nickname === "string" ? profile.nickname : "",
      avatarUrl: typeof profile.avatarUrl === "string" ? profile.avatarUrl : "",
      signature: typeof profile.signature === "string" ? profile.signature : "",
      openid,
    };
    wx.setStorageSync(KEY_TOKEN, token);
    wx.setStorageSync(KEY_USER_INFO, userInfo);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * 冷启动 launch：user_profile 与 userInfo 不一致时，以 profile 为准（含 PROFILE_CUSTOMIZED）。
 * @param {{ setUserProfile?: Function, getUserProfile?: Function }} app
 */
function reconcileProfileAtLaunch(app) {
  if (!app || typeof app.setUserProfile !== "function") return;

  const stored = readUserProfileRaw();
  const ui = readUserInfo();
  const profileWins = isProfileCustomized() || profileDiffersFromUserInfo(stored, ui);

  if (profileWins) {
    const patch = {};
    if (typeof stored.nickname === "string") patch.nickname = stored.nickname;
    if (typeof stored.avatarUrl === "string") patch.avatarUrl = stored.avatarUrl;
    if (typeof stored.signature === "string") patch.signature = stored.signature;
    if (Object.keys(patch).length) {
      app.setUserProfile(patch, { markCustomized: false, syncUserInfo: true });
    } else if (typeof app.getUserProfile === "function") {
      syncUserInfoFromProfile(app.getUserProfile());
    }
    return;
  }

  if (ui && typeof ui === "object") {
    app.setUserProfile(
      {
        nickname: ui.nickName || "",
        avatarUrl: ui.avatarUrl || "",
        signature: ui.signature || "",
      },
      { markCustomized: false, syncUserInfo: false },
    );
  }
}

module.exports = {
  KEY_TOKEN,
  KEY_USER_INFO,
  readToken,
  readUserInfo,
  hasValidTokenAndUserInfo,
  hasLocalCredentials,
  isLoggedIn,
  isLocalTagsComplete,
  clearLocalUserTags,
  applyCloudTagsStatus,
  isProfileCustomized,
  markProfileCustomized,
  syncUserInfoFromProfile,
  reconcileProfileAtLaunch,
  persistAfterLogin,
  clearSessionStorage,
  logout,
  backfillTokenUserInfoFromLegacy,
  isValidUserInfoShape,
};
