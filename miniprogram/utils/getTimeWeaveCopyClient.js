/**
 * 时间编织报告：开场（本地）+ 正文（云集合 timeWeaveCopy）
 */

const { callFunction, isCloudReady } = require("./cloudCall");
const {
  TIME_WEAVE_COPY,
  FALLBACK_NEUTRAL,
} = require("../config/timeWeaveMascotCopy");
const { pickOpeningLine } = require("../config/timeWeaveOpening");

const ERR_OFFLINE = "云服务不可用，请稍后重试";
const TIMEOUT_MS = 10000;

const VALID_KEYS = new Set(Object.keys(TIME_WEAVE_COPY));

/** 云库或旧数据若含「你」，展示前统一为「您」 */
function normalizeHonorific(text) {
  return String(text == null ? "" : text).replace(/你/g, "您");
}

function ensureSentenceEnd(text) {
  const s = String(text || "").trim();
  if (!s) return s;
  if (/[。．！？!?…]$/.test(s)) return s;
  return `${s}。`;
}

function localLine(copyKey, lineIndex) {
  const lines = TIME_WEAVE_COPY[copyKey];
  if (!lines || !lines.length) return "";
  const idx = Math.max(1, Math.min(6, Number(lineIndex) || 1)) - 1;
  return ensureSentenceEnd(normalizeHonorific(lines[idx] || ""));
}

/**
 * 气泡三段：1 随机开场 2 空一行 3 云端正文（keepManualBreak 保留换行）
 */
function composeXiaolinBubbleText(bodyText) {
  const opening = pickOpeningLine();
  const body = ensureSentenceEnd(normalizeHonorific(bodyText || ""));
  if (!body) return opening;
  return `${opening}\n${body}`;
}

/**
 * @param {{ copyKey: string, lineIndex: number, weekKey?: string }} params
 */
function fetchTimeWeaveCopy(params) {
  const copyKey = String((params && params.copyKey) || "").trim();
  const lineIndex = Math.max(1, Math.min(6, Number(params && params.lineIndex) || 1));
  const weekKey = String((params && params.weekKey) || "").trim();

  if (!VALID_KEYS.has(copyKey)) {
    const fallbackBody = localLine("calmEasy", 1) || FALLBACK_NEUTRAL;
    return Promise.resolve({
      success: true,
      text: composeXiaolinBubbleText(fallbackBody),
      bodyText: fallbackBody,
      degraded: true,
      errMsg: "文案类型无效",
    });
  }

  const offlineBody = localLine(copyKey, lineIndex) || FALLBACK_NEUTRAL;
  const offlineFull = composeXiaolinBubbleText(offlineBody);

  return new Promise((resolve) => {
    if (!isCloudReady()) {
      resolve({
        success: true,
        text: offlineFull,
        bodyText: offlineBody,
        degraded: true,
        errMsg: ERR_OFFLINE,
      });
      return;
    }
    callFunction(
      {
        name: "getTimeWeaveCopy",
        data: { copyKey, lineIndex },
      },
      TIMEOUT_MS,
    )
      .then((res) => {
        const body = (res && res.result) || {};
        const raw = String(body.text || "").trim();
        if (body.success && raw) {
          const normalized = ensureSentenceEnd(normalizeHonorific(raw));
          resolve({
            success: true,
            text: composeXiaolinBubbleText(normalized),
            bodyText: normalized,
            degraded: false,
            errMsg: "",
          });
          return;
        }
        resolve({
          success: true,
          text: offlineFull,
          bodyText: offlineBody,
          degraded: true,
          errMsg: body.errMsg || ERR_OFFLINE,
        });
      })
      .catch((err) => {
        console.warn("[getTimeWeaveCopyClient]", err);
        resolve({
          success: true,
          text: offlineFull,
          bodyText: offlineBody,
          degraded: true,
          errMsg: ERR_OFFLINE,
        });
      });
  });
}

module.exports = {
  fetchTimeWeaveCopy,
  composeXiaolinBubbleText,
  localLine,
  normalizeHonorific,
  ensureSentenceEnd,
  FALLBACK_NEUTRAL,
  ERR_OFFLINE,
};
