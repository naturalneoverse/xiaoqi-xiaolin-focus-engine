/**
 * 品牌引导页（分包）：打开 / 已读标记 / 首次 gentle 提示
 */

const STORAGE_KEYS = require("../config/storageKeys");

const BRAND_INTRO_PATH = "/subpkg/brand-intro/index";

function hasSeenBrandIntro() {
  try {
    return !!wx.getStorageSync(STORAGE_KEYS.BRAND_INTRO_SEEN);
  } catch (e) {
    return false;
  }
}

function markBrandIntroSeen() {
  try {
    wx.setStorageSync(STORAGE_KEYS.BRAND_INTRO_SEEN, true);
    return true;
  } catch (e) {
    return false;
  }
}

function markBrandIntroSessionDismissed() {
  try {
    const app = getApp();
    if (app && app.globalData) app.globalData.brandIntroSessionDismissed = true;
  } catch (e) {
    /* ignore */
  }
}

function wasBrandIntroDismissedThisSession() {
  try {
    const app = getApp();
    return !!(app && app.globalData && app.globalData.brandIntroSessionDismissed);
  } catch (e) {
    return false;
  }
}

function isSleepHomeActive() {
  try {
    const pages = getCurrentPages();
    const cur = pages[pages.length - 1];
    return !!(cur && cur.route === "pages/sleep/index");
  } catch (e) {
    return false;
  }
}

function openBrandIntro(options) {
  const opts = options && typeof options === "object" ? options : {};
  let url = BRAND_INTRO_PATH;
  if (opts.from) {
    url += `?from=${encodeURIComponent(String(opts.from))}`;
  }
  wx.navigateTo({
    url,
    fail: () => {
      wx.redirectTo({ url });
    },
  });
}

/**
 * 首次进入时间首页时 gentle 提示（不阻断）
 * @returns {boolean} true 表示已弹窗
 */
function maybePromptBrandIntro() {
  if (hasSeenBrandIntro() || wasBrandIntroDismissedThisSession()) return false;
  if (!isSleepHomeActive()) return false;
  wx.showModal({
    title: "认识小麒小麟",
    content: "用一分钟，遇见两位陪你安放时光的小哲学家",
    confirmText: "前去相识",
    cancelText: "稍后",
    success(res) {
      markBrandIntroSessionDismissed();
      if (res.confirm) {
        openBrandIntro({ from: "sleep_prompt" });
      }
    },
    fail() {
      markBrandIntroSessionDismissed();
    },
  });
  return true;
}

/**
 * 进入时间首页后 gentle 提示（不等待云同步）
 * @param {number} [delayMs]
 */
function scheduleBrandIntroPromptOnSleep(delayMs) {
  if (hasSeenBrandIntro() || wasBrandIntroDismissedThisSession()) return;
  const wait = Number(delayMs) > 0 ? Number(delayMs) : 600;
  setTimeout(() => {
    if (hasSeenBrandIntro() || wasBrandIntroDismissedThisSession()) return;
    if (!isSleepHomeActive()) return;
    maybePromptBrandIntro();
  }, wait);
}

module.exports = {
  BRAND_INTRO_PATH,
  hasSeenBrandIntro,
  markBrandIntroSeen,
  markBrandIntroSessionDismissed,
  openBrandIntro,
  maybePromptBrandIntro,
  scheduleBrandIntroPromptOnSleep,
};
