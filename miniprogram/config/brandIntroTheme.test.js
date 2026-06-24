/**
 * 定稿文案校验：字词不可删改，仅允许按标点拆行
 */
const assert = require("assert");
const {
  BRAND_INTRO_STEPS,
  ACT_SOURCES,
  splitByPunctuation,
  dwellMsForLine,
  MIN_DWELL_MS,
  MS_PER_CHAR,
} = require("../config/brandIntroTheme");

const FULL_LIN = [
  "您心里装着那么多事，每一件都值得被看见。",
  "别急着赶路，我们先陪您停下来，坐一会儿。",
  "在这里，您的声音会被听见，您的感受会被接住，",
  "我们一直都在。",
].join("");

const FULL_QI = [
  "这是只属于您的\n私密思想花园。",
  "陪您追问三件事：为谁、为何、轻重缓急。",
  "每一次回答，都在为您的时光赋予\n独一无二的意义。让岁月凝结成您的作品，",
  "让每一次哲思复盘，都看见生命的厚度与连接。",
].join("");

const FULL_UNITY = "今天唯一要紧的事。把它安放好，心就定了。";

const linText = BRAND_INTRO_STEPS.filter((s) => s.speaker === "lin")
  .map((s) => s.text)
  .join("");
const qiText = BRAND_INTRO_STEPS.filter((s) => s.speaker === "qi")
  .map((s) => s.text)
  .join("");
const unityText = BRAND_INTRO_STEPS.filter((s) => s.speaker === "both")
  .map((s) => s.text)
  .join("");

assert.strictEqual(linText, FULL_LIN);
assert.strictEqual(qiText, FULL_QI);
assert.strictEqual(unityText, FULL_UNITY);
assert.ok(qiText.includes("哲思复盘"));
assert.strictEqual(BRAND_INTRO_STEPS.length, 22);

ACT_SOURCES.forEach(({ paragraphs }) => {
  paragraphs.forEach((para) => {
    assert.strictEqual(splitByPunctuation(para).join(""), para);
  });
});

assert.ok(dwellMsForLine("短句，") >= MIN_DWELL_MS);
assert.strictEqual(
  dwellMsForLine("心就定了。"),
  Math.max(MIN_DWELL_MS, Math.round(Array.from("心就定了。").length * MS_PER_CHAR)),
);

console.log("brandIntroTheme.test.js ok");
