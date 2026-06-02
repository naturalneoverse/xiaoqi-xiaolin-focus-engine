/**
 * 冷启动入口：分享扫码拦截 → wx.checkSession 自动登录 → 首页或登录/问卷
 * 不在此页使用固定 setTimeout 控制结束；动画 CSS 无限循环，路由在异步回调中完成。
 */

const STORAGE_KEYS = require("../../config/storageKeys");
const authSession = require("../../utils/authSession");
const shareReferrer = require("../../utils/shareReferrer");

Page({
  data: {},

  onLoad() {
    const hasLoggedInForShare =
      authSession.hasLocalCredentials() ||
      (() => {
        try {
          const app = getApp();
          return !!(app && app.globalData && app.globalData.hasLoggedIn);
        } catch (e) {
          return false;
        }
      })();

    try {
      if (shareReferrer && typeof shareReferrer.handleColdLaunchForQr === "function") {
        shareReferrer.handleColdLaunchForQr(!!hasLoggedInForShare);
      }
    } catch (e) {
      console.warn("[launch] share cold start", e);
    }

    this.runAutoLogin();
  },

  /**
   * 检查 Storage 中 token、userInfo；有效则 wx.checkSession，成功进首页，失败清会话进登录页。
   */
  runAutoLogin() {
    if (!authSession.hasLocalCredentials()) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }

    if (!authSession.hasValidTokenAndUserInfo()) {
      authSession.backfillTokenUserInfoFromLegacy();
    }

    if (!authSession.hasValidTokenAndUserInfo()) {
      wx.reLaunch({ url: "/pages/login/index" });
      return;
    }

    wx.checkSession({
      success: () => {
        this.afterSessionValid();
      },
      fail: () => {
        authSession.clearSessionStorage();
        wx.reLaunch({ url: "/pages/login/index" });
      },
    });
  },

  afterSessionValid() {
    const app = getApp();
    try {
      if (app && typeof app.setHasLoggedIn === "function") {
        app.setHasLoggedIn(true);
      } else {
        wx.setStorageSync(STORAGE_KEYS.HAS_LOGGED_IN, true);
        if (app && app.globalData) app.globalData.hasLoggedIn = true;
      }
    } catch (e) {
      console.warn("[launch] setHasLoggedIn", e);
    }

    try {
      authSession.reconcileProfileAtLaunch(app);
    } catch (e2) {
      /* ignore */
    }

    const resolveTagsComplete = (cloudComplete) => {
      if (cloudComplete) return true;
      if (authSession.isLocalTagsComplete()) {
        try {
          wx.setStorageSync(STORAGE_KEYS.USER_TAGS_COMPLETE, true);
        } catch (e) {
          /* ignore */
        }
        return true;
      }
      return false;
    };

    const finish = (tagsComplete) => {
      const complete = resolveTagsComplete(!!tagsComplete);
      if (app && app.globalData) {
        app.globalData.userTagsComplete = complete;
      }
      try {
        if (complete) {
          wx.setStorageSync(STORAGE_KEYS.USER_TAGS_COMPLETE, true);
        } else {
          wx.removeStorageSync(STORAGE_KEYS.USER_TAGS_COMPLETE);
        }
      } catch (e3) {
        /* ignore */
      }

      wx.nextTick(() => {
        if (!complete) {
          wx.redirectTo({ url: "/pages/onboarding-tags/index" });
          return;
        }
        wx.switchTab({ url: "/pages/index/index" });
      });
    };

    if (!wx.cloud || typeof wx.cloud.callFunction !== "function") {
      finish(authSession.isLocalTagsComplete());
      return;
    }

    wx.cloud
      .callFunction({
        name: "quickstartFunctions",
        data: { type: "getUserTags" },
      })
      .then((res) => {
        const r = (res && res.result) || {};
        let tagsComplete = false;
        if (r.success) {
          tagsComplete = !!r.tagsComplete;
        } else {
          try {
            tagsComplete = !!wx.getStorageSync(STORAGE_KEYS.USER_TAGS_COMPLETE);
          } catch (e5) {
            tagsComplete = false;
          }
        }
        finish(tagsComplete);
      })
      .catch(() => {
        let tagsComplete = false;
        try {
          tagsComplete = !!wx.getStorageSync(STORAGE_KEYS.USER_TAGS_COMPLETE);
        } catch (e6) {
          tagsComplete = false;
        }
        finish(tagsComplete);
      });
  },
});
