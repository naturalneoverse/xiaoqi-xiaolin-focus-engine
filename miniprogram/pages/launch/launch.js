/**
 * 冷启动入口：分享扫码记录 → 已登录则校验会话进首页/问卷；未登录则游客直达首页。
 */

const STORAGE_KEYS = require("../../config/storageKeys");
const authSession = require("../../utils/authSession");
const shareReferrer = require("../../utils/shareReferrer");
const { goSleepHome } = require("../../utils/goTabHome");

Page({
  data: {
    logoSrc: "/images/transparent background/logo.png",
  },

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
   * 已登录：校验 token/userInfo 与 wx.checkSession；未登录或会话失效则游客进首页。
   */
  runAutoLogin() {
    if (!authSession.hasLocalCredentials()) {
      goSleepHome();
      return;
    }

    if (!authSession.hasValidTokenAndUserInfo()) {
      authSession.backfillTokenUserInfoFromLegacy();
    }

    if (!authSession.hasValidTokenAndUserInfo()) {
      authSession.clearSessionStorage();
      goSleepHome();
      return;
    }

    wx.checkSession({
      success: () => {
        this.afterSessionValid();
      },
      fail: () => {
        authSession.clearSessionStorage();
        goSleepHome();
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
        if (app && typeof app.tryRecordDailyCheckIn === "function") {
          app.tryRecordDailyCheckIn();
        }
      }
    } catch (e) {
      console.warn("[launch] setHasLoggedIn", e);
    }

    try {
      authSession.reconcileProfileAtLaunch(app);
    } catch (e2) {
      /* ignore */
    }

    const resolveTagsComplete = (cloudResult) => {
      const applied = authSession.applyCloudTagsStatus(cloudResult);
      if (applied === true || applied === false) return applied;
      return authSession.isLocalTagsComplete();
    };

    const finish = (cloudResult) => {
      const complete = resolveTagsComplete(cloudResult);
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
        goSleepHome();
      });
    };

    if (!wx.cloud || typeof wx.cloud.callFunction !== "function") {
      finish({ success: false });
      return;
    }

    wx.cloud
      .callFunction({
        name: "quickstartFunctions",
        data: { type: "getUserTags" },
      })
      .then((res) => {
        finish((res && res.result) || { success: false });
      })
      .catch(() => {
        finish({ success: false });
      });
  },
});
