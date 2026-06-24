/**
 * 登录门禁：浏览类页面不调用；需账号能力时在 onLoad 或用户操作处按需拦截。
 */

const authSession = require("./authSession");

const LOGIN_URL = "/pages/login/index";

/**
 * @returns {boolean} true 可继续执行本页 onLoad 后续逻辑；false 已发起跳转登录
 */
function requireLoginOnLoad() {
  if (authSession.isLoggedIn()) return true;
  wx.navigateTo({
    url: LOGIN_URL,
    fail: () => {
      wx.reLaunch({ url: LOGIN_URL });
    },
  });
  return false;
}

function navigateToLogin() {
  wx.navigateTo({
    url: LOGIN_URL,
    fail: () => {
      wx.reLaunch({ url: LOGIN_URL });
    },
  });
}

/**
 * 未登录时弹窗引导，不阻断首页浏览。
 * @param {{ title?: string, content?: string, confirmText?: string, cancelText?: string }} [options]
 * @returns {boolean} true 已登录可继续
 */
function promptLoginIfNeeded(options) {
  if (authSession.isLoggedIn()) return true;
  const opts = options && typeof options === "object" ? options : {};
  wx.showModal({
    title: opts.title || "登录提示",
    content: opts.content || "登录后可同步数据到云端，并在多设备间恢复。",
    confirmText: opts.confirmText || "去登录",
    cancelText: opts.cancelText || "先逛逛",
    success(res) {
      if (res.confirm) navigateToLogin();
    },
  });
  return false;
}

module.exports = {
  requireLoginOnLoad,
  navigateToLogin,
  promptLoginIfNeeded,
  LOGIN_URL,
};
