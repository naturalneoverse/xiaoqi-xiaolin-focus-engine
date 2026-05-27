/**
 * R4：小程序报告读缓存 — 仅 Q1·c2 strict，对照组不变（须与云函数 replyCompleteness 同步）
 * 运行：node miniprogram/utils/reflectionArkReplyQuality.test.js
 */
"use strict";

const assert = require("assert");
const { buildReplyMapFromRows } = require("./reflectionArkCache");
const { buildTextHash } = require("./reflectionArkTextHash");
const { resolveHandwritingReply } = require("./reflectionReportAssembly");
const { getFallbackReply, getQ1MissingHandwritingReply } = require("../config/reflectionArkFallback");
const {
  isArkReplyAcceptable,
  completenessOptionsForCard,
  completenessOptionsForQuadrant,
  assessArkReplyForCard,
  QUADRANT_Q1_ID,
  QUADRANT_Q2_ID,
  Q1_STRICT_TERMINAL_CARD,
} = require("./reflectionArkReplyQuality");

const noTerminalEnd =
  "您每一次静下心向内做哲思复盘的时刻，都是把心力收归到自身的过程。就像老庄所说的「静观自得」，复盘帮您更清晰摸透自己";

/** 开关：仅 Q1·c2 */
assert(
  completenessOptionsForCard(QUADRANT_Q1_ID, Q1_STRICT_TERMINAL_CARD).strictTerminal === true,
  "ONLY q1+c2 strict",
);
assert(!completenessOptionsForCard(QUADRANT_Q1_ID, "c0"), "control q1 c0");
assert(!completenessOptionsForCard(QUADRANT_Q1_ID, "c1"), "control q1 c1");
assert(!completenessOptionsForCard(3, "c2"), "control q3 c2");
assert(!completenessOptionsForQuadrant(QUADRANT_Q1_ID), "q1 whole quadrant not strict");

assert(isArkReplyAcceptable(noTerminalEnd).ok, "non-strict allows internal period");
assert(
  isArkReplyAcceptable(noTerminalEnd, completenessOptionsForQuadrant(QUADRANT_Q2_ID)).reason ===
    "NO_TERMINAL_END",
  "q2 unchanged",
);
assert(
  isArkReplyAcceptable(`${noTerminalEnd}。`, completenessOptionsForCard(QUADRANT_Q2_ID, "c2")).ok,
  "q2 ok with terminal",
);

const c1Hang =
  "您愿意把信任交给自己，不必向外索取确定性。".repeat(8) +
  "不被背叛也意味着边界清晰，您也能也能";
assert(isArkReplyAcceptable(c1Hang).ok, "control q1 c1 hang may pass");
assert(
  !isArkReplyAcceptable(c1Hang, completenessOptionsForCard(QUADRANT_Q2_ID, "c1")).ok,
  "q2 c1 strict unchanged",
);

assert.strictEqual(assessArkReplyForCard(QUADRANT_Q1_ID, "c2", noTerminalEnd).reason, "NO_TERMINAL_END");
assert(assessArkReplyForCard(QUADRANT_Q1_ID, "c0", noTerminalEnd).ok, "q1 c0 control ok");
assert(assessArkReplyForCard(3, "c2", noTerminalEnd).ok, "q3 c2 control ok");

const userC2 = "看见什么";
const { hash: c2Hash } = buildTextHash(userC2);
const map = buildReplyMapFromRows(
  [{ cardField: "c2", textHash: c2Hash, replyContent: noTerminalEnd }],
  QUADRANT_Q1_ID,
);
assert(!map[`c2:${c2Hash}`], "buildReplyMap skips bad q1 c2");

const { hash: c0Hash } = buildTextHash("一样吗");
const mapC0 = buildReplyMapFromRows(
  [{ cardField: "c0", textHash: c0Hash, replyContent: noTerminalEnd }],
  QUADRANT_Q1_ID,
);
assert(mapC0[`c0:${c0Hash}`], "buildReplyMap keeps q1 c0");

const seg = {
  quadrantId: QUADRANT_Q1_ID,
  cardField: "c2",
  userText: userC2,
  agentType: "xiaolin",
};
const fallback0 = getFallbackReply(QUADRANT_Q1_ID, "c2", { setIndex: 0 });
const fromStale = resolveHandwritingReply(
  { [`c2:${c2Hash}`]: noTerminalEnd },
  seg,
  [],
  0,
);
assert.strictEqual(fromStale, getQ1MissingHandwritingReply(), "resolveHandwritingReply q1 c2 stale → missing");
assert.notStrictEqual(fromStale, fallback0, "q1 no six-pack fallback");
const fromGood = resolveHandwritingReply(
  { [`c2:${c2Hash}`]: `${noTerminalEnd}。` },
  seg,
  [],
  0,
);
assert.strictEqual(fromGood, `${noTerminalEnd}。`, "resolveHandwritingReply q1 c2 good cache");

console.log("[reflectionArkReplyQuality.test] OK (20 assertions)");
