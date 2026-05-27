/**
 * Q4 prompt 小麒幽默约束
 * 运行：node cloudfunctions/reflectionArk/q4Prompts.test.js
 */
"use strict";

const assert = require("assert");
const { buildQ4CardUserContent, getQ4PersonaSystem } = require("./q4Prompts");

assert(getQ4PersonaSystem().includes("幽默"), "humor hint in rules");

const c0 = buildQ4CardUserContent(
  "任务",
  "如果时间有限，今天最值得你亲自做的一件事是什么？",
  "先把报告发出去",
  "c0",
);
assert(c0.includes("【本题重心·c0】"), "c0 focus");
assert(c0.includes("先把报告"), "user text");

console.log("[q4Prompts.test] OK");
