// app.js
const TAB_PAGE_ROUTES = new Set(["pages/sleep/index", "pages/index/index", "pages/my/index"]);
const NO_TOP_SAFE_AREA_ROUTES = new Set(["pages/login/index", "pages/onboarding-tags/index", "pages/launch/launch"]);
/** 仅这些页为自定义导航，需顶部安全区 padding；其余使用系统导航，由微信留出标题栏，不再叠加 top padding */
const CUSTOM_NAV_ROUTES = new Set([
  "pages/agreement/index",
  "pages/my/index",
  "pages/task-create/index",
  "pages/task-detail/index",
  "subpkg/time-report/index",
  "subpkg/poster/index",
  "pages/settings/index",
  "pages/privacy/index",
  "pages/profile-edit-menu/index",
  "pages/profile-nickname/index",
  "pages/profile-signature/index",
]);

/** 与 app.json、Page.route 对齐；个别运行环境 route 带前导 /，Set 匹配须归一化 */
function normalizeRoute(route) {
  if (typeof route !== "string") return "";
  const t = route.trim();
  return t.startsWith("/") ? t.slice(1) : t;
}
const STORAGE_KEYS = require("./config/storageKeys");
const { clampNickname, clampSignature } = require("./config/profileTextLimits");
const DEFAULT_USER_PROFILE = {
  avatarUrl: "/images/transparent background/avatar.png",
  nickname: "用户名",
  signature: "我的个性签名",
};
const DEFAULT_SETTINGS = {
  reminderEnabled: true,
};

/** 产品版本：关于页、设置页展示；与 miniprogram/package.json 的 version 同步 */
const APP_VERSION = "1.2.0";

function getWindowInfoSafe() {
  try {
    if (wx.getWindowInfo) return wx.getWindowInfo();
    return wx.getSystemInfoSync();
  } catch (e) {
    return {};
  }
}

function computeSafeAreaInsets() {
  let statusBarHeight = 0;
  let windowHeight = 0;
  let safeAreaBottom = 0;
  let windowWidth = 375;

  const win = getWindowInfoSafe();
  statusBarHeight = win.statusBarHeight || 0;
  windowHeight = win.windowHeight || 0;
  windowWidth = win.windowWidth || 375;
  if (win.safeArea) safeAreaBottom = win.safeArea.bottom || 0;

  let topInset = statusBarHeight;
  try {
    const menuRect = wx.getMenuButtonBoundingClientRect ? wx.getMenuButtonBoundingClientRect() : null;
    if (menuRect && menuRect.top) {
      // Keep content in the same horizontal band as the native capsule.
      topInset = Math.max(menuRect.top, statusBarHeight);
    }
  } catch (e) {
    // Keep status bar fallback.
  }
  // 少数机型 menuRect / 安全区异常会把顶距算得极大，与 min-height:100vh 叠加后正文区被压没（与底边异常同类）。
  const MAX_SANE_TOP_INSET = 160;
  if (topInset > MAX_SANE_TOP_INSET) {
    topInset = Math.min(Math.max(statusBarHeight, 24) + 44, MAX_SANE_TOP_INSET);
  }

  let bottomInset = 0;
  if (windowHeight && safeAreaBottom) {
    bottomInset = Math.max(windowHeight - safeAreaBottom, 0);
    // 部分机型 safeArea.bottom 异常偏小，差值会接近整屏高度；配合全页 min-height:100vh
    // 与 box-sizing:border-box 时，极大 padding-bottom 会把正文可用高度压成 0（任务详情/报告类页共性空白）。
    const MAX_SANE_BOTTOM_INSET = 120;
    if (bottomInset > MAX_SANE_BOTTOM_INSET) {
      bottomInset = 34;
    }
  }
  return {
    top: Math.max(topInset, 0),
    bottom: Math.max(bottomInset, 0),
    windowWidth,
  };
}

function getTabBarExtraBottom(route, windowWidth) {
  const r = normalizeRoute(route);
  if (!TAB_PAGE_ROUTES.has(r)) return 0;
  const unit = windowWidth / 750;
  /** tab 壳 148rpx + 底距 12rpx + 与内容间距 44rpx */
  return Math.ceil(unit * 204);
}

function buildSafeAreaStyle(route) {
  const r = normalizeRoute(route);
  const insets = computeSafeAreaInsets();
  let bottom = insets.bottom + getTabBarExtraBottom(r, insets.windowWidth);
  const MAX_TOTAL_BOTTOM_PADDING = TAB_PAGE_ROUTES.has(r) ? 300 : 160;
  if (bottom > MAX_TOTAL_BOTTOM_PADDING) {
    bottom = Math.min(insets.bottom, 80) + getTabBarExtraBottom(r, insets.windowWidth);
    if (bottom > MAX_TOTAL_BOTTOM_PADDING) {
      bottom = getTabBarExtraBottom(r, insets.windowWidth) + Math.min(insets.bottom, 34);
    }
  }
  let topPx = 0;
  if (NO_TOP_SAFE_AREA_ROUTES.has(r)) {
    topPx = 0;
  } else if (CUSTOM_NAV_ROUTES.has(r)) {
    topPx = insets.top;
  } else {
    const win = getWindowInfoSafe();
    const ww = win.windowWidth || 375;
    // 系统导航页：默认约 24rpx；时间首页「今日任务」与 + 需更疏朗
    let rpx = 24;
    if (r === "pages/sleep/index") rpx = 44;
    topPx = Math.ceil((rpx / 750) * ww);
  }
  return `padding-top:${topPx}px;padding-bottom:${bottom}px;box-sizing:border-box;`;
}

const rawPage = Page;
if (!wx.__GLOBAL_SAFE_AREA_PATCHED__) {
  wx.__GLOBAL_SAFE_AREA_PATCHED__ = true;
  Page = function safeAreaPage(pageOptions) {
    const options = pageOptions || {};
    const originalData = options.data || {};
    const originalOnLoad = options.onLoad;
    const originalOnShow = options.onShow;
    const originalOnHide = options.onHide;

    options.data = {
      ...originalData,
      _globalSafeAreaStyle: originalData._globalSafeAreaStyle || "",
      _globalImagePlaceholder: originalData._globalImagePlaceholder || "/images/transparent background/avatar.png",
      mascotAnimPaused: false,
    };

    options.__applyGlobalSafeArea = function applyGlobalSafeArea() {
      const nextStyle = buildSafeAreaStyle(this.route || "");
      if (this.data && this.data._globalSafeAreaStyle === nextStyle) return;
      this.setData({
        _globalSafeAreaStyle: nextStyle,
      });
    };

    options.__safeNavigateBack = function safeNavigateBack(fallbackTabPath = "pages/sleep/index") {
      const pages = getCurrentPages();
      const fallback = fallbackTabPath || "pages/sleep/index";
      const { switchTabRobust } = require("./utils/goTabHome");
      if (pages.length > 1) {
        wx.navigateBack({
          fail: (err) => {
            console.warn("[__safeNavigateBack] navigateBack fail, use tab fallback", err);
            switchTabRobust(fallback.startsWith("/") ? fallback.slice(1) : fallback);
          },
        });
        return;
      }
      switchTabRobust(fallback.startsWith("/") ? fallback.slice(1) : fallback);
    };

    options.__withSubmitting = function withSubmitting(key, task) {
      const app = getApp();
      if (!app || typeof app.withSubmitting !== "function") {
        return Promise.resolve().then(task);
      }
      return app.withSubmitting(this, key, task);
    };

    if (typeof options.onImageError !== "function") {
      options.onImageError = function onImageError(e) {
        const field = e && e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.errField : "";
        if (!field) return;
        this.setData({
          [field]: this.data._globalImagePlaceholder,
        });
      };
    }

    options.onLoad = function wrappedOnLoad(...args) {
      this.__applyGlobalSafeArea();
      if (typeof originalOnLoad === "function") {
        originalOnLoad.apply(this, args);
      }
    };

    options.onShow = function wrappedOnShow(...args) {
      this.__applyGlobalSafeArea();
      const app = getApp();
      const paused = !!(app && app.globalData && app.globalData.mascotAnimPaused);
      if (this.data && this.data.mascotAnimPaused !== paused) {
        this.setData({ mascotAnimPaused: paused });
      }
      if (typeof originalOnShow === "function") {
        originalOnShow.apply(this, args);
      }
    };

    options.onHide = function wrappedOnHide(...args) {
      if (this.data && !this.data.mascotAnimPaused) {
        this.setData({ mascotAnimPaused: true });
      }
      if (typeof originalOnHide === "function") {
        originalOnHide.apply(this, args);
      }
    };

    return rawPage(options);
  };
}

App({
  onError(err) {
    const msg = typeof err === "string" ? err : err && (err.message || err.errMsg);
    console.error("[App.onError]", msg || err);
    try {
      const text = String(msg || err || "unknown").slice(0, 800);
      wx.setStorageSync("__app_last_error", { at: Date.now(), msg: text });
    } catch (e) {
      /* ignore */
    }
  },
  onPageNotFound(res) {
    console.error("[App.onPageNotFound]", res && (res.path || res));
  },
  onLaunch: function () {
    const localProfile = this.loadLocalUserProfile();
    const localSettings = this.loadLocalSettings();
    const hasLoggedIn = this.loadHasLoggedIn();
    const tagsCache = (() => {
      try {
        return !!wx.getStorageSync(STORAGE_KEYS.USER_TAGS_COMPLETE);
      } catch (e) {
        return false;
      }
    })();
    let userOpenId = "";
    try {
      const oid = wx.getStorageSync(STORAGE_KEYS.USER_OPENID);
      if (typeof oid === "string" && oid) userOpenId = oid;
    } catch (e) {
      /* ignore */
    }
    this.globalData = {
      // env 参数说明：
      // env 参数决定接下来小程序发起的云开发调用（wx.cloud.xxx）会请求到哪个云环境的资源
      // 此处请填入环境 ID, 环境 ID 可在微信开发者工具右上顶部工具栏点击云开发按钮打开获取
      env: "cloud1-9goe0m7d1d397415",
      imageAssets: {
        logo: "/images/transparent background/logo.png",
        xiaoqi: "/images/transparent background/xiaoqi.png",
        xiaolin: "/images/transparent background/xiaolin.png",
        placeholder: "/images/transparent background/avatar.png",
      },
      userProfile: localProfile,
      settings: localSettings,
      /** 当前用户 openid，供分享 path 拼接 shareUid（登录后写入） */
      userOpenId,
      hasLoggedIn,
      /** 首次用户标签是否已在云端填写完成（换机后由云拉取更新） */
      userTagsComplete: hasLoggedIn ? tagsCache : false,
      safeAreaInsets: computeSafeAreaInsets(),
      APP_VERSION,
      /** wx.cloud.init 成功前勿调 callFunction；仅在为 true 时允许数据同步 */
      cloudInitOk: false,
      mascotAnimPaused: false,
    };
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
      this.globalData.cloudInitOk = false;
    } else {
      try {
        wx.cloud.init({
          env: this.globalData.env,
          traceUser: true,
        });
        this.globalData.cloudInitOk = true;
      } catch (e) {
        console.error("[App.onLaunch] wx.cloud.init failed", e);
        this.globalData.cloudInitOk = false;
      }
      if (this.globalData.cloudInitOk && this.globalData.hasLoggedIn) {
        setTimeout(() => {
          const { callFunction } = require("./utils/cloudCall");
          callFunction(
            {
              name: "quickstartFunctions",
              data: { type: "getUserTags" },
            },
            8000,
          )
            .then((res) => {
              const r = (res && res.result) || {};
              if (!r.success) return;
              if (r.tagsComplete) {
                this.globalData.userTagsComplete = true;
                try {
                  wx.setStorageSync(STORAGE_KEYS.USER_TAGS_COMPLETE, true);
                  wx.removeStorageSync(STORAGE_KEYS.USER_TAGS_LOCAL);
                } catch (e) {
                  /* ignore */
                }
              } else {
                let localPending = false;
                try {
                  const lo = wx.getStorageSync(STORAGE_KEYS.USER_TAGS_LOCAL);
                  localPending = !!(lo && lo.gender && lo.lifeStage && Array.isArray(lo.roles) && lo.roles.length >= 2);
                } catch (e) {
                  localPending = false;
                }
                let storageTagsComplete = false;
                try {
                  storageTagsComplete = !!wx.getStorageSync(STORAGE_KEYS.USER_TAGS_COMPLETE);
                } catch (e) {
                  storageTagsComplete = false;
                }
                // 云端未部署 / save 未落库时，getUserTags 会返回 tagsComplete:false。
                // 若此时本机已标记完成（问卷兜底或上次会话），不得清存储，否则 ensureUserTagsOrLeave
                // 会反复 reLaunch 问卷，表现为「身心/我的进不去」、关闭键看似失灵。
                if (localPending || storageTagsComplete) {
                  this.globalData.userTagsComplete = true;
                } else {
                  this.globalData.userTagsComplete = false;
                  try {
                    wx.removeStorageSync(STORAGE_KEYS.USER_TAGS_COMPLETE);
                  } catch (e) {
                    /* ignore */
                  }
                }
              }
            })
            .catch(() => {});
        }, 200);
        setTimeout(() => {
          try {
            const m = require("./utils/cloudDataSync");
            if (m && typeof m.runStartupSync === "function") {
              m.runStartupSync();
            }
          } catch (e) {
            console.warn("[App] cloudDataSync startup", e);
          }
        }, 1400);
      }
    }
  },

  tryRecordDailyCheckIn() {
    if (!this.globalData || !this.globalData.hasLoggedIn) return;
    try {
      require("./utils/dailyCheckIn").recordDailyCheckIn();
    } catch (e) {
      console.warn("[App] recordDailyCheckIn", e);
    }
  },

  onShow() {
    this.globalData.mascotAnimPaused = false;
    try {
      require("./utils/mascotAnimSync").syncMascotAnimPaused(false);
    } catch (e) {
      /* ignore */
    }
    this.tryRecordDailyCheckIn();
    try {
      const m = require("./utils/cloudDataSync");
      if (m && typeof m.runIncrementalDebounced === "function") {
        m.runIncrementalDebounced();
      }
    } catch (e) {
      /* ignore */
    }
  },

  onHide() {
    this.globalData.mascotAnimPaused = true;
    try {
      require("./utils/mascotAnimSync").syncMascotAnimPaused(true);
    } catch (e) {
      /* ignore */
    }
  },

  loadLocalUserProfile() {
    try {
      const saved = wx.getStorageSync(STORAGE_KEYS.USER_PROFILE);
      if (!saved || typeof saved !== "object") return { ...DEFAULT_USER_PROFILE };
      return {
        ...DEFAULT_USER_PROFILE,
        ...saved,
      };
    } catch (e) {
      return { ...DEFAULT_USER_PROFILE };
    }
  },

  loadLocalSettings() {
    try {
      const reminderEnabled = wx.getStorageSync(STORAGE_KEYS.REMINDER_ENABLED);
      return {
        ...DEFAULT_SETTINGS,
        reminderEnabled: typeof reminderEnabled === "boolean" ? reminderEnabled : DEFAULT_SETTINGS.reminderEnabled,
      };
    } catch (e) {
      return { ...DEFAULT_SETTINGS };
    }
  },

  setSettings(nextPatch) {
    const previous = (this.globalData && this.globalData.settings) || DEFAULT_SETTINGS;
    const nextSettings = {
      ...previous,
      ...(nextPatch || {}),
    };
    try {
      wx.setStorageSync(STORAGE_KEYS.REMINDER_ENABLED, !!nextSettings.reminderEnabled);
      this.globalData.settings = nextSettings;
      return true;
    } catch (e) {
      return false;
    }
  },

  loadHasLoggedIn() {
    try {
      const auth = require("./utils/authSession");
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

  setHasLoggedIn(nextValue) {
    const value = !!nextValue;
    if (!value) {
      try {
        const auth = require("./utils/authSession");
        if (auth && typeof auth.clearSessionStorage === "function") {
          auth.clearSessionStorage();
        }
      } catch (e) {
        /* ignore */
      }
    }
    try {
      wx.setStorageSync(STORAGE_KEYS.HAS_LOGGED_IN, value);
      this.globalData.hasLoggedIn = value;
      if (value) {
        this.tryRecordDailyCheckIn();
      }
      if (value && this.globalData && this.globalData.cloudInitOk === true) {
        try {
          const m = require("./utils/cloudDataSync");
          if (m && typeof m.runStartupSync === "function") {
            m.runStartupSync();
          }
        } catch (e) {
          console.warn("[App] cloudDataSync after login", e);
        }
      }
      return true;
    } catch (e) {
      return false;
    }
  },

  withSubmitting(page, key, task) {
    if (!page || typeof task !== "function") return Promise.resolve();
    const stateKey = `__submitting_${key || "default"}`;
    if (page.data && page.data[stateKey]) return Promise.resolve(false);
    page.setData({
      [stateKey]: true,
    });
    const clearSubmitting = () => {
      try {
        page.setData({ [stateKey]: false });
      } catch (e) {
        /* ignore */
      }
    };
    return Promise.resolve()
      .then(task)
      .then(
        (v) => {
          clearSubmitting();
          return v;
        },
        (err) => {
          clearSubmitting();
          throw err;
        }
      );
  },

  getUserProfile() {
    const current = (this.globalData && this.globalData.userProfile) || {};
    return {
      ...DEFAULT_USER_PROFILE,
      ...current,
    };
  },

  setUserProfile(nextPatch, options) {
    const previous = this.getUserProfile();
    const patch = { ...(nextPatch || {}) };
    const opt = options || {};
    const markCustomized = opt.markCustomized !== false;
    const syncUserInfo = opt.syncUserInfo !== false;
    const skipCloudPush = opt.skipCloudPush === true;
    if (Object.prototype.hasOwnProperty.call(patch, "nickname")) {
      patch.nickname = clampNickname(patch.nickname != null ? String(patch.nickname) : "");
    }
    if (Object.prototype.hasOwnProperty.call(patch, "signature")) {
      patch.signature = clampSignature(patch.signature != null ? String(patch.signature) : "");
    }
    const nextProfile = {
      ...previous,
      ...patch,
      updatedAtMs: Date.now(),
    };
    try {
      wx.setStorageSync(STORAGE_KEYS.USER_PROFILE, nextProfile);
      this.globalData.userProfile = nextProfile;
      const auth = require("./utils/authSession");
      if (markCustomized && typeof auth.markProfileCustomized === "function") {
        auth.markProfileCustomized(true);
      }
      if (syncUserInfo && typeof auth.syncUserInfoFromProfile === "function") {
        auth.syncUserInfoFromProfile(nextProfile);
      }
      const pages = getCurrentPages();
      pages.forEach((page) => {
        if (page && typeof page.onGlobalUserProfileChange === "function") {
          page.onGlobalUserProfileChange(nextProfile);
        }
      });
      if (!skipCloudPush && this.globalData && this.globalData.hasLoggedIn) {
        try {
          const profileCloudSync = require("./utils/profileCloudSync");
          if (profileCloudSync && typeof profileCloudSync.schedulePushUserProfile === "function") {
            profileCloudSync.schedulePushUserProfile();
          }
        } catch (e) {
          /* ignore */
        }
      }
      return true;
    } catch (e) {
      return false;
    }
  },
});
