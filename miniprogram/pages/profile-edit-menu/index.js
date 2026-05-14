const { pickAndUploadUserAvatar } = require("../../utils/avatarUpload");
const { requireLoginOnLoad } = require("../../utils/requireLogin");

Page({
  onLoad() {
    if (!requireLoginOnLoad()) return;
  },

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
