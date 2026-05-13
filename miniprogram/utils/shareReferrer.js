const STORAGE_KEYS = require("../config/storageKeys");

/** 与微信 sun code / query 中 openid 形态一致；常见 28 位以内 */
const MAX_SCENE_LEN = 32;

const REF_SOURCE_POSTER = "poster_qr";
const REF_SOURCE_FRIEND = "friend_share";

function safeDecodeScene(raw) {
  if (raw == null || raw === "") return "";
  const s = String(raw).trim();
  try {
    return decodeURIComponent(s);
  } catch (e) {
    return s;
  }
}

function isLikelyWechatOpenid(s) {
  return typeof s === "string" && s.length >= 10 && s.length <= MAX_SCENE_LEN && /^[a-zA-Z0-9_-]+$/.test(s);
}

function setPendingSource(source) {
  try {
    wx.setStorageSync(STORAGE_KEYS.PENDING_REFERRER_SOURCE, source);
  } catch (e) {
    /* ignore */
  }
}

/** 将 scene 解析为分享者 openid 并写入本地，供登录成功后上报 */
function persistReferrerFromScene(sceneRaw) {
  const scene = safeDecodeScene(sceneRaw);
  if (!isLikelyWechatOpenid(scene)) return false;
  try {
    wx.setStorageSync(STORAGE_KEYS.PENDING_REFERRER_OPENID, scene);
    wx.setStorageSync(STORAGE_KEYS.PENDING_REFERRER_TS, Date.now());
    setPendingSource(REF_SOURCE_POSTER);
    return true;
  } catch (e) {
    return false;
  }
}

/** 转发卡片 URL 参数 shareUid（分享者 openid） */
function persistReferrerFromShareUid(shareUidRaw) {
  const uid = safeDecodeScene(shareUidRaw);
  if (!isLikelyWechatOpenid(uid)) return false;
  try {
    wx.setStorageSync(STORAGE_KEYS.PENDING_REFERRER_OPENID, uid);
    wx.setStorageSync(STORAGE_KEYS.PENDING_REFERRER_TS, Date.now());
    setPendingSource(REF_SOURCE_FRIEND);
    return true;
  } catch (e) {
    return false;
  }
}

function getPendingReferrerOpenid() {
  try {
    const v = wx.getStorageSync(STORAGE_KEYS.PENDING_REFERRER_OPENID);
    return typeof v === "string" && v ? v : "";
  } catch (e) {
    return "";
  }
}

function getPendingReferrerSource() {
  try {
    const v = wx.getStorageSync(STORAGE_KEYS.PENDING_REFERRER_SOURCE);
    if (v === REF_SOURCE_FRIEND) return REF_SOURCE_FRIEND;
    return REF_SOURCE_POSTER;
  } catch (e) {
    return REF_SOURCE_POSTER;
  }
}

function clearPendingReferrer() {
  try {
    wx.removeStorageSync(STORAGE_KEYS.PENDING_REFERRER_OPENID);
    wx.removeStorageSync(STORAGE_KEYS.PENDING_REFERRER_TS);
    wx.removeStorageSync(STORAGE_KEYS.PENDING_REFERRER_SOURCE);
  } catch (e) {
    /* ignore */
  }
}

function getSharerOpenidSync() {
  try {
    const app = getApp();
    if (app && app.globalData && app.globalData.userOpenId) {
      const g = String(app.globalData.userOpenId);
      if (isLikelyWechatOpenid(g)) return g;
    }
  } catch (e) {
    /* ignore */
  }
  try {
    const v = wx.getStorageSync(STORAGE_KEYS.USER_OPENID);
    return typeof v === "string" && isLikelyWechatOpenid(v) ? v : "";
  } catch (e) {
    return "";
  }
}

function buildLoginPathWithShareUid(uid) {
  const u = String(uid || "").trim();
  if (!isLikelyWechatOpenid(u)) return "/pages/login/index";
  return `/pages/login/index?shareUid=${encodeURIComponent(u)}`;
}

/**
 * 解析「转朋友」卡片 path：优先本地 openid，否则云 getOpenId（不弹窗、失败则仅登录页无参数）。
 * @returns {Promise<string>}
 */
function resolveLoginEntrancePath() {
  const syncUid = getSharerOpenidSync();
  if (syncUid) {
    return Promise.resolve(buildLoginPathWithShareUid(syncUid));
  }
  if (!wx.cloud || typeof wx.cloud.callFunction !== "function") {
    return Promise.resolve("/pages/login/index");
  }
  return wx.cloud
    .callFunction({
      name: "quickstartFunctions",
      data: { type: "getOpenId" },
    })
    .then((res) => {
      const r = (res && res.result) || {};
      const oid = r.openid ? String(r.openid) : "";
      if (isLikelyWechatOpenid(oid)) {
        try {
          wx.setStorageSync(STORAGE_KEYS.USER_OPENID, oid);
          const app = getApp();
          if (app && app.globalData) {
            app.globalData.userOpenId = oid;
          }
        } catch (e) {
          /* ignore */
        }
        return buildLoginPathWithShareUid(oid);
      }
      return "/pages/login/index";
    })
    .catch(() => "/pages/login/index");
}

/** 朋友圈分享 query（仅同步，无 openid 则空串） */
function buildTimelineShareQuerySync() {
  const uid = getSharerOpenidSync();
  if (!isLikelyWechatOpenid(uid)) return "";
  return `shareUid=${encodeURIComponent(uid)}`;
}

/**
 * 未登录且 URL 带 scene/shareUid：写入待上报后 reLaunch 登录（仅路由跳转，无遮罩）。
 * @param {Record<string, string>} options 页面 onLoad 入参
 * @returns {boolean} true 表示已 reLaunch，须中止当前页 onLoad
 */
function gateUnauthenticatedShareEntry(options) {
  if (!options || typeof options !== "object") return false;
  const rawScene = options.scene != null && options.scene !== "" ? String(options.scene) : "";
  const rawShareUid = options.shareUid != null && options.shareUid !== "" ? String(options.shareUid) : "";
  if (!rawScene && !rawShareUid) return false;

  let loggedIn = false;
  try {
    const app = getApp();
    if (app && app.globalData && typeof app.globalData.hasLoggedIn === "boolean") {
      loggedIn = app.globalData.hasLoggedIn;
    }
  } catch (e) {
    /* ignore */
  }
  if (!loggedIn) {
    try {
      loggedIn = !!wx.getStorageSync(STORAGE_KEYS.HAS_LOGGED_IN);
    } catch (e2) {
      loggedIn = false;
    }
  }
  if (loggedIn) return false;

  try {
    if (rawScene) persistReferrerFromScene(rawScene);
    if (rawShareUid) persistReferrerFromShareUid(rawShareUid);
  } catch (e3) {
    /* ignore */
  }
  wx.reLaunch({ url: "/pages/login/index" });
  return true;
}

/**
 * 冷启动：带 scene/shareUid 且未登录时写入溯源；非登录页则 reLaunch 登录（不遮屏）。
 * @param {boolean} hasLoggedIn 启动时本地是否已登录
 */
function handleColdLaunchForQr(hasLoggedIn) {
  if (hasLoggedIn) return;
  let lo = {};
  try {
    lo = wx.getLaunchOptionsSync ? wx.getLaunchOptionsSync() : {};
  } catch (e) {
    return;
  }
  const path = String(lo.path || "").replace(/^\//, "");
  const query = lo.query || {};
  const rawScene = query.scene != null && query.scene !== "" ? query.scene : "";
  const rawShareUid = query.shareUid != null && query.shareUid !== "" ? query.shareUid : "";
  if (!rawScene && !rawShareUid) return;

  if (rawScene) persistReferrerFromScene(rawScene);
  if (rawShareUid) persistReferrerFromShareUid(rawShareUid);

  if (path === "pages/login/index") {
    return;
  }
  wx.reLaunch({ url: "/pages/login/index" });
}

module.exports = {
  persistReferrerFromScene,
  persistReferrerFromShareUid,
  getPendingReferrerOpenid,
  getPendingReferrerSource,
  clearPendingReferrer,
  safeDecodeScene,
  handleColdLaunchForQr,
  gateUnauthenticatedShareEntry,
  resolveLoginEntrancePath,
  buildTimelineShareQuerySync,
  REF_SOURCE_POSTER,
  REF_SOURCE_FRIEND,
};
