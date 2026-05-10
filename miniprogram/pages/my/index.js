const STORAGE_KEYS = require("../../config/storageKeys");
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

  onShow() {
    ensureUserTagsOrLeave().then((ok) => {
      if (!ok) return;
      this.syncUserProfile();
      this.loadTaskStats();
      this.syncNotifyFromApp();
      this.tryOpenPendingProfileEdit();
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
    const streak = dailyCheckIn.getCheckInStreakDays(new Date());
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

  tryOpenPendingProfileEdit() {
    const app = getApp();
    const field = app && app.globalData ? app.globalData.pendingProfileEditField : "";
    if (!field) return;
    app.globalData.pendingProfileEditField = "";
    if (field === "头像") {
      this.onTapAvatar();
      return;
    }
    if (field === "昵称") {
      this.startEditNickname();
      return;
    }
    if (field === "个性签名") {
      this.startEditSignature();
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
    return this.__withSubmitting("avatarUpload", async () => {
      const app = getApp();
      const previousAvatar = this.data.userProfile.avatarUrl;
      wx.chooseImage({
        count: 1,
        sizeType: ["compressed"],
        sourceType: ["album"],
        success: async (res) => {
          const tempFilePath = res.tempFilePaths && res.tempFilePaths[0];
          if (!tempFilePath) return;
          wx.showLoading({ title: "上传中", mask: true });
          try {
            const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).slice(2)}.png`;
            const uploadRes = await wx.cloud.uploadFile({
              cloudPath,
              filePath: tempFilePath,
            });
            const fileID = uploadRes && uploadRes.fileID;
            if (!fileID) throw new Error("avatar_upload_no_fileid");
            const ok = app.setUserProfile({
              avatarUrl: fileID,
            });
            if (!ok) throw new Error("avatar_save_failed");
            dailyCheckIn.recordDailyCheckIn();
            wx.showToast({ title: "头像已更新", icon: "success" });
          } catch (e) {
            app.setUserProfile({ avatarUrl: previousAvatar });
            wx.showToast({ title: "上传失败", icon: "none" });
          } finally {
            wx.hideLoading();
          }
        },
      });
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
      editingNicknameValue: e.detail.value,
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
      editingSignatureValue: e.detail.value,
    });
  },

  onSignatureBlur() {
    this.finishTextEdit("signature", "editingSignatureValue", "editingSignature");
  },

  finishTextEdit(fieldName, draftKey, editingFlagKey) {
    const app = getApp();
    const previousValue = this.data.userProfile[fieldName] || "";
    const draftValue = (this.data[draftKey] || "").trim();
    const nextValue = draftValue || previousValue;
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
    this.setData({
      notifyOn: e.detail.value,
    });
  },

  goCreateTask() {
    const key = momentScore.weekMondayKey(momentScore.getIsoWeekMonday(new Date()));
    wx.navigateTo({
      url: `/pages/poster/index?weekStart=${encodeURIComponent(key)}`,
    });
  },

  goTimeReport() {
    const key = momentScore.weekMondayKey(momentScore.getIsoWeekMonday(new Date()));
    wx.navigateTo({
      url: `/pages/weekly-report/index?weekStart=${encodeURIComponent(key)}`,
    });
  },

  goBodyToday() {
    wx.navigateTo({
      url: "/pages/body-report/index",
    });
  },

  goHelp() {
    wx.navigateTo({
      url: "/pages/help/index",
    });
  },

  goAbout() {
    wx.navigateTo({
      url: "/pages/about/index",
    });
  },
});
