/**
 * Q1 prompt 单选 userText 格式
 * 运行：node cloudfunctions/reflectionArk/q1Prompts.test.js
 */
"use strict";

const assert = require("assert");
const { buildQ1CardUserContent, getQ1PersonaSystem } = require("./q1Prompts");
const { isChoiceApiUserText } = require("./replyLengthPolicy");

const choiceText = buildQ1CardUserContent(
  "测试任务",
  "做这件事的时候，你在哪里？",
  "【题目】做这件事的时候，你在哪里？\n【用户选择】全心投入，忘了时间",
  "c1",
);

assert(choiceText.includes("【本题重心·c1】"), "c1 focus");
assert(choiceText.includes("全心投入"), "choice label in body");
assert(isChoiceApiUserText("【题目】x\n【用户选择】y"), "choice detect");

const c0 = buildQ1CardUserContent("任务", "这件事，和你想的一样吗？", "和预期不同", "c0");
assert(c0.includes("【本题重心·c0】"), "c0 focus");
assert(getQ1PersonaSystem().includes("观实"), "persona");

console.log("[q1Prompts.test] OK");
