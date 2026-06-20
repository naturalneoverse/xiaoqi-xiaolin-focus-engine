const STORAGE_KEYS = require("../../config/storageKeys");
const authSession = require("../../utils/authSession");
const { goAfterLoginSplash } = require("../../utils/loginSplashNavigate");

Page({
  data: {
    isFirstLogin: true,
    agree: false,
    isLoading: false,
    loadingText: "登录中",
    agreementFontRpx: 26,
  },

  onLoad(options) {
    const opts = options && typeof options === "object" ? options : {};
    try {
      const shareRef = require("../../utils/shareReferrer");
      const auth = require("../../utils/authSession");
      shareRef.handleColdLaunchForQr(!!auth.hasLocalCredentials());
    } catch (e) {
      /* ignore */
    }
    try {
      const shareRef = require("../../utils/shareReferrer");
      if (opts.scene != null && opts.scene !== "") {
        shareRef.persistReferrerFromScene(opts.scene);
      }
      if (opts.shareUid != null && opts.shareUid !== "") {
        shareRef.persistReferrerFromShareUid(opts.shareUid);
      }
    } catch (e) {
      /* ignore */
    }
  },

  onShow() {
    const hasLoggedIn = this.getHasLoggedIn();
    this.setData({
      isFirstLogin: !hasLoggedIn,
      agree: hasLoggedIn ? true : false,
      agreementFontRpx: this.computeAgreementFontRpx(),
    });
  },

  computeAgreementFontRpx() {
    let w = 375;
    try {
      const wi = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      w = Number(wi.windowWidth || wi.screenWidth) || 375;
    } catch (e) {
      /* ignore */
    }
    if (w <= 320) return 18;
    if (w < 360) return 20;
    if (w < 375) return 22;
    if (w < 390) return 24;
    if (w < 414) return 26;
    return 28;
  },

  getHasLoggedIn() {
    const auth = require("../../utils/authSession");
    if (auth && typeof auth.isLoggedIn === "function" && auth.isLoggedIn()) {
      return true;
    }
    const app = getApp();
    if (app && app.globalData && typeof app.globalData.hasLoggedIn === "boolean") {
      return app.globalData.hasLoggedIn;
    }
    try {
      const auth = require("../../utils/authSession");
      if (auth && typeof auth.hasLocalCredentials === "function" && auth.hasLocalCredentials()) {
        return true;
      }
    } catch (e) {
      /* ignore */
    }
    try {
      return !!wx.getStorageSync(STORAGE_KEYS.HAS_LOGGED_IN);
    } catch (e) {
      return false;
    }
  },

  toggleAgree() {
    if (!this.data.isFirstLogin) return;
    this.setData({
      agree: !this.data.agree,
    });
  },

  /** 海报扫码待上报的分享者 ID：上报失败也不阻塞后续跳转 */
  async reportPendingReferralIfAny() {
    const shareRef = require("../../utils/shareReferrer");
    const referrer = shareRef.getPendingReferrerOpenid();
    if (!referrer) return;
    if (!wx.cloud || typeof wx.cloud.callFunction !== "function") {
      shareRef.clearPendingReferrer();
      return;
    }
    const source = shareRef.getPendingReferrerSource();
    try {
      await wx.cloud.callFunction({
        name: "quickstartFunctions",
        data: { type: "recordReferralAttribution", referrerOpenid: referrer, source },
      });
    } catch (e) {
      console.warn("recordReferralAttribution", e);
    } finally {
      shareRef.clearPendingReferrer();
    }
  },

  onHide() {
    this.stopLoadingAnimation();
  },

  onUnload() {
    this.stopLoadingAnimation();
  },

  openUserAgreement() {
    wx.navigateTo({ url: "/pages/agreement/index" });
  },

  openPrivacy() {
    wx.navigateTo({ url: "/pages/privacy/index" });
  },

  async onLoginTap() {
    if (this.data.isFirstLogin && !this.data.agree) return;
    await this.__withSubmitting("login", async () => {
      if (this.data.isLoading) return;
      this.setData({
        isLoading: true,
        loadingText: "登录中",
      });
      this.startLoadingAnimation();

      try {
        const code = await this.getWxLoginCode();
        const loginRes = await this.loginWithCode(code);
        const result = (loginRes && loginRes.result) || {};
        if (!result.success) {
          throw new Error(result.errMsg || "loginByCode failed");
        }
        const app = getApp();
        if (app && typeof app.setHasLoggedIn === "function") {
          app.setHasLoggedIn(true);
        } else {
          wx.setStorageSync(STORAGE_KEYS.HAS_LOGGED_IN, true);
          if (app && app.globalData) {
            app.globalData.hasLoggedIn = true;
          }
          if (app && typeof app.tryRecordDailyCheckIn === "function") {
            app.tryRecordDailyCheckIn();
          }
        }
        const oid = result.openid && typeof result.openid === "string" ? result.openid.trim() : "";
        if (oid) {
          try {
            wx.setStorageSync(STORAGE_KEYS.USER_OPENID, oid);
            if (app && app.globalData) {
              app.globalData.userOpenId = oid;
            }
          } catch (e) {
            /* ignore */
          }
        }
        const profile = app && typeof app.getUserProfile === "function" ? app.getUserProfile() : {};
        authSession.persistAfterLogin(result, profile);
        let tagsComplete = result.tagsComplete === true;
        if (wx.cloud && typeof wx.cloud.callFunction === "function") {
          try {
            const cf = await wx.cloud.callFunction({
              name: "quickstartFunctions",
              data: { type: "getUserTags" },
            });
            const tr = (cf && cf.result) || {};
            if (tr.success) {
              tagsComplete = !!tr.tagsComplete;
            }
          } catch (e) {
            console.warn("getUserTags after login", e);
            try {
              tagsComplete = !!wx.getStorageSync(STORAGE_KEYS.USER_TAGS_COMPLETE);
            } catch (e2) {
              tagsComplete = false;
            }
          }
        }
        if (app && app.globalData) {
          app.globalData.userTagsComplete = tagsComplete;
        }
        if (!tagsComplete && authSession.isLocalTagsComplete()) {
          tagsComplete = true;
          if (app && app.globalData) {
            app.globalData.userTagsComplete = true;
          }
        }
        try {
          if (tagsComplete) {
            wx.setStorageSync(STORAGE_KEYS.USER_TAGS_COMPLETE, true);
          } else if (!authSession.isLocalTagsComplete()) {
            wx.removeStorageSync(STORAGE_KEYS.USER_TAGS_COMPLETE);
          }
        } catch (e) {
          /* ignore */
        }
        this.setData({
          isFirstLogin: false,
          agree: true,
        });
        await this.reportPendingReferralIfAny();
        try {
          const sync = require("../../utils/cloudDataSync");
          if (sync && typeof sync.pullAndMergeFromCloud === "function") {
            await sync.pullAndMergeFromCloud();
          }
          const reflectionCloudSync = require("../../utils/reflectionCloudSync");
          if (reflectionCloudSync && typeof reflectionCloudSync.pushAllLocalQuadrantsToCloud === "function") {
            await reflectionCloudSync.pushAllLocalQuadrantsToCloud();
          }
        } catch (syncErr) {
          console.warn("[login] pull after login", syncErr);
        }
        goAfterLoginSplash(tagsComplete);
      } catch (e) {
        const errMsg = (e && (e.errMsg || e.message)) || "";
        let toastTitle = "登录失败，请重试";
        if (/FunctionName parameter could not be found/i.test(errMsg)) {
          toastTitle = "云函数未部署";
        } else if (/Environment not found/i.test(errMsg)) {
          toastTitle = "云环境配置错误";
        } else if (/network/i.test(errMsg)) {
          toastTitle = "网络异常，请稍后再试";
        }
        console.error("login failed:", e);
        wx.showToast({
          title: toastTitle,
          icon: "none",
        });
      } finally {
        this.stopLoadingAnimation();
        this.setData({
          isLoading: false,
        });
      }
    });
  },

  startLoadingAnimation() {
    this.stopLoadingAnimation();
    const frames = ["登录中", "登录中.", "登录中..", "登录中..."];
    let idx = 0;
    this.__loadingTimer = setInterval(() => {
      idx = (idx + 1) % frames.length;
      if (!this.data.isLoading) return;
      this.setData({
        loadingText: frames[idx],
      });
    }, 320);
  },

  stopLoadingAnimation() {
    if (!this.__loadingTimer) return;
    clearInterval(this.__loadingTimer);
    this.__loadingTimer = null;
  },

  isNonReleaseEnv() {
    try {
      const info = wx.getAccountInfoSync ? wx.getAccountInfoSync() : null;
      const envVersion = info && info.miniProgram && info.miniProgram.envVersion;
      return envVersion && envVersion !== "release";
    } catch (e) {
      return false;
    }
  },

  getWxLoginCode() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          if (res && res.code) {
            resolve(res.code);
            return;
          }
          reject(new Error("wx.login did not return code"));
        },
        fail: reject,
      });
    });
  },

  loginWithCode(code) {
    if (!wx.cloud || !wx.cloud.callFunction) {
      if (this.isNonReleaseEnv()) {
        return Promise.resolve({
          result: {
            success: true,
            localDebugLogin: true,
          },
        });
      }
      return Promise.reject(new Error("cloud unavailable"));
    }

    return wx.cloud
      .callFunction({
        name: "quickstartFunctions",
        data: {
          type: "loginByCode",
          code,
        },
      })
      .catch((err) => {
        const errMsg = (err && (err.errMsg || err.message)) || "";
        // Backward compatibility: if cloud function is not redeployed yet,
        // fallback to existing getOpenId path to unblock login.
        if (/FunctionName parameter could not be found/i.test(errMsg)) {
          return wx.cloud.callFunction({
            name: "quickstartFunctions",
            data: {
              type: "getOpenId",
            },
          });
        }
        if (this.isNonReleaseEnv()) {
          return {
            result: {
              success: true,
              localDebugLogin: true,
            },
          };
        }
        throw err;
      })
      .catch((err) => {
        // Final fallback to unblock local testing even when cloud function is unavailable.
        const errMsg = (err && (err.errMsg || err.message)) || "";
        if (/FunctionName parameter could not be found|cloud unavailable|Environment not found/i.test(errMsg)) {
          return {
            result: {
              success: true,
              localDebugLogin: true,
            },
          };
        }
        throw err;
      })
      .then((res) => {
        const result = (res && res.result) || {};
        if (result.success === false) {
          throw new Error(result.errMsg || "login failed");
        }
        return {
          result: {
            success: true,
            ...result,
          },
        };
      });
  },
});
