/**
 * Q2 提交结语气泡：6 行手动换行 + 单步「知道了」
 * 运行：node miniprogram/config/reflectionConclusions.q2.test.js
 */
"use strict";

const assert = require("assert");
const {
  Q2_BUBBLE_LINES,
  buildQ2ConclusionBubbles,
  buildQuadrantConclusions,
  isQuadrantConclusionBubbleCentered,
} = require("./reflectionConclusions");

const expectedLines = [
  "卡住的地方，",
  "往往就是最在意的地方。",
  "小麟陪着您，",
  "先把这根弦看见就好。",
  "完整回响正在写入报告，",
  "稍后可查看。",
];

assert.strictEqual(Q2_BUBBLE_LINES, expectedLines.join("\n"), "six manual lines");

const bubbles = buildQ2ConclusionBubbles();
assert.strictEqual(bubbles.length, 1, "single bubble one tap");
assert.strictEqual(bubbles[0], Q2_BUBBLE_LINES, "bubble text matches lines");

const fromBuild = buildQuadrantConclusions(2, []);
assert.strictEqual(fromBuild.length, 1, "quadrant 2 uses q2 builder");
assert.strictEqual(fromBuild[0], bubbles[0], "buildQuadrantConclusions q2");

assert.strictEqual(isQuadrantConclusionBubbleCentered(2), true, "q2 centered");
assert.strictEqual(isQuadrantConclusionBubbleCentered(1), false, "other quadrants left");

console.log("[reflectionConclusions.q2.test] OK (7 assertions)");
