/**
 * WechatSI recordRecoManager：longpress 同步 start，touchend stop。
 */

const { getWechatSI, resetWechatSICache } = require("./wechatSiPlugin");

const MAX_DURATION_MS = 60000;
const MIN_RECORD_MS = 1000;
const SCOPE_RECORD = "scope.record";

const TOAST_NO_PERM = "请授权麦克风权限后重试";
const TOAST_FAIL = "语音识别失败，请重试";
const TOAST_TOO_SHORT = "说话时间太短，请再说一遍";
const TOAST_NETWORK = "网络异常，请检查网络后重试";
const TOAST_NO_RESULT = "未识别到内容，请重试";
const TOAST_PLUGIN_NOT_READY = "语音功能未就绪，请稍后再试";

const PERM_CACHE_MS = 60000;

/** @type {boolean | null} */
let recordPermissionGranted = null;
let recordPermissionDeniedExplicit = false;
let recordPermissionCacheAt = 0;

/** @type {{ field: string, ending: boolean, started: boolean, pendingStop: boolean, silent: boolean, onAutoEnd?: Function, latestResult?: string, recordStartAt?: number } | null} */
let session = null;
let manager = null;
let managerReady = false;

function toast(title) {
  try {
    wx.showToast({ title, icon: "none" });
  } catch (e) {
    /* ignore */
  }
}

function getManager() {
  if (manager) return manager;
  const plugin = getWechatSI();
  if (!plugin) return null;
  manager = plugin.getRecordRecognitionManager();
  return manager;
}

function bindManagerEvents(mgr) {
  mgr.onStart = function onSpeechStart() {
    if (!session) return;
    session.started = true;
    session.recordStartAt = Date.now();
    if (session.pendingStop) {
      session.pendingStop = false;
      invokeStop(session);
    }
  };

  mgr.onRecognize = function onSpeechRecognize(res) {
    if (session && res && res.result) {
      session.latestResult = res.result;
    }
  };

  mgr.onStop = function onSpeechStop(res) {
    if (!session) return;
    handleStopResult(session, (res && res.result) || "", res);
  };

  mgr.onError = function onSpeechError(res) {
    const code = res && res.retcode;
    if (!session) {
      if (code === -30012 || code === -30002) return;
      return;
    }
    if (session.ending) return;
    const sess = session;
    if (code === -30012 || code === -30002) {
      sess.silent = !sess.started || !!sess.pendingStop;
      finishSession(sess, buildResult(sess, false, "", ""));
      return;
    }
    const toastMsg = mapErrorToast(res);
    if (toastMsg === TOAST_NO_PERM) {
      setPermissionCache(false, true);
      finishSession(sess, buildResult(sess, false, "", toastMsg));
      schedulePermissionSettingPrompt();
      return;
    }
    finishSession(sess, buildResult(sess, false, "", toastMsg));
  };
}

function mapErrorToast(res) {
  const code = res && res.retcode;
  if (code === -30001 || isPermissionError(res || {})) return TOAST_NO_PERM;
  if (code === -30003 || code === -30004 || code === -30008 || code === -30010) {
    return TOAST_NETWORK;
  }
  return TOAST_FAIL;
}

function isPermissionError(res) {
  const code = res && (res.retcode != null ? res.retcode : res.errCode);
  if (code === -30001) return true;
  const msg = String((res && (res.msg || res.errMsg)) || "").toLowerCase();
  return msg.indexOf("auth") >= 0 || msg.indexOf("permission") >= 0 || msg.indexOf("授权") >= 0;
}

function buildResult(sess, ok, text, toastMsg) {
  return {
    ok: !!ok,
    text: text || "",
    field: sess ? sess.field : "",
    toastMsg: toastMsg || "",
  };
}

function finishSession(sess, result) {
  if (!sess || sess.ending) return result;
  sess.ending = true;
  session = null;

  if (!sess.silent && result.toastMsg) {
    toast(result.toastMsg);
  } else if (!sess.silent && !result.ok && !result.toastMsg) {
    toast(TOAST_FAIL);
  }

  if (typeof sess.onAutoEnd === "function") {
    try {
      sess.onAutoEnd(result);
    } catch (e) {
      /* ignore */
    }
  }
  return result;
}

function handleStopResult(sess, rawText, stopRes) {
  const r = stopRes || {};
  const duration = Number(r.duration);
  const elapsed =
    Number.isFinite(duration) && duration > 0
      ? duration
      : sess.recordStartAt
        ? Date.now() - sess.recordStartAt
        : 0;

  if (elapsed > 0 && elapsed < MIN_RECORD_MS) {
    return finishSession(sess, buildResult(sess, false, "", TOAST_TOO_SHORT));
  }

  const text = String(rawText || sess.latestResult || "").trim();
  if (!text) {
    return finishSession(sess, buildResult(sess, false, "", TOAST_NO_RESULT));
  }
  return finishSession(sess, buildResult(sess, true, text, ""));
}

function prepare() {
  if (managerReady && manager) return true;
  const mgr = getManager();
  if (!mgr) return false;
  bindManagerEvents(mgr);
  managerReady = true;
  return true;
}

function ensureManagerReady() {
  if (prepare()) return true;
  resetWechatSICache();
  manager = null;
  managerReady = false;
  return prepare();
}

/** 预初始化语音识别插件（不申请麦克风权限；权限在用户长按话筒时由 start 触发） */
function warmUp() {
  return Promise.resolve(ensureManagerReady());
}

function setPermissionCache(granted, explicitlyDenied) {
  recordPermissionGranted = !!granted;
  recordPermissionDeniedExplicit = explicitlyDenied === true && !granted;
  recordPermissionCacheAt = Date.now();
}

function isPermissionCacheFresh() {
  return recordPermissionCacheAt > 0 && Date.now() - recordPermissionCacheAt < PERM_CACHE_MS;
}

function schedulePermissionSettingPrompt() {
  setTimeout(() => {
    try {
      wx.hideToast();
    } catch (e) {
      /* ignore */
    }
    promptRecordPermissionSetting();
  }, 1500);
}

function notifyPermissionDenied() {
  setPermissionCache(false, true);
  toast(TOAST_NO_PERM);
  schedulePermissionSettingPrompt();
}

function promptRecordPermissionSetting() {
  try {
    wx.showModal({
      title: "需要麦克风权限",
      content: "请在设置中开启「麦克风」，以便使用语音输入",
      confirmText: "去设置",
      cancelText: "取消",
      success(res) {
        if (!res.confirm || typeof wx.openSetting !== "function") return;
        wx.openSetting({
          success(settingRes) {
            const auth = (settingRes && settingRes.authSetting) || {};
            const granted = auth[SCOPE_RECORD] === true;
            const denied = auth[SCOPE_RECORD] === false;
            setPermissionCache(granted, denied);
          },
        });
      },
    });
  } catch (e) {
    /* ignore */
  }
}

function denyStartForPermission() {
  notifyPermissionDenied();
  return false;
}

function ensureRecordPermission() {
  return new Promise((resolve) => {
    try {
      if (typeof wx.getSetting !== "function") {
        setPermissionCache(true, false);
        resolve(true);
        return;
      }
      wx.getSetting({
        success: (res) => {
          const auth = (res && res.authSetting) || {};
          if (auth[SCOPE_RECORD] === true) {
            setPermissionCache(true, false);
            resolve(true);
            return;
          }
          if (auth[SCOPE_RECORD] === false) {
            setPermissionCache(false, true);
            resolve(false);
            return;
          }
          if (typeof wx.authorize !== "function") {
            setPermissionCache(true, false);
            resolve(true);
            return;
          }
          wx.authorize({
            scope: SCOPE_RECORD,
            success: () => {
              setPermissionCache(true, false);
              resolve(true);
            },
            fail: () => {
              setPermissionCache(false, true);
              resolve(false);
            },
          });
        },
        fail: () => {
          setPermissionCache(true, false);
          resolve(true);
        },
      });
    } catch (e) {
      setPermissionCache(true, false);
      resolve(true);
    }
  });
}

function requestStop(sess) {
  if (!sess || sess.ending) return false;
  if (!sess.started) {
    sess.pendingStop = true;
    return true;
  }
  invokeStop(sess);
  return true;
}

function invokeStop(sess) {
  if (!manager || !sess || sess.ending) return;
  try {
    manager.stop();
  } catch (e) {
    finishSession(sess, buildResult(sess, false, "", TOAST_FAIL));
  }
}

function hapticOnRecordStart() {
  try {
    if (typeof wx.vibrateShort === "function") {
      wx.vibrateShort({ type: "medium" });
    }
  } catch (e) {
    /* ignore */
  }
}

function beginSession(field, onAutoEnd) {
  const mgr = manager;
  if (!mgr) return false;

  const f = field === "content" ? "content" : "name";
  session = {
    field: f,
    ending: false,
    started: false,
    pendingStop: false,
    silent: false,
    onAutoEnd: typeof onAutoEnd === "function" ? onAutoEnd : null,
    latestResult: "",
    recordStartAt: 0,
  };

  try {
    mgr.start({ duration: MAX_DURATION_MS, lang: "zh_CN" });
    hapticOnRecordStart();
    return true;
  } catch (e) {
    session = null;
    return false;
  }
}

function startRecording(field, onAutoEnd) {
  if (!ensureManagerReady()) {
    toast(TOAST_PLUGIN_NOT_READY);
    return false;
  }
  if (beginSession(field, onAutoEnd)) return true;

  resetWechatSICache();
  manager = null;
  managerReady = false;
  if (!ensureManagerReady() || !beginSession(field, onAutoEnd)) {
    toast(TOAST_PLUGIN_NOT_READY);
    return false;
  }
  return true;
}

async function start(field, onAutoEnd) {
  if (session && !session.ending) {
    abort();
  }

  if (isPermissionCacheFresh() && recordPermissionGranted === true) {
    return startRecording(field, onAutoEnd);
  }
  if (isPermissionCacheFresh() && recordPermissionGranted === false) {
    return denyStartForPermission();
  }

  const permitted = await ensureRecordPermission();
  if (!permitted) {
    return denyStartForPermission();
  }
  return startRecording(field, onAutoEnd);
}

function stopForField(field) {
  if (!session || session.ending) return false;
  const f = field === "content" ? "content" : "name";
  if (session.field !== f) return false;
  return requestStop(session);
}

function stopActive() {
  if (!session || session.ending) return false;
  return requestStop(session);
}

function hasActiveSession() {
  return !!(session && !session.ending);
}

function abort() {
  if (!session) return;
  const sess = session;
  sess.silent = true;
  sess.ending = true;
  session = null;
  try {
    if (manager) manager.stop();
  } catch (e) {
    /* ignore */
  }
}

module.exports = {
  prepare,
  warmUp,
  start,
  stopForField,
  stopActive,
  hasActiveSession,
  abort,
  TOAST_NO_PERM,
  TOAST_FAIL,
  TOAST_TOO_SHORT,
  TOAST_NETWORK,
  TOAST_NO_RESULT,
  TOAST_PLUGIN_NOT_READY,
  TOAST_CONTENT_FULL: "已达 600 字上限，无法继续添加",
  TOAST_NAME_FULL: "已达 25 字上限，无法继续添加",
};
