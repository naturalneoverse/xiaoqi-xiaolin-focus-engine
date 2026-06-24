const STORAGE_KEYS = require("../config/storageKeys");
const authSession = require("./authSession");

/**
 * 已登录且云端未标记标签完成时，跳转标签页。
 * @returns {Promise<boolean>} true 可继续当前页逻辑；false 已发起 reLaunch
 */
function ensureUserTagsOrLeave() {
  const app = getApp();
  if (!app || !app.globalData || !app.globalData.hasLoggedIn) {
    return Promise.resolve(true);
  }
  if (!wx.cloud || typeof wx.cloud.callFunction !== "function") {
    if (authSession.isLocalTagsComplete()) {
      app.globalData.userTagsComplete = true;
      return Promise.resolve(true);
    }
    return Promise.resolve(true);
  }
  const callTags = wx.cloud.callFunction({
    name: "quickstartFunctions",
    data: { type: "getUserTags" },
  });
  const timeoutMs = 5000;
  const timed = Promise.race([
    callTags,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("getUserTags timeout")), timeoutMs);
    }),
  ]);
  return timed
    .then((res) => {
      const r = (res && res.result) || {};
      const applied = authSession.applyCloudTagsStatus(r);
      if (applied === true) {
        return true;
      }
      if (applied === false) {
        wx.reLaunch({ url: "/pages/onboarding-tags/index" });
        return false;
      }
      if (authSession.isLocalTagsComplete()) {
        app.globalData.userTagsComplete = true;
        return true;
      }
      return true;
    })
    .catch((e) => {
      console.warn("getUserTags gate", e);
      if (app.globalData.userTagsComplete === true) {
        return true;
      }
      if (authSession.isLocalTagsComplete()) {
        app.globalData.userTagsComplete = true;
        return true;
      }
      return true;
    });
}

module.exports = {
  ensureUserTagsOrLeave,
};
