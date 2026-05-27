/**
 * personas 完整性 + 正文后处理单测
 * 运行：node cloudfunctions/reflectionArk/openingCheck.test.js
 */
"use strict";

const { XIAOQI_SYSTEM, XIAOLIN_SYSTEM } = require("./personas");
const {
  validatePersonaSystem,
  finalizeReplyContent,
  finalizeAndAssessReply,
} = require("./openingCheck");
const { stripLegacyOpening } = require("./stripLegacyOpening");
const { enforceReplyLength, validateReplyLengthRange } = require("./replyLength");
const { getReplyLengthBounds } = require("./replyLengthPolicy");
const { getFallbackReply, FALLBACK_REPLY } = require("./reflectionArkFallback");
const { charCount } = require("./normalizeText");
const {
  ARK_PROMPT_MIN_SHORT,
  ARK_PROMPT_MAX_SHORT,
  ARK_PROMPT_MAX_LONG,
  Q2_TIER1_MAX,
  Q2_TIER1_SOFT_MAX,
  USER_TEXT_LONG_THRESHOLD,
  QUADRANT_Q2_ID,
} = require("./constants");
const { enforceReplyLengthQ2Soft } = require("./replyLength");

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (!cond) {
    failed += 1;
    console.error(`FAIL: ${msg}`);
    return;
  }
  passed += 1;
}

assert(XIAOQI_SYSTEM.indexOf("小麒") >= 0, "XIAOQI_SYSTEM contains 小麒");
assert(XIAOLIN_SYSTEM.indexOf("小麟") >= 0, "XIAOLIN_SYSTEM contains 小麟");
assert(XIAOQI_SYSTEM.indexOf("极短") < 0, "persona no 极短");
assert(XIAOQI_SYSTEM.indexOf("一两句") < 0, "persona no 一两句");
assert(XIAOQI_SYSTEM.indexOf("100-280") >= 0, "persona short band");
assert(validatePersonaSystem("xiaoqi").ok, "validatePersonaSystem xiaoqi");
assert(validatePersonaSystem("xiaolin").ok, "validatePersonaSystem xiaolin");

const legacy =
  "心怀远志，步履方有方向，小麒与您一同理清前路方寸。您所经历的起伏，皆是在为下一步积蓄分寸。";
const stripped = stripLegacyOpening(legacy, "xiaoqi");
assert(stripped.indexOf("心怀远志") < 0, "stripLegacyOpening removes xiaoqi boilerplate");

const shortUser = "难";
const shortBounds = getReplyLengthBounds(shortUser);
assert(shortBounds.min === ARK_PROMPT_MIN_SHORT, "short user bounds min");
assert(shortBounds.max === ARK_PROMPT_MAX_SHORT, "short user bounds max");

const shortFinal = finalizeReplyContent("针对您此刻的坚持，值得被看见。", "xiaoqi", shortUser);
assert(charCount(shortFinal) <= shortBounds.max + 2, "short user → truncate max");
assert(validateReplyLengthRange(shortFinal, shortBounds, { neverPad: true }).ok, "neverPad allows under min");

const longUser = "这是一段较长的用户复盘原文。".repeat(8);
assert(charCount(longUser) > USER_TEXT_LONG_THRESHOLD, "fixture is long user");
const longBounds = getReplyLengthBounds(longUser);
const longFinal = finalizeReplyContent("解读正文。".repeat(80), "xiaoqi", longUser);
assert(charCount(longFinal) <= longBounds.max + 2, "long user → truncate max 380");
assert(validateReplyLengthRange(longFinal, longBounds, { neverPad: true }).ok, "long neverPad ok");

const assessedShort = finalizeAndAssessReply(
  "针对您此刻的坚持，值得被看见。",
  "xiaoqi",
  shortUser,
);
assert(!assessedShort.ok, "short ark below display min");

const fb = getFallbackReply("xiaoqi");
assert(fb === FALLBACK_REPLY, "fallback short text");

const neverPadShort = enforceReplyLength("短。", shortBounds, { neverPad: true });
assert(neverPadShort === "短。", "neverPad no pad to 100");
assert(charCount(neverPadShort) < ARK_PROMPT_MIN_SHORT, "neverPad stays short");

const truncated = enforceReplyLength("解读。".repeat(200), longBounds, { neverPad: true });
assert(charCount(truncated) <= ARK_PROMPT_MAX_LONG + 2, "neverPad truncates to long max");

const q2Bounds = getReplyLengthBounds("不被背叛", QUADRANT_Q2_ID);
assert(q2Bounds.max === Q2_TIER1_MAX, "q2 short user opening bounds max");

const q2OnlyStrict = finalizeReplyContent(
  "您愿意坦诚面对内心的节奏。".repeat(50) + "也能也能也能",
  "xiaolin",
  "不被背叛",
  QUADRANT_Q2_ID,
);
const q2LastCh = Array.from(q2OnlyStrict).pop();
assert(/[。！？；.!?;]/.test(q2LastCh || ""), "q2 finalize ends with terminal");

const q1SameRaw = finalizeReplyContent(
  "您愿意坦诚面对内心的节奏。".repeat(50) + "也能也能也能",
  "xiaolin",
  "不被背叛",
  1,
);
assert(charCount(q1SameRaw) <= ARK_PROMPT_MAX_SHORT + 2, "q1 finalize still short max");

const q2SoftLong = enforceReplyLengthQ2Soft("无句号连续字".repeat(80), q2Bounds);
assert(q2SoftLong.ok, "q2 soft no period uses relaxed truncate not void");
assert(charCount(q2SoftLong.text) <= Q2_TIER1_SOFT_MAX, "q2 soft capped near tier1 soft max");

if (failed > 0) {
  console.error(`\n[openingCheck.test] ${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`[openingCheck.test] OK (${passed} assertions)`);
