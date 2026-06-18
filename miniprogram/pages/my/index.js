const STORAGE_KEYS = require("../../config/storageKeys");
const { clampNickname, clampSignature } = require("../../config/profileTextLimits");
const { requireLoginOnLoad } = require("../../utils/requireLogin");
const momentScore = require("../../utils/momentScore");
const dailyCheckIn = require("../../utils/dailyCheckIn");
const { ensureUserTagsOrLeave } = require("../../utils/userTagsGate");

Page({
  data: {
    momentWeekScore: 0,
    streakDays: 0,
    notifyOn: true,
    userProfile: {
      avatarUrl: "",
      nickname: "用户名",
      signature: "我的个性签名",
    },
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
    if (!requireLoginOnLoad()) return;
  },

  onShow() {
    ensureUserTagsOrLeave().then((ok) => {
      if (!ok) return;
      this.syncUserProfile();
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
      this.loadTaskStats();
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
    const streak = dailyCheckIn.getCheckInTotalDays();
    this.setData({
      momentWeekScore: cur.momentScore,
      streakDays: streak,
    });
  },

  syncNotifyFromApp() {
    const app = getApp();
    if (app && app.globalData && app.globalData.settings && typeof app.globalData.settings.reminderEnabled === "boolean") {
      this.setData({ notifyOn: app.globalData.settings.reminderEnabled });
    }
  },

  onGlobalUserProfileChange(nextProfile) {
    this.setData({
      userProfile: { ...nextProfile },
    });
  },

  syncUserProfile() {
    const app = getApp();
    if (!app || typeof app.getUserProfile !== "function") return;
    this.setData({
      userProfile: app.getUserProfile(),
    });
  },

  onTapAvatar() {
    const { pickAndUploadUserAvatar } = require("../../utils/avatarUpload");
    return this.__withSubmitting("avatarUpload", async () => {
      const ok = await pickAndUploadUserAvatar();
      if (ok) this.syncUserProfile();
    });
  },

  startEditNickname() {
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

  goTimeReport() {
    wx.navigateTo({
      url: "/subpkg/weekly-report-list/index",
    });
  },

  goReflectionList() {
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
