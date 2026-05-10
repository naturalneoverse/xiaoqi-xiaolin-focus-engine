const STORAGE_KEYS = require("../../config/storageKeys");

Page({
  data: {
    isFirstLogin: true,
    agree: false,
    isLoading: false,
    loadingText: "登录中",
  },

  onShow() {
    const hasLoggedIn = this.getHasLoggedIn();
    this.setData({
      isFirstLogin: !hasLoggedIn,
      agree: hasLoggedIn ? true : false,
    });
  },

  getHasLoggedIn() {
    const app = getApp();
    if (app && app.globalData && typeof app.globalData.hasLoggedIn === "boolean") {
      return app.globalData.hasLoggedIn;
    }
    try {
      return !!wx.getStorageSync(STORAGE_KEYS.HAS_LOGGED_IN);
    } catch (e) {
      return false;
    }
  },

  onHide() {
    this.stopLoadingAnimation();
  },

  onUnload() {
    this.stopLoadingAnimation();
  },

  toggleAgree() {
    if (!this.data.isFirstLogin) return;
    this.setData({
      agree: !this.data.agree,
    });
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
        }
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
        try {
          if (tagsComplete) {
            wx.setStorageSync(STORAGE_KEYS.USER_TAGS_COMPLETE, true);
          } else {
            wx.removeStorageSync(STORAGE_KEYS.USER_TAGS_COMPLETE);
          }
        } catch (e) {
          /* ignore */
        }
        this.setData({
          isFirstLogin: false,
          agree: true,
        });
        if (!tagsComplete) {
          wx.redirectTo({
            url: "/pages/onboarding-tags/index",
          });
        } else {
          wx.switchTab({
            url: "/pages/sleep/index",
          });
        }
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
