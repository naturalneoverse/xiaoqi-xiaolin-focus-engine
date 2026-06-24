const dailyCheckIn = require("./dailyCheckIn");

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

function toast(title) {
  try {
    wx.showToast({ title, icon: "none", duration: 2600 });
  } catch (e) {
    /* ignore */
  }
}

function errMsgOf(err) {
  return String((err && (err.errMsg || err.message)) || err || "");
}

function isUserCancel(err) {
  return /cancel/i.test(errMsgOf(err));
}

function getCloudEnvId() {
  try {
    const app = getApp();
    return (app && app.globalData && app.globalData.env) || "";
  } catch (e) {
    return "";
  }
}

async function ensureCloudReady() {
  try {
    const cloudDataSync = require("./cloudDataSync");
    if (cloudDataSync && typeof cloudDataSync.ensureCloudCallable === "function") {
      if (await cloudDataSync.ensureCloudCallable(12000)) return true;
    }
  } catch (e) {
    /* ignore */
  }
  try {
    const app = getApp();
    if (wx.cloud && app && app.globalData && app.globalData.cloudInitOk === true) {
      return true;
    }
    const env = getCloudEnvId();
    if (wx.cloud && env) {
      wx.cloud.init({ env, traceUser: true });
      if (app && app.globalData) app.globalData.cloudInitOk = true;
      return true;
    }
  } catch (e2) {
    console.warn("[avatarUpload] cloud re-init", e2);
  }
  return false;
}

/** chooseAvatar 临时路径在部分机型上需 saveFile 后才可供 uploadFile 使用 */
function stabilizeTempPath(tempFilePath) {
  const path = String(tempFilePath || "").trim();
  if (!path) return Promise.resolve("");
  return new Promise((resolve) => {
    try {
      wx.getFileSystemManager().saveFile({
        tempFilePath: path,
        success: (res) => resolve((res && res.savedFilePath) || path),
        fail: () => resolve(path),
      });
    } catch (e) {
      resolve(path);
    }
  });
}

function compressImage(filePath, quality, compressedWidth) {
  return new Promise((resolve) => {
    if (typeof wx.compressImage !== "function") {
      resolve(filePath);
      return;
    }
    const opts = {
      src: filePath,
      quality: quality || 70,
      success: (res) => resolve((res && res.tempFilePath) || filePath),
      fail: () => resolve(filePath),
    };
    if (compressedWidth > 0) opts.compressedWidth = compressedWidth;
    wx.compressImage(opts);
  });
}

function readFileBase64(filePath) {
  return new Promise((resolve, reject) => {
    try {
      wx.getFileSystemManager().readFile({
        filePath,
        encoding: "base64",
        success: (res) => resolve((res && res.data) || ""),
        fail: reject,
      });
    } catch (e) {
      reject(e);
    }
  });
}

function parseCloudFnResult(res) {
  let raw = res && res.result;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch (e) {
      /* ignore */
    }
  }
  return raw && typeof raw === "object" ? raw : null;
}

function cloudPathForUpload() {
  return `avatars/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
}

async function uploadViaClient(filePath) {
  const env = getCloudEnvId();
  const opts = {
    cloudPath: cloudPathForUpload(),
    filePath,
  };
  if (env) opts.config = { env };
  return wx.cloud.uploadFile(opts);
}

async function uploadViaCloudFunction(filePath) {
  const base64 = await readFileBase64(filePath);
  if (!base64) throw new Error("read_file_failed");
  const { callFunction } = require("./cloudCall");
  const res = await callFunction(
    {
      name: "quickstartFunctions",
      data: { type: "uploadUserAvatar", base64, ext: "jpg" },
    },
    30000
  );
  const raw = parseCloudFnResult(res);
  if (raw && raw.success && raw.fileID) {
    return { fileID: raw.fileID };
  }
  throw new Error((raw && raw.errMsg) || "cloud_fn_upload_failed");
}

async function resolveUploadFileId(filePath) {
  let path = filePath;
  try {
    const res = await uploadViaClient(path);
    if (res && res.fileID) return res.fileID;
    throw new Error("avatar_upload_no_fileid");
  } catch (e1) {
    console.warn("[avatarUpload] client upload", errMsgOf(e1));
    path = await compressImage(path, 68, 640);
    try {
      const res2 = await uploadViaClient(path);
      if (res2 && res2.fileID) return res2.fileID;
      throw new Error("avatar_upload_no_fileid");
    } catch (e2) {
      console.warn("[avatarUpload] client retry", errMsgOf(e2));
      const res3 = await uploadViaCloudFunction(path);
      if (res3 && res3.fileID) return res3.fileID;
      throw e2;
    }
  }
}

function uploadErrorToast(err) {
  const msg = errMsgOf(err);
  if (/cloud_unavailable|cloud_not_ready|cloud not ready|Environment not found/i.test(msg)) {
    toast("云环境未就绪，请稍后重试");
    return;
  }
  if (/read_file_failed|pick_empty|pick_unavailable/i.test(msg)) {
    toast("未获取到图片，请重试");
    return;
  }
  if (/image too large|too large|413/i.test(msg)) {
    toast("图片过大，请换一张较小的");
    return;
  }
  if (/network|timeout|超时|断开/i.test(msg)) {
    toast("网络异常，请检查后重试");
    return;
  }
  if (/storage|permission|auth|denied|-503001/i.test(msg)) {
    toast("云存储权限异常，请稍后重试");
    return;
  }
  console.warn("[avatarUpload] uploadErrorToast", msg);
  toast("上传失败，请稍后重试");
}

/**
 * 将 chooseAvatar 得到的临时路径上传云存储并写入用户资料。
 */
async function uploadAvatarFromTempPath(tempFilePath) {
  const app = getApp();
  if (!app || typeof app.setUserProfile !== "function") {
    return false;
  }

  const stabilized = await stabilizeTempPath(tempFilePath);
  if (!stabilized) return false;

  const previousAvatar = (app.getUserProfile && app.getUserProfile().avatarUrl) || "";

  wx.showLoading({ title: "上传中", mask: true });
  try {
    if (!wx.cloud || typeof wx.cloud.uploadFile !== "function") {
      throw new Error("cloud_unavailable");
    }
    if (!(await ensureCloudReady())) {
      throw new Error("cloud_not_ready");
    }

    const fileID = await resolveUploadFileId(stabilized);
    if (!fileID) throw new Error("avatar_upload_no_fileid");

    const ok = app.setUserProfile({ avatarUrl: fileID });
    if (!ok) throw new Error("avatar_save_failed");

    try {
      const profileCloudSync = require("./profileCloudSync");
      if (profileCloudSync && typeof profileCloudSync.pushUserProfileNow === "function") {
        await profileCloudSync.pushUserProfileNow();
      }
    } catch (e) {
      console.warn("[avatarUpload] profile push", errMsgOf(e));
    }

    dailyCheckIn.recordDailyCheckIn();
    wx.showToast({ title: "头像已更新", icon: "success" });
    return true;
  } catch (e) {
    console.warn("[avatarUpload] upload", errMsgOf(e), e);
    if (previousAvatar) {
      app.setUserProfile({ avatarUrl: previousAvatar }, { skipCloudPush: true });
    }
    uploadErrorToast(e);
    return false;
  } finally {
    wx.hideLoading();
  }
}

/** 兜底：须在用户点击回调里同步调起 chooseImage，勿先 await */
function pickAndUploadUserAvatar() {
  return new Promise((resolve) => {
    const finish = (tempPath) => {
      if (!tempPath) {
        uploadErrorToast(new Error("pick_empty"));
        resolve(false);
        return;
      }
      uploadAvatarFromTempPath(tempPath).then(resolve);
    };

    const onFail = (err) => {
      if (isUserCancel(err)) {
        resolve(false);
        return;
      }
      console.warn("[avatarUpload] pick", errMsgOf(err));
      if (typeof wx.chooseImage === "function") {
        wx.chooseImage({
          count: 1,
          sizeType: ["compressed"],
          sourceType: ["album", "camera"],
          success: (res) => finish(res.tempFilePaths && res.tempFilePaths[0]),
          fail: (e2) => {
            if (isUserCancel(e2)) resolve(false);
            else {
              uploadErrorToast(e2);
              resolve(false);
            }
          },
        });
        return;
      }
      uploadErrorToast(err);
      resolve(false);
    };

    if (typeof wx.chooseMedia === "function") {
      wx.chooseMedia({
        count: 1,
        mediaType: ["image"],
        sizeType: ["compressed"],
        sourceType: ["album", "camera"],
        success: (res) => {
          const f = res.tempFiles && res.tempFiles[0];
          finish(f && f.tempFilePath);
        },
        fail: onFail,
      });
      return;
    }
    if (typeof wx.chooseImage === "function") {
      wx.chooseImage({
        count: 1,
        sizeType: ["compressed"],
        sourceType: ["album", "camera"],
        success: (res) => finish(res.tempFilePaths && res.tempFilePaths[0]),
        fail: onFail,
      });
      return;
    }
    uploadErrorToast(new Error("pick_unavailable"));
    resolve(false);
  });
}

module.exports = {
  uploadAvatarFromTempPath,
  pickAndUploadUserAvatar,
};
