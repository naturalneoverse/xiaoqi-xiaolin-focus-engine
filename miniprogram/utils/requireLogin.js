/**
 * 登录门禁：Tab 可浏览；写操作与账号页用 promptLoginIfNeeded；深链子页用 requireLoginOnLoad。
 * 帮助/关于需登录；品牌引导分包可在体验流程中未登录打开。
 */

const authSession = require("./authSession");

const LOGIN_URL = "/pages/login/index";

/** 未登录可浏览（仅品牌引导分包；帮助/关于需登录） */
const GUEST_BROWSE_URLS = ["/subpkg/brand-intro/index"];

function isGuestBrowseUrl(url) {
  const raw = String(url || "")
    .trim()
    .replace(/^\//, "")
    .split("?")[0];
  return GUEST_BROWSE_URLS.some((p) => p.replace(/^\//, "") === raw);
}

function reLaunchLogin() {
  wx.reLaunch({
    url: LOGIN_URL,
    fail: () => {
      wx.redirectTo({ url: LOGIN_URL });
    },
  });
}

/**
 * @returns {boolean} true 可继续执行本页 onLoad 后续逻辑；false 已发起跳转登录
 */
function requireLoginOnLoad() {
  if (authSession.isLoggedIn()) return true;
  reLaunchLogin();
  return false;
}

/** @deprecated Tab 页请用 promptLoginIfNeeded，勿在 onLoad 整页拦截 */
function guardLoginOnLoad() {
  return requireLoginOnLoad();
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
  guardLoginOnLoad,
  reLaunchLogin,
  navigateToLogin,
  promptLoginIfNeeded,
  isGuestBrowseUrl,
  GUEST_BROWSE_URLS,
  LOGIN_URL,
};
