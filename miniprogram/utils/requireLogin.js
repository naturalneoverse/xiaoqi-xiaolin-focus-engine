/**
 * 需要登录的页面在 onLoad 首行调用：无 token 且无旧版登录标记则回登录页。
 */

const authSession = require("./authSession");
const STORAGE_KEYS = require("../config/storageKeys");

const LOGIN_URL = "/pages/login/index";

/**
 * @returns {boolean} true 可继续执行本页 onLoad 后续逻辑；false 已发起 reLaunch
 */
function requireLoginOnLoad() {
  if (authSession.hasValidTokenAndUserInfo()) return true;
  try {
    if (wx.getStorageSync(STORAGE_KEYS.HAS_LOGGED_IN)) return true;
  } catch (e) {
    /* ignore */
  }
  wx.reLaunch({ url: LOGIN_URL });
  return false;
}

module.exports = {
  requireLoginOnLoad,
  LOGIN_URL,
};
