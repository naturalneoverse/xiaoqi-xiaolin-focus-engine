Page({
  data: {
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
    this.syncUserProfile();
    if (typeof this.getTabBar === "function" && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
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
          wx.showToast({ title: "头像已更新", icon: "success" });
        } catch (e) {
          app.setUserProfile({ avatarUrl: previousAvatar });
          wx.showToast({ title: "上传失败", icon: "none" });
        } finally {
          wx.hideLoading();
        }
      },
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
    wx.navigateTo({
      url: "/pages/poster/index",
    });
  },

  goTimeReport() {
    wx.navigateTo({
      url: "/pages/weekly-report/index?source=latest&status=状态平稳",
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
