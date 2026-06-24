/**
 * 头像展示：存储用 cloud fileID / 本地路径，展示用 HTTPS 临时链。
 */

const DEFAULT_AVATAR = "/images/transparent background/avatar.png";

function isCloudFileId(url) {
  return /^cloud:\/\//i.test(String(url || "").trim());
}

function isDefaultAvatarPath(url) {
  const u = String(url || "").trim();
  return !u || u.indexOf("transparent background/avatar.png") >= 0;
}

function resolveAvatarDisplayUrl(avatarUrl) {
  const raw = String(avatarUrl || "").trim();
  if (isDefaultAvatarPath(raw)) {
    return Promise.resolve(DEFAULT_AVATAR);
  }
  if (!isCloudFileId(raw)) {
    return Promise.resolve(raw);
  }
  if (!wx.cloud || typeof wx.cloud.getTempFileURL !== "function") {
    return Promise.resolve(raw);
  }
  return new Promise((resolve) => {
    wx.cloud.getTempFileURL({
      fileList: [raw],
      success: (res) => {
        const item = res.fileList && res.fileList[0];
        if (item && item.status === 0 && item.tempFileURL) {
          resolve(item.tempFileURL);
          return;
        }
        resolve(raw);
      },
      fail: () => resolve(raw),
    });
  });
}

/** 页面 setData：profile + 可展示的 avatarSrc */
function applyProfileToPage(page, profile) {
  if (!page || typeof page.setData !== "function" || !profile) {
    return Promise.resolve();
  }
  return resolveAvatarDisplayUrl(profile.avatarUrl).then((avatarSrc) => {
    page.setData({
      userProfile: { ...profile },
      avatarSrc,
    });
  });
}

module.exports = {
  DEFAULT_AVATAR,
  isCloudFileId,
  isDefaultAvatarPath,
  resolveAvatarDisplayUrl,
  applyProfileToPage,
};
