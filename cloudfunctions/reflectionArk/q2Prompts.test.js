/**
 * Q2 防幻觉 prompt 与分级篇幅
 * 运行：node cloudfunctions/reflectionArk/q2Prompts.test.js
 */
"use strict";

const assert = require("assert");
const {
  getQ2PersonaSystem,
  buildStageAUserContent,
  buildStageBUserContent,
} = require("./q2Prompts");
const { getReplyLengthBounds } = require("./replyLengthPolicy");
const { QUADRANT_Q2_ID, Q2_TIER1_MAX, Q2_TIER3_MIN } = require("./constants");

const sys = getQ2PersonaSystem();
assert(sys.indexOf("信息边界") >= 0, "system has anti-hallucination");
assert(sys.indexOf("可以尝试") >= 0, "system has suggestion style");

const stageA = buildStageAUserContent("测试任务", "哪里卡住了", "时间太紧人手不够");
assert(stageA.indexOf("时间太紧人手不够") >= 0, "stageA has user text");
assert(stageA.indexOf("80") >= 0 && stageA.indexOf("150") >= 0, "stageA tier1 length");

const byField = {
  c0: {
    question: "卡住了？",
    userText: "忙工作",
  },
  c1: {
    question: "哪根弦",
    userText: "儿子难过",
  },
  c2: {
    question: "真正在意",
    userText: "尽快做好",
  },
};
const stageB = buildStageBUserContent("测试任务", byField);
assert(stageB.indexOf("禁止引用") >= 0 || stageB.indexOf("独有细节") >= 0, "stageB c0 isolation");
assert(stageB.indexOf("===c1===") >= 0, "stageB markers");

const t1 = getReplyLengthBounds("短", QUADRANT_Q2_ID);
assert.strictEqual(t1.tier, "q2_t1");
assert.strictEqual(t1.max, Q2_TIER1_MAX);

const longHand = "这是一段足够长的用户手写内容用于进入第三档。".repeat(5);
const t3 = getReplyLengthBounds(longHand, QUADRANT_Q2_ID);
assert.strictEqual(t3.tier, "q2_t3");
assert(t3.min >= Q2_TIER3_MIN, "tier3 min");

console.log("[q2Prompts.test] OK (12 assertions)");
