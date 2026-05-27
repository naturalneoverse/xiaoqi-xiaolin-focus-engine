/**
 * Q3 防幻觉 prompt 与分级篇幅
 * 运行：node cloudfunctions/reflectionArk/q3Prompts.test.js
 */
"use strict";

const assert = require("assert");
const {
  getQ3PersonaSystem,
  buildStageAUserContent,
  buildStageBUserContent,
} = require("./q3Prompts");
const { getReplyLengthBounds } = require("./replyLengthPolicy");
const { QUADRANT_Q3_ID, Q3_CHOICE_MAX } = require("./constants");

const sys = getQ3PersonaSystem();
assert(sys.indexOf("信息边界") >= 0, "system has anti-hallucination");
assert(sys.indexOf("您可以尝试") >= 0, "system has suggestion style");

const stageA = buildStageAUserContent("测试任务", "课题边界", "孩子的作业我常揽过来");
assert(stageA.indexOf("孩子的作业") >= 0, "stageA has user text");

const byField = {
  c0: { question: "课题", userText: "揽太多" },
  c1: {
    question: "被认可",
    userText: "【题目】有没有为了被认可而做？\n【用户选择】有时会",
  },
  c2: { question: "放下后", userText: "每天留半小时" },
};
const stageB = buildStageBUserContent("测试任务", byField);
assert(stageB.indexOf("===c1===") >= 0, "stageB markers");
assert(stageB.indexOf("禁止引用") >= 0 || stageB.indexOf("独有细节") >= 0, "stageB c0 isolation");

const choiceBounds = getReplyLengthBounds(byField.c1.userText, QUADRANT_Q3_ID);
assert.strictEqual(choiceBounds.tier, "q3_choice");
assert.strictEqual(choiceBounds.max, Q3_CHOICE_MAX);

console.log("[q3Prompts.test] OK");
