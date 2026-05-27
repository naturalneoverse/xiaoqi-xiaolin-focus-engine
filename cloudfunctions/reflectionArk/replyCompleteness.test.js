/**
 * 方舟解读完整性验收单测（含 R4 Q1·c2 / 对照组）
 * 运行：node cloudfunctions/reflectionArk/replyCompleteness.test.js
 */
"use strict";

const {
  isArkReplyAcceptable,
  completenessOptionsForCard,
  assessArkReplyForCard,
} = require("./replyCompleteness");
const { finalizeAndAssessReply } = require("./openingCheck");
const { charCount } = require("./normalizeText");
const {
  USER_TEXT_LONG_THRESHOLD,
  ARK_PROMPT_MIN_SHORT,
  ARK_PROMPT_MAX_SHORT,
  ARK_PROMPT_MIN_LONG,
  ARK_PROMPT_MAX_LONG,
  ARK_DISPLAY_MIN_CHARS,
} = require("./constants");
const { getReplyLengthBounds } = require("./replyLengthPolicy");
const { QUADRANT_Q2_ID, Q2_TIER1_MIN, Q2_TIER1_MAX } = require("./constants");

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

assert(ARK_DISPLAY_MIN_CHARS === 20, "display min 20");

assert(!isArkReplyAcceptable("不必").ok, "2-char reject");
assert(isArkReplyAcceptable("不必").reason === "TOO_SHORT_DISPLAY", "2-char reason");

assert(!isArkReplyAcceptable("知是行之始。").ok, "short complete under 20 reject");

assert(!isArkReplyAcceptable("您执念里预设").ok, "dangling short reject");

const danglingLong =
  "依照您此刻的觉察，心不必刻意攀附遥不可及的虚";
assert(!isArkReplyAcceptable(danglingLong).ok, "long no period reject");
assert(
  isArkReplyAcceptable(danglingLong).reason === "NO_SENTENCE_END",
  "long no period reason",
);

const okLong =
  "依照您此刻的觉察，心宜落在可及的实处，方能安稳前行。";
assert(isArkReplyAcceptable(okLong).ok, "long closed sentence ok");

const sixSetLike = "齐物不是糊是非，是少执取；执取少了，所见便真。";
assert(isArkReplyAcceptable(sixSetLike).ok, "six-set-like length ok");

assert(!isArkReplyAcceptable("《老子》所言「合抱之木，生于毫末").ok, "unclosed quote reject");

const noTerminalEnd =
  "您每一次静下心向内做哲思复盘的时刻，都是把心力收归到自身的过程。就像老庄所说的「静观自得」，复盘帮您更清晰摸透自己";
assert(isArkReplyAcceptable(noTerminalEnd).ok, "non-q2 allows internal period only");
assert(!isArkReplyAcceptable(noTerminalEnd, { strictTerminal: true }).ok, "q2 strict rejects no terminal end");
assert(
  isArkReplyAcceptable(noTerminalEnd, { strictTerminal: true }).reason === "NO_TERMINAL_END",
  "q2 strict reason",
);

const withTerminal = `${noTerminalEnd}。`;
assert(isArkReplyAcceptable(withTerminal, { strictTerminal: true }).ok, "q2 strict ok with period");

const shortBounds = getReplyLengthBounds("难");
assert(shortBounds.min === ARK_PROMPT_MIN_SHORT, "short tier min");
assert(shortBounds.max === ARK_PROMPT_MAX_SHORT, "short tier max");
assert(shortBounds.tier === "short", "short tier name");

const longUser = "x".repeat(USER_TEXT_LONG_THRESHOLD + 1);
const longBounds = getReplyLengthBounds(longUser);
assert(longBounds.min === ARK_PROMPT_MIN_LONG, "long tier min");
assert(longBounds.max === ARK_PROMPT_MAX_LONG, "long tier max");

const assessed = finalizeAndAssessReply(
  "针对您此刻的坚持，值得被看见。",
  "xiaoqi",
  "难",
  1,
);
assert(!assessed.ok, "finalize short ark fails display min");
assert(assessed.reason === "TOO_SHORT_DISPLAY", "finalize short reason");

const assessedLong = finalizeAndAssessReply(
  "解读正文。".repeat(80),
  "xiaoqi",
  longUser,
  1,
);

const assessedQ2NoEnd = finalizeAndAssessReply(
  noTerminalEnd,
  "xiaolin",
  "考虑周全吧",
  2,
  "c0",
);
assert(assessedQ2NoEnd.ok, "q2 finalize patches missing terminal when inner period exists");
assert(/[。！？；.!?;]$/.test(assessedQ2NoEnd.text), "q2 patched terminal");

const q2Policy = getReplyLengthBounds("不被背叛", QUADRANT_Q2_ID);
assert(q2Policy.min === Q2_TIER1_MIN, "q2 short policy min");
assert(q2Policy.max === Q2_TIER1_MAX, "q2 short policy max");
assert(q2Policy.tier === "q2_t1", "q2 short tier");
assert(
  isArkReplyAcceptable(noTerminalEnd, { strictTerminal: true }).reason === "NO_TERMINAL_END",
  "q2 strict opts via flag",
);
assert(isArkReplyAcceptable(noTerminalEnd).ok, "q3 path no strict flag ok");

const q1NoEndOk = finalizeAndAssessReply(noTerminalEnd, "xiaolin", "难", 1);
assert(q1NoEndOk.ok, "q1 finalize without cardField allows no terminal end");

const q1C2Strict = finalizeAndAssessReply(noTerminalEnd, "xiaolin", "难", 1, "c2");
assert(q1C2Strict.ok, "q1+c2 finalize patches terminal");
assert(/[。！？；.!?;]$/.test(q1C2Strict.text), "q1+c2 patched");

const q1C0NoField = finalizeAndAssessReply(noTerminalEnd, "xiaolin", "难", 1, "c0");
assert(q1C0NoField.ok, "q1+c0 still allows no terminal end");

assert(
  completenessOptionsForCard(1, "c2").strictTerminal === true,
  "q1 c2 opts strict",
);
assert(!completenessOptionsForCard(1, "c0"), "q1 c0 no strict opts");
assert(completenessOptionsForCard(2, "c0").strictTerminal === true, "q2 any card strict");
assert(completenessOptionsForCard(3, "c0").strictTerminal === true, "q3 any card strict");
assert(
  assessArkReplyForCard(3, "c2", noTerminalEnd).reason === "NO_TERMINAL_END",
  "q3 c2 strict terminal",
);

assert(assessedLong.ok, "finalize long ark acceptable");
assert(charCount(assessedLong.text) <= ARK_PROMPT_MAX_LONG + 2, "finalize long within max");

if (failed > 0) {
  console.error(`\n[replyCompleteness.test] ${failed} failed, ${passed} passed`);
  process.exit(1);
}
console.log(`[replyCompleteness.test] OK (${passed} assertions)`);
