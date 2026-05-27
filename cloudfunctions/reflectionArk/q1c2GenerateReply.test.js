/**
 * 观实归真 Q1·c2：generateReply 读缓存/入库路径（R2；对照组见 q1c2Terminal.test.js R4）
 * 运行：node cloudfunctions/reflectionArk/q1c2GenerateReply.test.js
 */
"use strict";

const assert = require("assert");
const { assessArkReplyForCard } = require("./replyCompleteness");
const {
  shouldProduceRetryOnce,
  resolveProduceMaxAttempts,
  isQ1C2StrictCard,
} = require("./generateReply");
const { isBatchCardRetryable } = require("./generateQuadrantBatch");
const {
  QUADRANT_Q1_ID,
  QUADRANT_Q2_ID,
  Q1_STRICT_TERMINAL_CARD,
} = require("./constants");

const c2Body =
  "您每一次静下心向内做哲思复盘的时刻，都是把心力收归到自身的过程。就像老庄所说的「静观自得」，复盘帮您更清晰摸透自己";

assert.strictEqual(isQ1C2StrictCard(QUADRANT_Q1_ID, Q1_STRICT_TERMINAL_CARD), true);
assert.strictEqual(isQ1C2StrictCard(QUADRANT_Q1_ID, "c0"), false);
assert.strictEqual(isQ1C2StrictCard(QUADRANT_Q2_ID, "c2"), false);

/** 读缓存：Q1·c2 无末句号 → 视为 CACHE_STALE_INVALID */
const q1C2Cache = assessArkReplyForCard(QUADRANT_Q1_ID, "c2", c2Body);
assert.strictEqual(q1C2Cache.ok, false);
assert.strictEqual(q1C2Cache.reason, "NO_TERMINAL_END");

/** 读缓存：Q1·c0 同文仍可通过 */
const q1C0Cache = assessArkReplyForCard(QUADRANT_Q1_ID, "c0", c2Body);
assert.strictEqual(q1C0Cache.ok, true);

/** 入库前终检：补句号后可入库 */
const q1C2Ok = assessArkReplyForCard(QUADRANT_Q1_ID, "c2", `${c2Body}。`);
assert.strictEqual(q1C2Ok.ok, true);

/** R2 不扩大 Q1 单卡/批量重试 */
assert.strictEqual(
  shouldProduceRetryOnce({ allowRetryOnce: false }, QUADRANT_Q1_ID),
  false,
);
assert.strictEqual(resolveProduceMaxAttempts(undefined, QUADRANT_Q1_ID), 1);
assert.strictEqual(
  isBatchCardRetryable({ ok: true, fallback: true, errCode: "NO_TERMINAL_END" }, QUADRANT_Q1_ID),
  false,
);

console.log("[q1c2GenerateReply.test] OK (11 assertions)");
