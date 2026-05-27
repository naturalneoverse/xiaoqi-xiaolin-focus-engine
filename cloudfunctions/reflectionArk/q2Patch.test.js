/**
 * 观心明己补丁 P8/P9：Q2 软截断、末字补句号、重试策略
 * 运行：node cloudfunctions/reflectionArk/q2Patch.test.js
 */
"use strict";

const assert = require("assert");
const { charCount } = require("./normalizeText");
const {
  QUADRANT_Q2_ID,
  Q2_TIER1_MIN,
  Q2_TIER1_MAX,
  Q2_TIER1_SOFT_MAX,
  Q2_TIER3_MAX,
  Q2_TIER3_SOFT_MAX,
} = require("./constants");
const { getReplyLengthBounds } = require("./replyLengthPolicy");
const {
  enforceReplyLength,
  enforceReplyLengthQ2Soft,
} = require("./replyLength");
const { finalizeAndAssessReply, finalizeReplyContent } = require("./openingCheck");
const { isArkReplyAcceptable } = require("./replyCompleteness");
const { shouldProduceRetryOnce, resolveProduceMaxAttempts } = require("./generateReply");
const { isBatchCardRetryable } = require("./generateQuadrantBatch");

const shortUser = "不被背叛";
const c2User = "考虑周全吧";

const q2Bounds = getReplyLengthBounds(shortUser, QUADRANT_Q2_ID);
assert.strictEqual(q2Bounds.min, Q2_TIER1_MIN, "q2 short user tier1 min");
assert.strictEqual(q2Bounds.max, Q2_TIER1_MAX, "q2 short user tier1 max");
assert.strictEqual(q2Bounds.tier, "q2_t1", "q2 tier1");

const q1Bounds = getReplyLengthBounds(shortUser, 1);
assert.strictEqual(q1Bounds.max, Q2_TIER1_MAX, "q1 short user uses q1_t1 max (aligned with q3 tier1)");
assert.strictEqual(q1Bounds.tier, "q1_t1", "q1 tier1");

const q1ChoiceBounds = getReplyLengthBounds("【题目】x\n【用户选择】y", 1);
assert.strictEqual(q1ChoiceBounds.tier, "q1_choice", "q1 choice tier");

/** c1 型：超长且末段无句末符，旧逻辑易硬切到「也能」 */
const c1Raw =
  "您愿意把信任交给自己，不必向外索取确定性。".repeat(35) +
  "不被背叛也意味着边界清晰，您也能也能也能也能也能";
assert(charCount(c1Raw) > Q2_TIER1_MAX, "c1 fixture exceeds q2 tier1 max");

const legacy280 = enforceReplyLength(c1Raw, { max: 280, min: 100 }, { neverPad: true });
assert(charCount(legacy280) <= 282, "non-q2 legacy capped near 280");
const legacyEndsTerminal = /[。！？；.!?;]$/.test(legacy280);

const q2Soft = enforceReplyLengthQ2Soft(c1Raw, q2Bounds);
assert.strictEqual(q2Soft.ok, true, "q2 soft truncate ok");
const q2Last = Array.from(q2Soft.text)[Array.from(q2Soft.text).length - 1];
assert(/[。！？；.!?;]/.test(q2Last), "q2 soft ends with sentence end");
assert(!q2Soft.text.endsWith("也能"), "q2 soft not dangling on 也能");
assert(charCount(q2Soft.text) <= Q2_TIER1_SOFT_MAX, "q2 soft within tier1 soft max");

const q1Body = finalizeReplyContent(c1Raw, "xiaolin", shortUser, 1);
const q2BodyOnly = finalizeReplyContent(c1Raw, "xiaolin", shortUser, QUADRANT_Q2_ID);
assert(/[。！？；.!?;]$/.test(q2BodyOnly), "q2 finalize c1 always terminal");
if (!legacyEndsTerminal) {
  assert(
    !/[。！？；.!?;]$/.test(q1Body) || charCount(q1Body) <= charCount(q2BodyOnly),
    "q1 may hard-cut without terminal when legacy does",
  );
}

const q2Finalize = finalizeAndAssessReply(c1Raw, "xiaolin", shortUser, QUADRANT_Q2_ID);
assert.strictEqual(q2Finalize.ok, true, "q2 finalize c1 sample ok");
assert(
  isArkReplyAcceptable(q2Finalize.text, { strictTerminal: true }).ok,
  "q2 finalized passes strict terminal",
);

const q1Finalize = finalizeAndAssessReply(c1Raw, "xiaolin", shortUser, 1);
assert.strictEqual(q1Finalize.ok, true, "q1 finalize same raw may still ok");
assert(isArkReplyAcceptable(q1Finalize.text).ok, "q1 non-strict acceptable");

/** c2 型：末字「自己」无句号 */
const c2Body =
  "您每一次静下心向内做哲思复盘的时刻，都是把心力收归到自身的过程。就像老庄所说的「静观自得」，复盘帮您更清晰摸透自己";
assert(charCount(c2Body) >= 20, "c2 fixture long enough");

assert.strictEqual(
  isArkReplyAcceptable(c2Body, { strictTerminal: true }).reason,
  "NO_TERMINAL_END",
  "q2 strict on c2 body",
);
assert(isArkReplyAcceptable(c2Body).ok, "non-q2 accepts c2 body with internal period");

const q2C2 = finalizeAndAssessReply(c2Body, "xiaolin", c2User, QUADRANT_Q2_ID, "c2");
assert.strictEqual(q2C2.ok, true, "q2 finalize c2 patches terminal");
assert(/[。！？；.!?;]$/.test(q2C2.text), "q2 c2 patched ends terminal");

const q1C2NoField = finalizeAndAssessReply(c2Body, "xiaolin", c2User, 1);
assert.strictEqual(q1C2NoField.ok, true, "q1 finalize c2 without cardField unchanged");

const q1C2Strict = finalizeAndAssessReply(c2Body, "xiaolin", c2User, 1, "c2");
assert.strictEqual(q1C2Strict.ok, true, "q1+c2 finalize patches terminal");
assert(/[。！？；.!?;]$/.test(q1C2Strict.text), "q1+c2 patched terminal");

/** 无句末符超长 → Q2 软截断：句末截或宽松截，不整段作废 */
const noPeriodRaw = "这是一段没有任何句末标点符号的连续叙述文字".repeat(30);
const q2NoPeriod = enforceReplyLengthQ2Soft(noPeriodRaw, q2Bounds);
assert.strictEqual(q2NoPeriod.ok, true, "q2 soft keeps truncated body");
assert(charCount(q2NoPeriod.text) <= Q2_TIER1_SOFT_MAX, "q2 soft no period within cap");

const q2EmptyFinalize = finalizeAndAssessReply(noPeriodRaw, "xiaolin", shortUser, QUADRANT_Q2_ID);
assert.strictEqual(q2EmptyFinalize.ok, false, "q2 finalize no inner period still fails assess");
assert.strictEqual(q2EmptyFinalize.reason, "NO_SENTENCE_END", "no sentence end in body");

/** 超 max 未超 softMax：容忍区不截断（长档用户） */
const longUserQ2 = "用户手写内容需要足够长才能进入第三档字数区间。".repeat(4);
const q2T3Bounds = getReplyLengthBounds(longUserQ2, QUADRANT_Q2_ID);
assert.strictEqual(q2T3Bounds.tier, "q2_t3", "long user tier3");
const tolBody = "您愿意面对卡点。".repeat(42);
assert(
  charCount(tolBody) > Q2_TIER3_MAX && charCount(tolBody) <= Q2_TIER3_SOFT_MAX,
  "tolerance fixture",
);
const q2Tol = enforceReplyLengthQ2Soft(tolBody, q2T3Bounds);
assert.strictEqual(q2Tol.ok, true, "tolerance zone pass-through");
assert.strictEqual(charCount(q2Tol.text), charCount(tolBody), "tolerance no chop");

/** P5/P6 重试开关 */
assert.strictEqual(shouldProduceRetryOnce({ allowRetryOnce: false }, QUADRANT_Q2_ID), true);
assert.strictEqual(resolveProduceMaxAttempts(undefined, 1), 1);
assert.strictEqual(
  isBatchCardRetryable({ fallback: true, errCode: "NO_TERMINAL_END" }, QUADRANT_Q2_ID),
  true,
);
assert.strictEqual(
  isBatchCardRetryable({ fallback: true, errCode: "NO_TERMINAL_END" }, 1),
  false,
);

console.log("[q2Patch.test] OK (34 assertions)");
