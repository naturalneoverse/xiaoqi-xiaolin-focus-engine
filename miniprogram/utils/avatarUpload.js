const dailyCheckIn = require("./dailyCheckIn");

/**
 * 调起系统选图（相册/拍照）并上传云存储，成功后写入 App 用户资料。
 * @returns {Promise<boolean>} 是否成功更换头像（用户取消选图为 false）
 */
function pickAndUploadUserAvatar() {
  const app = getApp();
  if (!app || typeof app.getUserProfile !== "function" || typeof app.setUserProfile !== "function") {
    return Promise.resolve(false);
  }
  const previousAvatar = (app.getUserProfile() && app.getUserProfile().avatarUrl) || "";

  return new Promise((resolve) => {
    if (!wx.chooseImage) {
      resolve(false);
      return;
    }
    wx.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
      success: (res) => {
        const tempFilePath = res.tempFilePaths && res.tempFilePaths[0];
        if (!tempFilePath) {
          resolve(false);
          return;
        }
        wx.showLoading({ title: "上传中", mask: true });
        (async () => {
          try {
            if (!wx.cloud || typeof wx.cloud.uploadFile !== "function") {
              throw new Error("cloud_unavailable");
            }
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
            resolve(true);
          } catch (e) {
            app.setUserProfile({ avatarUrl: previousAvatar });
            wx.showToast({ title: "上传失败", icon: "none" });
            resolve(false);
          } finally {
            wx.hideLoading();
          }
        })();
      },
      fail: () => {
        resolve(false);
      },
    });
  });
}

module.exports = {
  pickAndUploadUserAvatar,
};
