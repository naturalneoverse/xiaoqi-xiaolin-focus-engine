// app.js
const TAB_PAGE_ROUTES = new Set(["pages/sleep/index", "pages/index/index", "pages/my/index"]);
const NO_TOP_SAFE_AREA_ROUTES = new Set(["pages/login/index"]);
const STORAGE_KEYS = require("./config/storageKeys");
const DEFAULT_USER_PROFILE = {
  avatarUrl: "/images/transparent background/avatar.png",
  nickname: "用户名",
  signature: "我的个性签名",
};
const DEFAULT_SETTINGS = {
  reminderEnabled: true,
};

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

  let bottomInset = 0;
  if (windowHeight && safeAreaBottom) {
    bottomInset = Math.max(windowHeight - safeAreaBottom, 0);
  }
  return {
    top: Math.max(topInset, 0),
    bottom: Math.max(bottomInset, 0),
    windowWidth,
  };
}

function getTabBarExtraBottom(route, windowWidth) {
  if (!TAB_PAGE_ROUTES.has(route)) return 0;
  const unit = windowWidth / 750;
  return Math.ceil(unit * 160);
}

function buildSafeAreaStyle(route) {
  const insets = computeSafeAreaInsets();
  const bottom = insets.bottom + getTabBarExtraBottom(route, insets.windowWidth);
  const top = NO_TOP_SAFE_AREA_ROUTES.has(route) ? 0 : insets.top;
  return `padding-top:${top}px;padding-bottom:${bottom}px;box-sizing:border-box;`;
}

const rawPage = Page;
if (!wx.__GLOBAL_SAFE_AREA_PATCHED__) {
  wx.__GLOBAL_SAFE_AREA_PATCHED__ = true;
  Page = function safeAreaPage(pageOptions) {
    const options = pageOptions || {};
    const originalData = options.data || {};
    const originalOnLoad = options.onLoad;
    const originalOnShow = options.onShow;

    options.data = {
      ...originalData,
      _globalSafeAreaStyle: originalData._globalSafeAreaStyle || "",
      _globalImagePlaceholder: originalData._globalImagePlaceholder || "/images/transparent background/avatar.png",
    };

    options.__applyGlobalSafeArea = function applyGlobalSafeArea() {
      const nextStyle = buildSafeAreaStyle(this.route || "");
      if (this.data && this.data._globalSafeAreaStyle === nextStyle) return;
      this.setData({
        _globalSafeAreaStyle: nextStyle,
      });
    };

    options.__safeNavigateBack = function safeNavigateBack(fallbackTabPath = "/pages/sleep/index") {
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack();
        return;
      }
      wx.switchTab({
        url: fallbackTabPath,
      });
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
      if (typeof originalOnShow === "function") {
        originalOnShow.apply(this, args);
      }
    };

    return rawPage(options);
  };
}

App({
  onLaunch: function () {
    const localProfile = this.loadLocalUserProfile();
    const localSettings = this.loadLocalSettings();
    const hasLoggedIn = this.loadHasLoggedIn();
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
      hasLoggedIn,
      safeAreaInsets: computeSafeAreaInsets(),
      pendingProfileEditField: "",
    };
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
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
      return !!wx.getStorageSync(STORAGE_KEYS.HAS_LOGGED_IN);
    } catch (e) {
      return false;
    }
  },

  setHasLoggedIn(nextValue) {
    const value = !!nextValue;
    try {
      wx.setStorageSync(STORAGE_KEYS.HAS_LOGGED_IN, value);
      this.globalData.hasLoggedIn = value;
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
    return Promise.resolve()
      .then(task)
      .finally(() => {
        page.setData({
          [stateKey]: false,
        });
      });
  },

  getUserProfile() {
    const current = (this.globalData && this.globalData.userProfile) || {};
    return {
      ...DEFAULT_USER_PROFILE,
      ...current,
    };
  },

  setUserProfile(nextPatch) {
    const previous = this.getUserProfile();
    const nextProfile = {
      ...previous,
      ...(nextPatch || {}),
    };
    try {
      wx.setStorageSync(STORAGE_KEYS.USER_PROFILE, nextProfile);
      this.globalData.userProfile = nextProfile;
      const pages = getCurrentPages();
      pages.forEach((page) => {
        if (page && typeof page.onGlobalUserProfileChange === "function") {
          page.onGlobalUserProfileChange(nextProfile);
        }
      });
      return true;
    } catch (e) {
      return false;
    }
  },
});
