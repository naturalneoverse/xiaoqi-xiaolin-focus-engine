/**
 * personas 完整性 + 正文后处理单测
 * 运行：node cloudfunctions/reflectionArk/openingCheck.test.js
 */
"use strict";

const {
  XIAOQI_SYSTEM,
  XIAOLIN_SYSTEM,
  getPersonaSystem,
  getAgentKeyword,
  getAgentTypeForQuadrant,
  isValidAgentType,
} = require("./personas");
const { validatePersonaSystem, finalizeReplyContent } = require("./openingCheck");
const { stripLegacyOpening } = require("./stripLegacyOpening");
const { enforceReplyLength, validateReplyLengthRange } = require("./replyLength");
const { getReplyLengthBounds } = require("./replyLengthPolicy");
const { getFallbackReply, FALLBACK_REPLY } = require("./reflectionArkFallback");
const { charCount } = require("./normalizeText");
const { REPLY_MIN_CHARS, REPLY_MAX_CHARS } = require("./constants");

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
assert(validatePersonaSystem("xiaoqi").ok, "validatePersonaSystem xiaoqi");
assert(validatePersonaSystem("xiaolin").ok, "validatePersonaSystem xiaolin");

const legacy =
  "心怀远志，步履方有方向，小麒与您一同理清前路方寸。您所经历的起伏，皆是在为下一步积蓄分寸。";
const stripped = stripLegacyOpening(legacy, "xiaoqi");
assert(stripped.indexOf("心怀远志") < 0, "stripLegacyOpening removes xiaoqi boilerplate");

const shortUser = "难";
const shortBounds = getReplyLengthBounds(shortUser);
const shortFinal = finalizeReplyContent("针对您此刻的坚持，值得被看见。", "xiaoqi", shortUser);
assert(charCount(shortFinal) <= shortBounds.max + 2, "short user → short reply max");
assert(charCount(shortFinal) >= 1, "short user → no pad boilerplate");

const longFinal = finalizeReplyContent("解读正文。".repeat(80), "xiaoqi", "这是一段较长的用户复盘原文。".repeat(5));
const longBounds = getReplyLengthBounds("这是一段较长的用户复盘原文。".repeat(5));
assert(validateReplyLengthRange(longFinal, longBounds).ok, "long user length range");

const fb = getFallbackReply("xiaoqi");
assert(fb === FALLBACK_REPLY, "fallback short text");

const padded = enforceReplyLength("短。", getReplyLengthBounds("嗯"));
assert(charCount(padded) <= 96 + 2, "enforce short bounds");
assert(padded.indexOf("心怀远志") < 0, "enforce no opening");

const paddedLong = enforceReplyLength("解读。".repeat(50), { min: REPLY_MIN_CHARS, max: REPLY_MAX_CHARS });
assert(charCount(paddedLong) >= REPLY_MIN_CHARS, "long tier min");

if (failed > 0) {
  console.error(`\n[openingCheck.test] ${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`[openingCheck.test] OK (${passed} assertions)`);
