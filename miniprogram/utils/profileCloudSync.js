/**
 * 个人资料（昵称 / 签名 / 头像 fileID）云端同步
 */
const STORAGE_KEYS = require("../config/storageKeys");

const DEFAULT_NICKNAME = "用户名";
const DEFAULT_AVATAR_SNIPPET = "transparent background/avatar.png";

let _pushTimer = null;

function parseCloudResult(res) {
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

async function ensureCloudCallable() {
  try {
    const cloudDataSync = require("./cloudDataSync");
    if (cloudDataSync && typeof cloudDataSync.ensureCloudCallable === "function") {
      return cloudDataSync.ensureCloudCallable();
    }
  } catch (e) {
    /* ignore */
  }
  return !!(wx.cloud && typeof wx.cloud.callFunction === "function");
}

function isLoggedIn() {
  try {
    if (wx.getStorageSync(STORAGE_KEYS.HAS_LOGGED_IN)) return true;
  } catch (e) {
    /* ignore */
  }
  const app = getApp();
  return !!(app && app.globalData && app.globalData.hasLoggedIn);
}

function isDefaultNickname(nickname) {
  const n = String(nickname || "").trim();
  return !n || n === DEFAULT_NICKNAME;
}

function isDefaultAvatar(avatarUrl) {
  const u = String(avatarUrl || "");
  return !u || u.indexOf(DEFAULT_AVATAR_SNIPPET) >= 0;
}

function isMeaningfulProfile(profile) {
  if (!profile || typeof profile !== "object") return false;
  if (!isDefaultNickname(profile.nickname)) return true;
  if (!isDefaultAvatar(profile.avatarUrl)) return true;
  const sig = String(profile.signature || "").trim();
  return !!(sig && sig !== "我的个性签名" && sig !== "等你来定义我");
}

function readLocalProfile() {
  const app = getApp();
  if (app && typeof app.getUserProfile === "function") {
    return app.getUserProfile();
  }
  try {
    const raw = wx.getStorageSync(STORAGE_KEYS.USER_PROFILE);
    return raw && typeof raw === "object" ? raw : null;
  } catch (e) {
    return null;
  }
}

function getLocalUpdatedMs(profile) {
  const n = Number(profile && profile.updatedAtMs);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function normalizeCloudProfile(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    nickname: raw.nickname != null ? String(raw.nickname) : "",
    signature: raw.signature != null ? String(raw.signature) : "",
    avatarUrl: raw.avatarUrl != null ? String(raw.avatarUrl) : "",
    customized: !!raw.customized,
    updatedAtMs: Number(raw.updatedAtMs) || 0,
  };
}

function buildPatchFromCloud(cloudProfile, localProfile) {
  const local = localProfile || {};
  const cloud = cloudProfile || {};
  const patch = {};
  if (!isDefaultNickname(cloud.nickname)) {
    patch.nickname = cloud.nickname;
  }
  if (!isDefaultAvatar(cloud.avatarUrl)) {
    patch.avatarUrl = cloud.avatarUrl;
  }
  if (cloud.signature != null && String(cloud.signature).trim()) {
    patch.signature = cloud.signature;
  }
  if (!Object.keys(patch).length) return null;
  patch.updatedAtMs = Math.max(getLocalUpdatedMs(local), cloud.updatedAtMs || 0);
  if (cloud.customized) patch.customized = true;
  return patch;
}

async function pullAndMergeUserProfile() {
  if (!isLoggedIn() || !(await ensureCloudCallable())) return false;
  if (!wx.cloud || typeof wx.cloud.callFunction !== "function") return false;
  try {
    const res = await wx.cloud.callFunction({
      name: "quickstartFunctions",
      data: { type: "getUserProfile" },
    });
    const raw = parseCloudResult(res);
    if (!raw || !raw.success) return false;
    const cloudProfile = normalizeCloudProfile(raw.profile);
    const app = getApp();
    if (!app || typeof app.setUserProfile !== "function") return false;
    const local = readLocalProfile();

    if (!cloudProfile || !isMeaningfulProfile(cloudProfile)) {
      if (isMeaningfulProfile(local)) {
        schedulePushUserProfile();
      }
      return false;
    }

    const localMs = getLocalUpdatedMs(local);
    const cloudMs = cloudProfile.updatedAtMs || 0;
    const localDefault = !isMeaningfulProfile(local);

    if (localDefault || cloudMs >= localMs) {
      const patch = buildPatchFromCloud(cloudProfile, local);
      if (patch) {
        app.setUserProfile(patch, {
          markCustomized: !!cloudProfile.customized,
          syncUserInfo: true,
          skipCloudPush: true,
        });
        return true;
      }
    } else if (isMeaningfulProfile(local)) {
      schedulePushUserProfile();
    }
    return false;
  } catch (e) {
    console.warn("[profileCloudSync] pull", e);
    return false;
  }
}

async function pushUserProfileNow() {
  if (!isLoggedIn() || !(await ensureCloudCallable())) return false;
  const local = readLocalProfile();
  if (!isMeaningfulProfile(local)) return false;
  let customized = false;
  try {
    customized = !!wx.getStorageSync(STORAGE_KEYS.PROFILE_CUSTOMIZED);
  } catch (e) {
    /* ignore */
  }
  try {
    const res = await wx.cloud.callFunction({
      name: "quickstartFunctions",
      data: {
        type: "saveUserProfile",
        profile: {
          nickname: local.nickname || "",
          signature: local.signature || "",
          avatarUrl: local.avatarUrl || "",
          customized,
          updatedAtMs: getLocalUpdatedMs(local) || Date.now(),
        },
      },
    });
    const raw = parseCloudResult(res);
    return !!(raw && raw.success);
  } catch (e) {
    console.warn("[profileCloudSync] push", e);
    return false;
  }
}

function schedulePushUserProfile() {
  if (_pushTimer) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => {
    _pushTimer = null;
    pushUserProfileNow().catch(() => {});
  }, 600);
}

module.exports = {
  pullAndMergeUserProfile,
  pushUserProfileNow,
  schedulePushUserProfile,
  isMeaningfulProfile,
};
