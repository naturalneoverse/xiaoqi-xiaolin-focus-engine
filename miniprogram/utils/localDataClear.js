/**
 * 设置页「清除缓存」：按 localDataDomains 注册表执行清除并生成确认文案（F3-2）。
 */
const STORAGE_KEYS = require("../config/storageKeys");
const {
  CLEAR_PRESET_IDS,
  getClearPresetIncludedLabels,
  getClearPresetExcludedLabels,
  getDomainsByClearPreset,
} = require("../config/localDataDomains");

function removeKeys(keys) {
  (keys || []).forEach((key) => {
    try {
      wx.removeStorageSync(key);
    } catch (e) {
      console.warn("[localDataClear] removeStorageSync", key, e);
    }
  });
}

function removeKeyPrefixKeys(prefixes) {
  const list = Array.isArray(prefixes) ? prefixes : [];
  if (!list.length) return;
  try {
    const storageInfo = wx.getStorageInfoSync ? wx.getStorageInfoSync() : null;
    const allKeys = (storageInfo && storageInfo.keys) || [];
    allKeys.forEach((key) => {
      if (list.some((prefix) => String(key).indexOf(prefix) === 0)) {
        try {
          wx.removeStorageSync(key);
        } catch (e) {
          console.warn("[localDataClear] remove prefix key", key, e);
        }
      }
    });
  } catch (e) {
    console.warn("[localDataClear] removeKeyPrefixKeys", e);
  }
}

function collectPresetStorageKeys(presetId) {
  const keys = [];
  getDomainsByClearPreset(presetId).forEach((domain) => {
    (domain.storageKeys || []).forEach((key) => {
      if (key && keys.indexOf(key) === -1) keys.push(key);
    });
  });
  return keys;
}

function collectPresetKeyPrefixes(presetId) {
  const prefixes = [];
  getDomainsByClearPreset(presetId).forEach((domain) => {
    (domain.keyPrefixes || []).forEach((prefix) => {
      if (prefix && prefixes.indexOf(prefix) === -1) prefixes.push(prefix);
    });
  });
  return prefixes;
}

function clearReflectionArkMemoryCache() {
  try {
    const reflectionArkCache = require("./reflectionArkCache");
    if (reflectionArkCache && typeof reflectionArkCache.clearAllMemoryCache === "function") {
      reflectionArkCache.clearAllMemoryCache();
    }
  } catch (e) {
    console.warn("[localDataClear] clearReflectionArkMemoryCache", e);
  }
}

/**
 * @param {string} presetId
 * @returns {{ ok: boolean, errMsg?: string }}
 */
function executeClearPreset(presetId) {
  const id = String(presetId || "").trim();
  try {
    if (id === CLEAR_PRESET_IDS.APP_CACHE) {
      removeKeys(collectPresetStorageKeys(id));
      removeKeyPrefixKeys(collectPresetKeyPrefixes(id));
      clearReflectionArkMemoryCache();
      return { ok: true };
    }
    return { ok: false, errMsg: "unknown_preset" };
  } catch (e) {
    console.error("[localDataClear] executeClearPreset", id, e);
    return { ok: false, errMsg: "clear_failed" };
  }
}

/**
 * @param {string} presetId
 * @returns {string}
 */
function buildClearConfirmContent(presetId) {
  const id = String(presetId || "").trim();
  if (id === CLEAR_PRESET_IDS.APP_CACHE) {
    const included = getClearPresetIncludedLabels(id);
    const excluded = getClearPresetExcludedLabels(id);
    const inc = included.length ? included.join("、") : "临时缓存";
    const exc = excluded.length ? excluded.join("、") : "您的业务记录";
    return (
      `将清除：${inc}。\n` +
      `不会清除：${exc}。\n` +
      "清除后不影响登录状态，部分页面下次打开可能重新加载。是否继续？"
    );
  }
  return "确定清除缓存吗？";
}

module.exports = {
  executeClearPreset,
  buildClearConfirmContent,
  CLEAR_PRESET_IDS,
};
