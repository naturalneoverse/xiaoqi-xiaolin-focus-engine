/**
 * 身体边界周报 · 周存档与百炼成文常量（阶段 1 冻结）
 *
 * weekKey：自然周周一，与 `momentScore.weekMondayKey` / `mondayDateFromKey` 一致（YYYY-MM-DD）。
 * 本地存储键：`body_week_archive_v1`（见 storageKeys.BODY_WEEK_ARCHIVE_V1）。
 *
 * 云侧镜像（须同步修改）：cloudfunctions/reflectionArk/bodyWeekCareConstants.js
 */

/** @typedef {"open"|"closed"} BodyWeekArchiveStatus */
/** @typedef {"model"|"rule"|"rule_fallback"} BodyWeekArchiveSource */

/**
 * @typedef {object} BodyWeekBullet
 * @property {string} type 见 BULLET_TYPES
 * @property {string} text 事实句，不含用户可见分数
 */

/**
 * @typedef {object} BodyWeekArchiveEntry
 * @property {string} weekKey 周一 YYYY-MM-DD
 * @property {string} statsHash 周数据指纹（阶段 2 实现算法）
 * @property {BodyWeekArchiveStatus} status open=进行中可随 hash 更新；closed=结案只读
 * @property {string} [closedAt] ISO 本地时间，status=closed 时必填
 * @property {BodyWeekBullet[]} bullets 方案 D 事实源（稀疏周可为空）
 * @property {string} statusDesc 状态卡成文，50～80 字
 * @property {string} careText 小麟气泡，32～48 字（生成硬上限 55）
 * @property {BodyWeekArchiveSource} source
 * @property {string} finalStatusTitle 展示用档位标题快照（规则计算，模型不改）
 * @property {string} [extremeLine] UI 黄字快照（可选）
 * @property {number} [validDayCount] 有效打卡天数（末条 dedupe 后）
 * @property {string} [updatedAt] ISO，最后一次写入
 */

const ARCHIVE_SCHEMA_VERSION = 1;

const ARCHIVE_STATUS = Object.freeze({
  OPEN: "open",
  CLOSED: "closed",
});

const ARCHIVE_SOURCE = Object.freeze({
  MODEL: "model",
  RULE: "rule",
  RULE_FALLBACK: "rule_fallback",
});

/** validDayCount < 此值 → 仅规则句，不调模型 */
const SPARSE_MIN_VALID_DAYS = 2;

const STATUS_DESC_MIN_CHARS = 50;
const STATUS_DESC_MAX_CHARS = 80;
const CARE_TEXT_MIN_CHARS = 32;
const CARE_TEXT_MAX_CHARS = 48;
/** 百炼生成与校验硬上限（UI 压测曾测 55 字） */
const CARE_TEXT_HARD_MAX_CHARS = 55;
/** chat-bubble maxLength，仅防异常长串 */
const BUBBLE_UI_MAX_LENGTH = 200;

/** 与 mascotEngine/postFilter 对齐，并用于身体周报用户可见文案 */
const FORBIDDEN_USER_COPY_RE = /得分|评分|分数|不合格|不达标/;

/** 禁止「108分」「120 分」等报分表述 */
const FORBIDDEN_SCORE_PHRASE_RE = /\d+\s*分/;

/** 禁止周均/平均分 + 数字（bullet 与成文均不得出现） */
const FORBIDDEN_WEEK_AVG_SCORE_RE = /(?:周均|平均分|均值)[^\d]{0,16}\d{2,3}/;

const WEEK_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** 阶段 2 buildBodyWeekBullets 使用的类型枚举 */
const BULLET_TYPES = Object.freeze([
  "SPARSE",
  "BAND",
  "DAYS",
  "SLEEP_DOM",
  "SPORT_DOM",
  "SIGNAL_DOM",
  "WEAK_SLEEP",
  "WEAK_SPORT",
  "WEAK_SIGNAL",
  "EXTREME_SLEEP",
  "EXTREME_SPORT",
  "EXTREME_SIGNAL",
  "EXTREME_NONE",
  "DOWNGRADE",
  "TREND",
]);

/** statusDesc 须覆盖的极值关键词（与 bullet EXTREME_* 对应，阶段 3 校验用） */
const EXTREME_STATUS_KEYWORDS = Object.freeze({
  EXTREME_SLEEP: ["睡不着", "失眠"],
  EXTREME_SPORT: ["动过头", "过载"],
  EXTREME_SIGNAL: ["疼了", "疼痛"],
});

const ARCHIVE_SOURCES = Object.freeze(Object.values(ARCHIVE_SOURCE));
const ARCHIVE_STATUSES = Object.freeze(Object.values(ARCHIVE_STATUS));

function countChars(text) {
  return [...String(text || "")].length;
}

/**
 * @param {string} text
 * @returns {{ ok: boolean, hits: string[] }}
 */
function findForbiddenUserCopyHits(text) {
  const s = String(text || "");
  const hits = [];
  if (FORBIDDEN_USER_COPY_RE.test(s)) hits.push("forbidden_phrase");
  if (FORBIDDEN_SCORE_PHRASE_RE.test(s)) hits.push("score_with_分");
  if (FORBIDDEN_WEEK_AVG_SCORE_RE.test(s)) hits.push("week_avg_number");
  return { ok: hits.length === 0, hits };
}

/**
 * @param {string} field "statusDesc"|"careText"
 * @param {string} text
 * @returns {{ ok: boolean, chars: number, reason?: string }}
 */
function checkCopyLength(field, text) {
  const chars = countChars(text);
  if (field === "statusDesc") {
    if (chars < STATUS_DESC_MIN_CHARS) return { ok: false, chars, reason: "statusDesc_too_short" };
    if (chars > STATUS_DESC_MAX_CHARS) return { ok: false, chars, reason: "statusDesc_too_long" };
    return { ok: true, chars };
  }
  if (field === "careText") {
    if (chars < CARE_TEXT_MIN_CHARS) return { ok: false, chars, reason: "careText_too_short" };
    if (chars > CARE_TEXT_HARD_MAX_CHARS) return { ok: false, chars, reason: "careText_over_hard_max" };
    return { ok: true, chars };
  }
  return { ok: true, chars };
}

module.exports = {
  ARCHIVE_SCHEMA_VERSION,
  ARCHIVE_STATUS,
  ARCHIVE_SOURCE,
  ARCHIVE_SOURCES,
  ARCHIVE_STATUSES,
  SPARSE_MIN_VALID_DAYS,
  STATUS_DESC_MIN_CHARS,
  STATUS_DESC_MAX_CHARS,
  CARE_TEXT_MIN_CHARS,
  CARE_TEXT_MAX_CHARS,
  CARE_TEXT_HARD_MAX_CHARS,
  BUBBLE_UI_MAX_LENGTH,
  FORBIDDEN_USER_COPY_RE,
  FORBIDDEN_SCORE_PHRASE_RE,
  FORBIDDEN_WEEK_AVG_SCORE_RE,
  WEEK_KEY_RE,
  BULLET_TYPES,
  EXTREME_STATUS_KEYWORDS,
  countChars,
  findForbiddenUserCopyHits,
  checkCopyLength,
};
