/**
 * Q1 API 目标收集（含 c1 单选）
 * 运行：node miniprogram/config/reflectionArkApiMap.q1.test.js
 */
"use strict";

const assert = require("assert");
const { collectHandwritingApiTargets } = require("./reflectionArkApiMap");
const { buildQuadrantEchoSegments } = require("../utils/reflectionReportSegments");

const form = {
  textValues: {
    c0: "和预期不太一样",
    c2: "还剩下疲惫",
  },
  singleValues: { c1: "full" },
  multiValues: {},
  multiExpandValues: {},
};

const targets = collectHandwritingApiTargets(1, form);
const fields = targets.map((t) => t.cardField).sort();
assert.deepStrictEqual(fields, ["c0", "c1", "c2"], "Q1 must collect c0 c1 c2");

const c1 = targets.find((t) => t.cardField === "c1");
assert(c1 && c1.userText.includes("【用户选择】"), "c1 uses choice format");
assert(c1.userText.includes("全心投入，忘了时间"), "c1 label resolved");
assert(c1.question, "c1 has question");

const segs = buildQuadrantEchoSegments(1, [
  { type: "text", text: "a" },
  { type: "single", selected: "full", label: "全心投入，忘了时间" },
  { type: "text", text: "b" },
]);
const c1Seg = segs.find((s) => s.cardField === "c1");
assert(c1Seg && c1Seg.choiceLabel === "全心投入，忘了时间", "segment has choiceLabel");
assert(c1Seg.type === "handwriting", "c1 is handwriting not local choice");

console.log("[reflectionArkApiMap.q1.test] OK");
