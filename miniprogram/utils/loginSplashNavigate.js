const { goSleepHome } = require("./goTabHome");
const deviceEnv = require("./deviceEnv");

/** PC 微信客户端（不含开发者工具）：视频与交互与手机差异大，直接进下一页 */
function shouldSkipLoginSplashOnClient() {
  const p = deviceEnv.readPlatform();
  return p === "windows" || p === "mac";
}

/**
 * 登录成功后进入开屏视频，再跳转标签页或首页（冷启动已登录不经过此页）
 * @param {boolean} tagsComplete
 */
function goAfterLoginSplash(tagsComplete) {
  if (shouldSkipLoginSplashOnClient()) {
    if (tagsComplete) {
      goSleepHome();
    } else {
      wx.redirectTo({ url: "/pages/onboarding-tags/index" });
    }
    return;
  }
  const next = tagsComplete ? "home" : "tags";
  wx.redirectTo({
    url: `/pages/login-splash/index?next=${encodeURIComponent(next)}`,
  });
}

module.exports = {
  goAfterLoginSplash,
};
