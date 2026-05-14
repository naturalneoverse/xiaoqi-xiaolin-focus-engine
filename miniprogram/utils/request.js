/**
 * 全局 HTTP 请求封装：自动带 token；401 / 鉴权失败清理会话并回登录页。
 * 使用微信小程序原生 wx.request（https://developers.weixin.qq.com/miniprogram/dev/api/network/request/wx.request.html）
 */

const authSession = require("./authSession");

const LOGIN_URL = "/pages/login/index";

/** @type {number} 简单合并请求中的 showLoading 引用计数 */
let __loadingCount = 0;

function showLoadingSafe(title) {
  if (__loadingCount === 0) {
    try {
      wx.showLoading({ title: title || "加载中", mask: true });
    } catch (e) {
      /* ignore */
    }
  }
  __loadingCount += 1;
}

function hideLoadingSafe() {
  __loadingCount = Math.max(0, __loadingCount - 1);
  if (__loadingCount > 0) return;
  try {
    wx.hideLoading();
  } catch (e) {
    /* ignore */
  }
}

function toastFail(title) {
  const t = (title && String(title).trim()) || "请求失败";
  try {
    wx.showToast({ title: t.length > 14 ? `${t.slice(0, 14)}…` : t, icon: "none" });
  } catch (e) {
    /* ignore */
  }
}

function clearAuthAndGoLogin() {
  authSession.clearSessionStorage();
  try {
    wx.reLaunch({ url: LOGIN_URL });
  } catch (e) {
    /* ignore */
  }
}

function isUnauthorizedStatus(statusCode) {
  return statusCode === 401 || statusCode === 403;
}

/**
 * @param {WechatMiniprogram.RequestOption & { showLoading?: boolean, loadingTitle?: string, skipAuthHeader?: boolean }} options
 * @returns {Promise<WechatMiniprogram.RequestSuccessCallbackResult>}
 */
function request(options) {
  const opt = options || {};
  const showLoading = opt.showLoading !== false;
  const loadingTitle = opt.loadingTitle || "加载中";
  const skipAuthHeader = !!opt.skipAuthHeader;

  if (showLoading) showLoadingSafe(loadingTitle);

  const token = skipAuthHeader ? "" : authSession.readToken();
  const header = {
    "content-type": "application/json",
    ...(opt.header || {}),
  };
  if (token && !skipAuthHeader) {
    header.Authorization = `Bearer ${token}`;
  }

  return new Promise((resolve, reject) => {
    wx.request({
      ...opt,
      header,
      success(res) {
        const sc = res && res.statusCode;
        if (isUnauthorizedStatus(sc)) {
          hideLoadingSafe();
          clearAuthAndGoLogin();
          reject(new Error("unauthorized"));
          return;
        }
        if (sc >= 200 && sc < 300) {
          hideLoadingSafe();
          resolve(res);
          return;
        }
        hideLoadingSafe();
        const msg = (res.data && (res.data.message || res.data.errMsg)) || `HTTP ${sc}`;
        toastFail(String(msg));
        reject(new Error(String(msg)));
      },
      fail(err) {
        hideLoadingSafe();
        const msg = (err && (err.errMsg || err.message)) || "网络异常";
        if (/fail\s|timeout|abort|network/i.test(String(msg))) {
          toastFail("网络异常，请稍后重试");
        } else {
          toastFail(String(msg));
        }
        reject(err);
      },
    });
  });
}

/** @type {Map<string, number>} */
const __lastTapAt = new Map();

/**
 * 防重复点击：同一 key 在 intervalMs 内只放行一次。
 * @param {string} key
 * @param {number} [intervalMs]
 * @returns {boolean} true 表示可执行
 */
function canTap(key, intervalMs) {
  const k = String(key || "default");
  const gap = typeof intervalMs === "number" && intervalMs > 0 ? intervalMs : 600;
  const now = Date.now();
  const last = __lastTapAt.get(k) || 0;
  if (now - last < gap) return false;
  if (__lastTapAt.size > 128) {
    const it = __lastTapAt.keys();
    for (let i = 0; i < 64; i++) {
      const first = it.next().value;
      if (first === undefined) break;
      __lastTapAt.delete(first);
    }
  }
  __lastTapAt.set(k, now);
  return true;
}

module.exports = {
  request,
  showLoadingSafe,
  hideLoadingSafe,
  toastFail,
  clearAuthAndGoLogin,
  canTap,
};
