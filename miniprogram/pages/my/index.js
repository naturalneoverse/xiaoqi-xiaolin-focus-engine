const STORAGE_KEYS = require("../../config/storageKeys");
const { clampNickname, clampSignature } = require("../../config/profileTextLimits");
const authSession = require("../../utils/authSession");
const { navigateToLogin, promptLoginIfNeeded } = require("../../utils/requireLogin");
const momentScore = require("../../utils/momentScore");
const dailyCheckIn = require("../../utils/dailyCheckIn");
const { ensureUserTagsOrLeave } = require("../../utils/userTagsGate");
const { applyProfileToPage, DEFAULT_AVATAR, resolveAvatarDisplayUrl, isCloudFileId } = require("../../utils/avatarDisplay");

Page({
  data: {
    momentWeekScore: 0,
    momentDisplayText: "0",
    momentUnitText: "次",
    streakDays: "0",
    notifyOn: true,
    isLoggedIn: false,
    userProfile: {
      avatarUrl: "",
      nickname: "用户名",
      signature: "我的个性签名",
    },
    avatarSrc: DEFAULT_AVATAR,
    editingName: false,
    editingSignature: false,
    editingNicknameValue: "",
    editingSignatureValue: "",
  },

  onLoad() {
    try {
      const shareRef = require("../../utils/shareReferrer");
      const auth = require("../../utils/authSession");
      shareRef.handleColdLaunchForQr(!!auth.hasLocalCredentials());
    } catch (e) {
      /* ignore */
    }
  },

  onShow() {
    const isLoggedIn = authSession.isLoggedIn();
    this.setData({ isLoggedIn });
    ensureUserTagsOrLeave().then((ok) => {
      if (!ok) return;
      dailyCheckIn.repairCheckInsFromActivity(true);
      dailyCheckIn.recordDailyCheckIn();
      this.loadTaskStats();
      this.syncUserProfile();
      if (isLoggedIn) {
        try {
          const profileCloudSync = require("../../utils/profileCloudSync");
          if (profileCloudSync && typeof profileCloudSync.pullAndMergeUserProfile === "function") {
            profileCloudSync
              .pullAndMergeUserProfile()
              .then(() => this.syncUserProfile())
              .catch(() => {});
          }
        } catch (e) {
          /* ignore */
        }
        try {
          const checkInCloudSync = require("../../utils/checkInCloudSync");
          if (checkInCloudSync && typeof checkInCloudSync.pullAndMergeCheckIns === "function") {
            checkInCloudSync
              .pullAndMergeCheckIns()
              .then(() => this.loadTaskStats())
              .catch(() => this.loadTaskStats());
          } else {
            this.loadTaskStats();
          }
        } catch (e2) {
          this.loadTaskStats();
        }
      } else {
        this.loadTaskStats();
      }
      this.syncNotifyFromApp();
      if (typeof this.getTabBar === "function" && this.getTabBar()) {
        this.getTabBar().setData({ selected: 2 });
      }
    });
  },

  loadTaskStats() {
    let tasks = [];
    try {
      const raw = wx.getStorageSync(STORAGE_KEYS.TASKS_DATA);
      tasks = Array.isArray(raw) ? raw : [];
    } catch (e) {
      console.error("my loadTaskStats getStorageSync", e);
      tasks = [];
    }
    const cur = momentScore.getCurrentWeekSummary(tasks, new Date());
    const momentView = momentScore.buildMomentScoreView(cur.momentScore);
    const streak = dailyCheckIn.getCheckInTotalDays();
    this.setData({
      momentWeekScore: cur.momentScore,
      momentDisplayText: momentView.displayText,
      momentUnitText: momentView.unitText,
      streakDays: String(streak),
    });
  },

  syncNotifyFromApp() {
    const app = getApp();
    if (app && app.globalData && app.globalData.settings && typeof app.globalData.settings.reminderEnabled === "boolean") {
      this.setData({ notifyOn: app.globalData.settings.reminderEnabled });
    }
  },

  onGlobalUserProfileChange(nextProfile) {
    applyProfileToPage(this, nextProfile);
  },

  syncUserProfile() {
    const app = getApp();
    if (!app || typeof app.getUserProfile !== "function") return Promise.resolve();
    return applyProfileToPage(this, app.getUserProfile());
  },

  onAvatarImageError() {
    const app = getApp();
    const stored =
      app && typeof app.getUserProfile === "function"
        ? app.getUserProfile().avatarUrl
        : this.data.userProfile.avatarUrl;
    if (isCloudFileId(stored)) {
      resolveAvatarDisplayUrl(stored).then((url) => {
        this.setData({ avatarSrc: url || DEFAULT_AVATAR });
      });
      return;
    }
    this.setData({ avatarSrc: DEFAULT_AVATAR });
  },

  onTapLogin() {
    navigateToLogin();
  },

  onChooseAvatar(e) {
    if (!authSession.isLoggedIn()) {
      promptLoginIfNeeded({
        content: "登录后可设置头像并同步到云端。",
      });
      return;
    }
    const tempPath = e && e.detail && e.detail.avatarUrl;
    if (!tempPath) return;
    const { uploadAvatarFromTempPath } = require("../../utils/avatarUpload");
    if (this.data.__submitting_avatarUpload) return;
    this.setData({ __submitting_avatarUpload: true });
    uploadAvatarFromTempPath(tempPath)
      .then((ok) => {
        if (ok) return this.syncUserProfile();
        return ok;
      })
      .finally(() => {
        this.setData({ __submitting_avatarUpload: false });
      });
  },

  startEditNickname() {
    if (!authSession.isLoggedIn()) {
      promptLoginIfNeeded({ content: "登录后可修改昵称并同步到云端。" });
      return;
    }
    const current = this.data.userProfile.nickname || "";
    this.setData({
      editingName: true,
      editingNicknameValue: current === "用户名" ? "" : current,
    });
  },

  onNicknameInput(e) {
    this.setData({
      editingNicknameValue: clampNickname((e.detail && e.detail.value) || ""),
    });
  },

  onNicknameBlur() {
    this.finishTextEdit("nickname", "editingNicknameValue", "editingName");
  },

  startEditSignature() {
    if (!authSession.isLoggedIn()) {
      promptLoginIfNeeded({ content: "登录后可修改签名并同步到云端。" });
      return;
    }
    const current = this.data.userProfile.signature || "";
    this.setData({
      editingSignature: true,
      editingSignatureValue: current === "我的个性签名" ? "" : current,
    });
  },

  onSignatureInput(e) {
    this.setData({
      editingSignatureValue: clampSignature((e.detail && e.detail.value) || ""),
    });
  },

  onSignatureBlur() {
    this.finishTextEdit("signature", "editingSignatureValue", "editingSignature");
  },

  finishTextEdit(fieldName, draftKey, editingFlagKey) {
    const app = getApp();
    const previousValue = this.data.userProfile[fieldName] || "";
    const rawDraft = this.data[draftKey] || "";
    const draftValue =
      fieldName === "nickname"
        ? clampNickname(rawDraft).trim()
        : fieldName === "signature"
          ? clampSignature(rawDraft).trim()
          : rawDraft.trim();
    /** 签名允许清空；昵称空则回落为默认「用户名」（与 profile-nickname 一致） */
    const nextValue =
      fieldName === "signature"
        ? draftValue
        : fieldName === "nickname"
          ? draftValue || "用户名"
          : draftValue || previousValue;
    const ok = app && typeof app.setUserProfile === "function" ? app.setUserProfile({ [fieldName]: nextValue }) : false;
    if (!ok) {
      this.setData({
        [editingFlagKey]: false,
        [draftKey]: previousValue,
        userProfile: {
          ...this.data.userProfile,
          [fieldName]: previousValue,
        },
      });
      wx.showToast({
        title: "保存失败，已还原",
        icon: "none",
      });
      return;
    }
    this.setData({
      [editingFlagKey]: false,
      [draftKey]: nextValue,
      userProfile: {
        ...this.data.userProfile,
        [fieldName]: nextValue,
      },
    });
    dailyCheckIn.recordDailyCheckIn();
    this.loadTaskStats();
  },

  onTapSetting() {
    if (!authSession.isLoggedIn()) {
      promptLoginIfNeeded({ content: "登录后可进入账号设置。" });
      return;
    }
    wx.navigateTo({
      url: "/pages/settings/index",
    });
  },

  onNotifyChange(e) {
    const notifyOn = !!e.detail.value;
    this.setData({ notifyOn });
    const app = getApp();
    if (app && typeof app.setSettings === "function") {
      app.setSettings({ reminderEnabled: notifyOn });
      return;
    }
    try {
      wx.setStorageSync(STORAGE_KEYS.REMINDER_ENABLED, notifyOn);
      if (app && app.globalData) {
        app.globalData.settings = {
          ...(app.globalData.settings || {}),
          reminderEnabled: notifyOn,
        };
      }
    } catch (e) {
      console.error("my onNotifyChange persist", e);
    }
  },

  goCreateTask() {
    const key = momentScore.weekMondayKey(momentScore.getIsoWeekMonday(new Date()));
    wx.navigateTo({
      url: `/subpkg/poster/index?weekStart=${encodeURIComponent(key)}`,
    });
  },

  goCheckInCalendar() {
    wx.navigateTo({
      url: "/subpkg/check-in-calendar/index",
    });
  },

  goMomentWeekHistory() {
    wx.navigateTo({
      url: "/subpkg/moment-week-list/index",
    });
  },

  goTimeReport() {
    wx.navigateTo({
      url: "/subpkg/weekly-report-list/index",
    });
  },

  goReflectionList() {
    if (
      !promptLoginIfNeeded({
        content: "哲思复盘需登录后使用云端 AI 能力。",
      })
    ) {
      return;
    }
    wx.navigateTo({
      url: "/subpkg/reflection-list/index",
    });
  },

  goBodyToday() {
    wx.navigateTo({
      url: "/subpkg/body-report-list/index",
    });
  },

  goHelp() {
    wx.navigateTo({
      url: "/subpkg/help/index",
    });
  },

  goAbout() {
    wx.navigateTo({
      url: "/subpkg/about/index",
    });
  },
});
