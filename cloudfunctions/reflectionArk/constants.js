"use strict";

/** 单卡方舟 HTTP 超时上限（控制台/ config 通常最高 60s） */
const ARK_TIMEOUT_MS = 25000;
/** 批量串行总预算（毫秒），略小于云函数 60s */
const ARK_BATCH_WALL_BUDGET_MS = 55000;
/** 部署标识：日志里可核对是否为新包 */
const DEPLOY_TAG = "body-week-care-r1";

/** 观实归真（象限一）；补丁 R1 起 c2 末字句末符 */
const QUADRANT_Q1_ID = 1;
/** 观心明己（象限二） */
const QUADRANT_Q2_ID = 2;
/** 自我主宰（象限三） */
const QUADRANT_Q3_ID = 3;
/** 踏实前行（象限四） */
const QUADRANT_Q4_ID = 4;
/** 观实归真：仅该 cardField 启用 strictTerminal（R1） */
const Q1_STRICT_TERMINAL_CARD = "c2";
/** @deprecated 固定长档已废弃，见 Q2 分级常量 */
const ARK_Q2_PROMPT_MIN = 280;
/** @deprecated 固定长档已废弃，见 Q2 分级常量 */
const ARK_Q2_PROMPT_MAX = 380;
/** 观心明己：后处理软上限默认值（各档 bounds.softMax 优先） */
const ARK_Q2_SOFT_MAX = 420;

/** Q2 回响字数：按用户本题手写字数分级（防幻觉·短写短回） */
const Q2_USER_TEXT_TIER1 = 30;
const Q2_USER_TEXT_TIER2 = 80;
const Q2_TIER1_MIN = 80;
const Q2_TIER1_MAX = 150;
const Q2_TIER1_SOFT_MAX = 180;
const Q2_TIER2_MIN = 150;
const Q2_TIER2_MAX = 220;
const Q2_TIER2_SOFT_MAX = 260;
const Q2_TIER3_MIN = 220;
const Q2_TIER3_MAX = 320;
const Q2_TIER3_SOFT_MAX = 380;

/** Q3 单选 c1 固定短档 */
const Q3_CHOICE_MIN = 60;
const Q3_CHOICE_MAX = 130;
const Q3_CHOICE_SOFT_MAX = 150;
/** Q3 手写题分级（与 Q2 同阈值） */
const Q3_USER_TEXT_TIER1 = 30;
const Q3_USER_TEXT_TIER2 = 80;
const Q3_TIER1_MIN = 80;
const Q3_TIER1_MAX = 150;
const Q3_TIER1_SOFT_MAX = 180;
const Q3_TIER2_MIN = 150;
const Q3_TIER2_MAX = 220;
const Q3_TIER2_SOFT_MAX = 260;
const Q3_TIER3_MIN = 220;
const Q3_TIER3_MAX = 300;
const Q3_TIER3_SOFT_MAX = 360;

/** 测试档：HTTP 层不重试（单卡由 generateReply：allowRetryOnce 或观心明己 Q2 负责） */
const ARK_MAX_RETRIES = 0;
/** 单轮输出 token 上限（适配长档 max 380 汉字） */
const ARK_MAX_OUTPUT_TOKENS = 500;
/** 观心明己 / 自我主宰 S2 阶段 A */
const ARK_MAX_OUTPUT_TOKENS_Q2_STAGE_A = 960;
/** 观心明己 / 自我主宰 S2 阶段 B（c1+c2 合并） */
const ARK_MAX_OUTPUT_TOKENS_Q2_STAGE_B = 1200;

/** Q2/Q3 S2 阶段 HTTP 目标上限（毫秒） */
const Q2_STAGE_A_TIMEOUT_MS = 52000;
const Q2_STAGE_B_TIMEOUT_MAX_MS = 52000;
const Q3_STAGE_A_TIMEOUT_MS = Q2_STAGE_A_TIMEOUT_MS;
const Q3_STAGE_B_TIMEOUT_MAX_MS = Q2_STAGE_B_TIMEOUT_MAX_MS;
const ARK_MAX_OUTPUT_TOKENS_Q3_STAGE_A = ARK_MAX_OUTPUT_TOKENS_Q2_STAGE_A;
const ARK_MAX_OUTPUT_TOKENS_Q3_STAGE_B = ARK_MAX_OUTPUT_TOKENS_Q2_STAGE_B;
/** Q2 batch 墙钟预留（解析/写 cache，毫秒） */
const Q2_WALL_RESERVE_MS = 3000;

/** 用户手写 ≤ 此字数 → 短档 prompt；> → 长档（步骤 2 policy 引用） */
const USER_TEXT_LONG_THRESHOLD = 80;
/** 短档：方舟 prompt 目标字数 */
const ARK_PROMPT_MIN_SHORT = 100;
const ARK_PROMPT_MAX_SHORT = 280;
/** 长档：方舟 prompt 目标字数 */
const ARK_PROMPT_MIN_LONG = 280;
const ARK_PROMPT_MAX_LONG = 380;
/** 报告展示：方舟正文低于此字数一律不合格（选 A，步骤 4 验收引用） */
const ARK_DISPLAY_MIN_CHARS = 20;

/**
 * @deprecated 步骤 2 起由 ARK_PROMPT_* 替代；暂保留以免本步破坏 replyLengthPolicy / 单测
 */
const REPLY_MIN_CHARS = 180;
/** @deprecated 见 ARK_PROMPT_MAX_SHORT / ARK_PROMPT_MAX_LONG */
const REPLY_MAX_CHARS = 280;

const CACHE_COLLECTION = "reflection_ark_cache";

module.exports = {
  ARK_TIMEOUT_MS,
  ARK_BATCH_WALL_BUDGET_MS,
  DEPLOY_TAG,
  ARK_MAX_RETRIES,
  ARK_MAX_OUTPUT_TOKENS,
  ARK_MAX_OUTPUT_TOKENS_Q2_STAGE_A,
  ARK_MAX_OUTPUT_TOKENS_Q2_STAGE_B,
  Q2_STAGE_A_TIMEOUT_MS,
  Q2_STAGE_B_TIMEOUT_MAX_MS,
  Q2_WALL_RESERVE_MS,
  USER_TEXT_LONG_THRESHOLD,
  ARK_PROMPT_MIN_SHORT,
  ARK_PROMPT_MAX_SHORT,
  ARK_PROMPT_MIN_LONG,
  ARK_PROMPT_MAX_LONG,
  ARK_DISPLAY_MIN_CHARS,
  QUADRANT_Q1_ID,
  QUADRANT_Q2_ID,
  QUADRANT_Q3_ID,
  QUADRANT_Q4_ID,
  Q1_STRICT_TERMINAL_CARD,
  Q3_CHOICE_MIN,
  Q3_CHOICE_MAX,
  Q3_CHOICE_SOFT_MAX,
  Q3_USER_TEXT_TIER1,
  Q3_USER_TEXT_TIER2,
  Q3_TIER1_MIN,
  Q3_TIER1_MAX,
  Q3_TIER1_SOFT_MAX,
  Q3_TIER2_MIN,
  Q3_TIER2_MAX,
  Q3_TIER2_SOFT_MAX,
  Q3_TIER3_MIN,
  Q3_TIER3_MAX,
  Q3_TIER3_SOFT_MAX,
  Q3_STAGE_A_TIMEOUT_MS,
  Q3_STAGE_B_TIMEOUT_MAX_MS,
  ARK_MAX_OUTPUT_TOKENS_Q3_STAGE_A,
  ARK_MAX_OUTPUT_TOKENS_Q3_STAGE_B,
  ARK_Q2_PROMPT_MIN,
  ARK_Q2_PROMPT_MAX,
  ARK_Q2_SOFT_MAX,
  Q2_USER_TEXT_TIER1,
  Q2_USER_TEXT_TIER2,
  Q2_TIER1_MIN,
  Q2_TIER1_MAX,
  Q2_TIER1_SOFT_MAX,
  Q2_TIER2_MIN,
  Q2_TIER2_MAX,
  Q2_TIER2_SOFT_MAX,
  Q2_TIER3_MIN,
  Q2_TIER3_MAX,
  Q2_TIER3_SOFT_MAX,
  REPLY_MIN_CHARS,
  REPLY_MAX_CHARS,
  CACHE_COLLECTION,
};
