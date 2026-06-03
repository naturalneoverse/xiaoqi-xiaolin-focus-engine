/**
 * 设置页「清除数据」：按 localDataDomains 注册表执行清除并生成确认文案（F3-2）。
 */
const STORAGE_KEYS = require("../config/storageKeys");
const {
  CLEAR_PRESET_IDS,
  getClearPresetIncludedLabels,
  getClearPresetExcludedLabels,
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

function removeImageCachePrefixKeys() {
  try {
    const storageInfo = wx.getStorageInfoSync ? wx.getStorageInfoSync() : null;
    const allKeys = (storageInfo && storageInfo.keys) || [];
    allKeys.forEach((key) => {
      if (/^(temp_image_|image_temp_|draft_image_)/.test(key)) {
        try {
          wx.removeStorageSync(key);
        } catch (e) {
          console.warn("[localDataClear] remove prefix key", key, e);
        }
      }
    });
  } catch (e) {
    console.warn("[localDataClear] removeImageCachePrefixKeys", e);
  }
}

/**
 * @param {string} presetId
 * @returns {{ ok: boolean, errMsg?: string }}
 */
function executeClearPreset(presetId) {
  const id = String(presetId || "").trim();
  try {
    if (id === CLEAR_PRESET_IDS.IMAGE_CACHE) {
      removeKeys([STORAGE_KEYS.CACHE_IMAGES]);
      removeImageCachePrefixKeys();
      return { ok: true };
    }
    if (id === CLEAR_PRESET_IDS.TASKS_REFLECTION) {
      removeKeys([STORAGE_KEYS.TASKS_DATA, STORAGE_KEYS.REFLECTION_RECORDS]);
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
  if (id === CLEAR_PRESET_IDS.IMAGE_CACHE) {
    return "将清除本机图片缓存（含临时图片），不影响任务、哲思、身体等业务记录。是否继续？";
  }
  if (id === CLEAR_PRESET_IDS.TASKS_REFLECTION) {
    const included = getClearPresetIncludedLabels(id);
    const excluded = getClearPresetExcludedLabels(id);
    const inc = included.length ? included.join("、") : "（无）";
    const exc = excluded.length ? excluded.join("、") : "（无）";
    return (
      `将清除：${inc}。\n` +
      `不会清除：${exc}。\n` +
      "部分数据可在对应页面单独删除。删除后不可恢复，是否继续？"
    );
  }
  return "确定清除吗？";
}

/**
 * @param {string} presetId
 * @returns {string}
 */
function buildClearFinalConfirmContent(presetId) {
  const id = String(presetId || "").trim();
  if (id === CLEAR_PRESET_IDS.TASKS_REFLECTION) {
    const included = getClearPresetIncludedLabels(id).join("、");
    return `此操作不可逆，${included || "所选数据"}将从本机删除，确定继续吗？`;
  }
  return "此操作不可逆，确定继续吗？";
}

module.exports = {
  executeClearPreset,
  buildClearConfirmContent,
  buildClearFinalConfirmContent,
  CLEAR_PRESET_IDS,
};
