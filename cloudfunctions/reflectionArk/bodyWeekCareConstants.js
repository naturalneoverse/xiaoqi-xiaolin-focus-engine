/**
 * 身体边界周报 · 成文常量（云函数侧，与小程序同步）
 *
 * 修改须同步：miniprogram/config/bodyWeekArchiveConstants.js
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

const SPARSE_MIN_VALID_DAYS = 2;

const STATUS_DESC_MIN_CHARS = 50;
const STATUS_DESC_MAX_CHARS = 80;
const CARE_TEXT_MIN_CHARS = 32;
const CARE_TEXT_MAX_CHARS = 48;
const CARE_TEXT_HARD_MAX_CHARS = 55;

const FORBIDDEN_USER_COPY_RE = /得分|评分|分数|不合格|不达标/;
const FORBIDDEN_SCORE_PHRASE_RE = /\d+\s*分/;
const FORBIDDEN_WEEK_AVG_SCORE_RE = /(?:周均|平均分|均值)[^\d]{0,16}\d{2,3}/;

const EXTREME_STATUS_KEYWORDS = Object.freeze({
  EXTREME_SLEEP: ["睡不着", "失眠"],
  EXTREME_SPORT: ["动过头", "过载"],
  EXTREME_SIGNAL: ["疼了", "疼痛"],
});

function countChars(text) {
  return [...String(text || "")].length;
}

function findForbiddenUserCopyHits(text) {
  const s = String(text || "");
  const hits = [];
  if (FORBIDDEN_USER_COPY_RE.test(s)) hits.push("forbidden_phrase");
  if (FORBIDDEN_SCORE_PHRASE_RE.test(s)) hits.push("score_with_分");
  if (FORBIDDEN_WEEK_AVG_SCORE_RE.test(s)) hits.push("week_avg_number");
  return { ok: hits.length === 0, hits };
}

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
  SPARSE_MIN_VALID_DAYS,
  STATUS_DESC_MIN_CHARS,
  STATUS_DESC_MAX_CHARS,
  CARE_TEXT_MIN_CHARS,
  CARE_TEXT_MAX_CHARS,
  CARE_TEXT_HARD_MAX_CHARS,
  FORBIDDEN_USER_COPY_RE,
  FORBIDDEN_SCORE_PHRASE_RE,
  FORBIDDEN_WEEK_AVG_SCORE_RE,
  EXTREME_STATUS_KEYWORDS,
  countChars,
  findForbiddenUserCopyHits,
  checkCopyLength,
};
