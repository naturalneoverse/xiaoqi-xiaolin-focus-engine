const { pickAndUploadUserAvatar } = require("../../utils/avatarUpload");

Page({
  goBack() {
    this.__safeNavigateBack("pages/my/index");
  },

  goAvatar() {
    return this.__withSubmitting("avatarUpload", () => pickAndUploadUserAvatar());
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
