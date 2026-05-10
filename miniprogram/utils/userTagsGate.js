const STORAGE_KEYS = require("../config/storageKeys");

/**
 * 已登录且云端未标记标签完成时，跳转标签页。
 * @returns {Promise<boolean>} true 可继续当前页逻辑；false 已发起 reLaunch
 */
function ensureUserTagsOrLeave() {
  const app = getApp();
  if (!app || !app.globalData || !app.globalData.hasLoggedIn) {
    return Promise.resolve(true);
  }
  if (app.globalData.userTagsComplete === true) {
    return Promise.resolve(true);
  }
  try {
    if (wx.getStorageSync(STORAGE_KEYS.USER_TAGS_COMPLETE)) {
      app.globalData.userTagsComplete = true;
      return Promise.resolve(true);
    }
  } catch (e) {
    /* ignore */
  }
  if (!wx.cloud || typeof wx.cloud.callFunction !== "function") {
    return Promise.resolve(true);
  }
  return wx.cloud
    .callFunction({
      name: "quickstartFunctions",
      data: { type: "getUserTags" },
    })
    .then((res) => {
      const r = (res && res.result) || {};
      if (r.success && r.tagsComplete) {
        app.globalData.userTagsComplete = true;
        try {
          wx.setStorageSync(STORAGE_KEYS.USER_TAGS_COMPLETE, true);
        } catch (e) {
          /* ignore */
        }
        return true;
      }
      /** 仅云端明确「未填完」时才拦；success:false（未部署/报错）不 reLaunch，避免预览卡死 */
      if (r.success === true && r.tagsComplete === false) {
        wx.reLaunch({ url: "/pages/onboarding-tags/index" });
        return false;
      }
      return true;
    })
    .catch((e) => {
      console.warn("getUserTags gate", e);
      return true;
    });
}

module.exports = {
  ensureUserTagsOrLeave,
};
