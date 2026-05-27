/**
 * Q3 API 目标收集（含 c1 单选）
 * 运行：node miniprogram/config/reflectionArkApiMap.q3.test.js
 */
"use strict";

const assert = require("assert");
const {
  collectHandwritingApiTargets,
  formatSingleChoiceUserText,
  parseSingleChoiceUserText,
} = require("./reflectionArkApiMap");
const { formatUserChoice } = require("../utils/reflectionReportNarrative");
const { buildQuadrantEchoSegments } = require("../utils/reflectionReportSegments");

const form = {
  textValues: {
    c0: "孩子的作业我常揽过来",
    c2: "好好爱自己和孩子",
  },
  singleValues: { c1: "none" },
  multiValues: {},
  multiExpandValues: {},
};

const targets = collectHandwritingApiTargets(3, form);
const fields = targets.map((t) => t.cardField).sort();
assert.deepStrictEqual(fields, ["c0", "c1", "c2"], "Q3 must collect c0 c1 c2");

const c1 = targets.find((t) => t.cardField === "c1");
assert(c1 && c1.userText.includes("【用户选择】"), "c1 uses choice format");
assert(c1.userText.includes("没有，我就是想做这件事本身"), "c1 label resolved");

const withoutSingle = collectHandwritingApiTargets(3, {
  textValues: form.textValues,
  multiValues: {},
  multiExpandValues: {},
});
assert(
  withoutSingle.map((t) => t.cardField).sort().join() === "c0,c2",
  "missing singleValues drops c1",
);

const apiText = formatSingleChoiceUserText("有没有为了被认可而做？", "没有，我就是想做这件事本身");
assert.strictEqual(
  parseSingleChoiceUserText(apiText),
  "没有，我就是想做这件事本身",
  "parse choice label",
);
assert(
  formatUserChoice("没有，我就是想做这件事本身") === "您选择：「没有，我就是想做这件事本身」",
  "formatUserChoice",
);

const segs = buildQuadrantEchoSegments(3, [
  { type: "text", text: "a" },
  { type: "single", selected: "none", label: "没有，我就是想做这件事本身" },
  { type: "text", text: "b" },
]);
const c1Seg = segs.find((s) => s.cardField === "c1");
assert(c1Seg && c1Seg.choiceLabel === "没有，我就是想做这件事本身", "segment has choiceLabel");
assert(c1Seg.userText.includes("【用户选择】"), "segment keeps api userText for cache");

console.log("[reflectionArkApiMap.q3.test] OK");
