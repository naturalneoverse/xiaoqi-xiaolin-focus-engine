const { uploadAvatarFromTempPath } = require("../../utils/avatarUpload");
const { requireLoginOnLoad, promptLoginIfNeeded } = require("../../utils/requireLogin");
const authSession = require("../../utils/authSession");

Page({
  onLoad() {
    if (!requireLoginOnLoad()) return;
  },

  goBack() {
    this.__safeNavigateBack("pages/my/index");
  },

  onChooseAvatar(e) {
    if (!authSession.isLoggedIn()) {
      promptLoginIfNeeded({ content: "登录后可设置头像并同步到云端。" });
      return;
    }
    const tempPath = e && e.detail && e.detail.avatarUrl;
    if (!tempPath) return;
    this.__withSubmitting("avatarUpload", () =>
      uploadAvatarFromTempPath(tempPath).then((ok) => {
        if (ok) {
          setTimeout(() => this.goBack(), 400);
        }
        return ok;
      }),
    );
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
