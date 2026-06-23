const { uploadAvatarFromTempPath } = require("../../utils/avatarUpload");
const { requireLoginOnLoad } = require("../../utils/requireLogin");

Page({
  onLoad() {
    if (!requireLoginOnLoad()) return;
  },

  goBack() {
    this.__safeNavigateBack("pages/my/index");
  },

  onChooseAvatar(e) {
    const tempPath = e && e.detail && e.detail.avatarUrl;
    if (!tempPath) return;
    if (this.data.__submitting_avatarUpload) return;
    this.setData({ __submitting_avatarUpload: true });
    uploadAvatarFromTempPath(tempPath).finally(() => {
      this.setData({ __submitting_avatarUpload: false });
    });
  },

  goNickname() {
    wx.navigateTo({
      url: "/pages/profile-nickname/index",
    });
  },

  goSignature() {
    wx.navigateTo({
      url: "/pages/profile-signature/index",
    });
  },
});
