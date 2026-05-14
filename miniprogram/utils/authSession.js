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

/**
 * 是否存在本地 token（非空字符串）。
 */
function readToken() {
  try {
    const t = wx.getStorageSync(KEY_TOKEN);
    return typeof t === "string" && t.trim().length > 0 ? t.trim() : "";
  } catch (e) {
    return "";
  }
}

/**
 * 读取 userInfo（小程序 Storage 支持存对象）。
 */
function readUserInfo() {
  try {
    return wx.getStorageSync(KEY_USER_INFO);
  } catch (e) {
    return null;
  }
}

/**
 * token + userInfo 形态同时满足（新会话模型）。
 */
function hasValidTokenAndUserInfo() {
  const token = readToken();
  const userInfo = readUserInfo();
  return token.length > 0 && isValidUserInfoShape(userInfo);
}

/**
 * 旧版仅 HAS_LOGGED_IN + 资料 的会话（首次升级后仍视为已登录，启动页会补写 token/userInfo）。
 */
function hasLegacyLoginFlag() {
  try {
    return !!wx.getStorageSync(STORAGE_KEYS.HAS_LOGGED_IN);
  } catch (e) {
    return false;
  }
}

/**
 * 启动页 / 各页 gate：是否具备任一可继续的本地登录标识。
 */
function hasLocalCredentials() {
  return hasValidTokenAndUserInfo() || hasLegacyLoginFlag();
}

/**
 * 将云函数 loginByCode 结果与资料写入 Storage（须与登录页调用保持一致）。
 * @param {{ sessionToken?: string, openid?: string }} loginResult
 * @param {{ nickname?: string, avatarUrl?: string, signature?: string }} profile
 */
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
  wx.setStorageSync(KEY_TOKEN, token);
  wx.setStorageSync(KEY_USER_INFO, userInfo);
}

/**
 * 401 或会话失效：清空 token/userInfo 及与登录相关的本地标记。
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
    wx.removeStorageSync(STORAGE_KEYS.USER_TAGS_COMPLETE);
  } catch (e2) {
    /* ignore */
  }
  try {
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.hasLoggedIn = false;
      app.globalData.userTagsComplete = false;
      app.globalData.userOpenId = "";
    }
  } catch (e3) {
    /* ignore */
  }
}

/**
 * 旧会话补全 token / userInfo，便于后续统一走 wx.request 头与校验逻辑。
 */
function backfillTokenUserInfoFromLegacy() {
  if (hasValidTokenAndUserInfo()) return true;
  if (!hasLegacyLoginFlag()) return false;
  try {
    const profile = wx.getStorageSync(STORAGE_KEYS.USER_PROFILE) || {};
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

module.exports = {
  KEY_TOKEN,
  KEY_USER_INFO,
  readToken,
  readUserInfo,
  hasValidTokenAndUserInfo,
  hasLocalCredentials,
  persistAfterLogin,
  clearSessionStorage,
  backfillTokenUserInfoFromLegacy,
  isValidUserInfoShape,
};
