"use strict";

/** 测试档：单卡/双卡并行时每路方舟 HTTP 超时（云函数 config.json 为 60s） */
const ARK_TIMEOUT_MS = 25000;
/** 3 张及以上串行时的总预算（毫秒） */
const ARK_BATCH_WALL_BUDGET_MS = 55000;
/** 双卡走并行，避免串行 12+12 仍双双超时 */
const ARK_BATCH_PARALLEL_SIZE = 2;
/** 测试档：HTTP 层不重试（单卡由 generateReply allowRetryOnce 负责） */
const ARK_MAX_RETRIES = 0;
/** 动态字数后处理，限制生成长度以加速 */
const ARK_MAX_OUTPUT_TOKENS = 320;
const REPLY_MIN_CHARS = 180;
const REPLY_MAX_CHARS = 280;
const CACHE_COLLECTION = "reflection_ark_cache";

module.exports = {
  ARK_TIMEOUT_MS,
  ARK_BATCH_WALL_BUDGET_MS,
  ARK_BATCH_PARALLEL_SIZE,
  ARK_MAX_RETRIES,
  ARK_MAX_OUTPUT_TOKENS,
  REPLY_MIN_CHARS,
  REPLY_MAX_CHARS,
  CACHE_COLLECTION,
};
