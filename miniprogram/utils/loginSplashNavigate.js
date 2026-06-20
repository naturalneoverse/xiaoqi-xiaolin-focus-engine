const { goSleepHome } = require("./goTabHome");

/**
 * 登录成功后进入开屏视频，再跳转标签页或首页（冷启动已登录不经过此页）
 * @param {boolean} tagsComplete
 */
function goAfterLoginSplash(tagsComplete) {
  const next = tagsComplete ? "home" : "tags";
  wx.redirectTo({
    url: `/pages/login-splash/index?next=${encodeURIComponent(next)}`,
  });
}

module.exports = {
  goAfterLoginSplash,
};
