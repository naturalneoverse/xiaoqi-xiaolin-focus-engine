"use strict";

/**
 * 静默日志：仅错误码、象限、卡片、哈希前缀；禁止用户原文与密钥。
 * @param {object} meta
 */
function logEvent(meta) {
  const safe = {
    tag: "reflectionArk",
    action: meta.action || "",
    errCode: meta.errCode || "",
    quadrantId: meta.quadrantId != null ? meta.quadrantId : "",
    cardField: meta.cardField || "",
    textHash: meta.textHash ? String(meta.textHash).slice(0, 16) : "",
    fromCache: !!meta.fromCache,
    fallback: !!meta.fallback,
    httpStatus: meta.httpStatus != null ? meta.httpStatus : undefined,
    durationMs: meta.durationMs != null ? meta.durationMs : undefined,
    phase: meta.phase || undefined,
  };
  if (meta.level === "error") {
    console.error(JSON.stringify(safe));
  } else {
    console.log(JSON.stringify(safe));
  }
}

module.exports = { logEvent };
