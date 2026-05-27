/**
 * R4：观实归真 Q1·c2 末字句号 — 仅 c2 strict，对照组不变
 * 防范：勿将 Q1 整象限或 Q4 设为 strictTerminal（Q2/Q3 全卡 strict）
 * 运行：node cloudfunctions/reflectionArk/q1c2Terminal.test.js
 */
"use strict";

const assert = require("assert");
const {
  assessArkReplyForCard,
  completenessOptionsForCard,
} = require("./replyCompleteness");
const { finalizeAndAssessReply } = require("./openingCheck");
const {
  QUADRANT_Q1_ID,
  QUADRANT_Q2_ID,
  QUADRANT_Q3_ID,
  Q1_STRICT_TERMINAL_CARD,
} = require("./constants");

const c2Fixture =
  "您每一次静下心向内做哲思复盘的时刻，都是把心力收归到自身的过程。就像老庄所说的「静观自得」，复盘帮您更清晰摸透自己";

/** —— 开关：Q1·c2 + Q2/Q3 全卡 —— */
assert.strictEqual(
  completenessOptionsForCard(QUADRANT_Q1_ID, Q1_STRICT_TERMINAL_CARD).strictTerminal,
  true,
  "ONLY q1+c2 enables strict",
);
assert.strictEqual(completenessOptionsForCard(QUADRANT_Q1_ID, "c0"), undefined, "control q1 c0");
assert.strictEqual(completenessOptionsForCard(QUADRANT_Q1_ID, "c1"), undefined, "control q1 c1");
assert.strictEqual(
  completenessOptionsForCard(QUADRANT_Q3_ID, "c2").strictTerminal,
  true,
  "q3 all cards strict",
);
assert.strictEqual(completenessOptionsForCard(4, "c0"), undefined, "control q4 c0");
assert.strictEqual(
  completenessOptionsForCard(QUADRANT_Q2_ID, "c0").strictTerminal,
  true,
  "q2 all cards strict unchanged",
);

/** —— 验收：Q1·c2 无末句号 / 有末句号 —— */
assert.strictEqual(
  assessArkReplyForCard(QUADRANT_Q1_ID, "c2", c2Fixture).reason,
  "NO_TERMINAL_END",
);
assert.strictEqual(assessArkReplyForCard(QUADRANT_Q1_ID, "c2", `${c2Fixture}。`).ok, true);

/** —— 对照组：同文在不同卡/象限 —— */
assert.strictEqual(assessArkReplyForCard(QUADRANT_Q1_ID, "c0", c2Fixture).ok, true, "q1 c0 same body ok");
assert.strictEqual(
  assessArkReplyForCard(QUADRANT_Q3_ID, "c2", c2Fixture).reason,
  "NO_TERMINAL_END",
  "q3 c2 strict",
);
assert.strictEqual(assessArkReplyForCard(4, "c0", c2Fixture).ok, true, "q4 c0 same body ok");
assert.strictEqual(
  assessArkReplyForCard(QUADRANT_Q2_ID, "c2", c2Fixture).reason,
  "NO_TERMINAL_END",
  "q2 c2 still strict",
);

/** —— finalize：须显式 cardField 才卡 Q1·c2 —— */
assert.strictEqual(
  finalizeAndAssessReply(c2Fixture, "xiaolin", "难", QUADRANT_Q1_ID).ok,
  true,
  "q1 finalize no cardField = control (not whole-q1 strict)",
);
const q1C2Final = finalizeAndAssessReply(c2Fixture, "xiaolin", "难", QUADRANT_Q1_ID, "c2");
assert.strictEqual(q1C2Final.ok, true, "q1+c2 finalize patches terminal");
assert(/[。！？；.!?;]$/.test(q1C2Final.text), "q1+c2 patched ends terminal");
assert.strictEqual(
  finalizeAndAssessReply(c2Fixture, "xiaolin", "难", QUADRANT_Q1_ID, "c0").ok,
  true,
);

console.log("[q1c2Terminal.test] OK (16 assertions)");
