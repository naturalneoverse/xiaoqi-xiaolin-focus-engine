"use strict";

/**
 * 云函数 callFunction 无内置超时；与 null 合并表示超时，便于走本地/降级文案。
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @returns {Promise<T|null>}
 */
function raceResolve(promise, ms) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      setTimeout(() => resolve(null), ms);
    }),
  ]);
}

/** mascotEngine 冷启动或网络异常时的统一等待上限（毫秒） */
const MASCOT_ENGINE_TIMEOUT_MS = 12000;

module.exports = {
  raceResolve,
  MASCOT_ENGINE_TIMEOUT_MS,
};
