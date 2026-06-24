/**
 * 定稿文案校验：15 屏分屏与幕别 speaker
 */
const assert = require("assert");
const {
  BRAND_INTRO_STEPS,
  ACT_SOURCES,
  SKY_GRADIENT_CSS,
  splitByPunctuation,
  dwellMsForLine,
  MIN_DWELL_MS,
  MS_PER_CHAR,
} = require("../config/brandIntroTheme");

const FULL_LIN = [
  "您心里装着那么多事，\n每一件都值得被看见。",
  "别急着赶路，",
  "我们先陪您停下来，",
  "坐一会儿。",
  "在这里，",
  "您的声音会被听见，\n您的感受会被接住，",
  "我们一直都在。",
].join("");

const FULL_QI = [
  "这是只属于您的\n私密思想花园。",
  "陪您追问三件事：",
  "为谁\n为何\n轻重缓急",
  "每一次回答，\n都在为您的时光赋予\n独一无二的意义。",
  "让岁月凝结成您的作品，",
  "让每一次哲思复盘，\n都看见生命的厚度与连接。",
].join("");

const FULL_UNITY = ["今天唯一要紧的事：\n把它安放好", "心就安稳了~"].join("");

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
assert.strictEqual(BRAND_INTRO_STEPS.length, 15);

assert.strictEqual(ACT_SOURCES.length, 3);
assert.strictEqual(ACT_SOURCES[0].paragraphs.length, 7);
assert.strictEqual(ACT_SOURCES[1].paragraphs.length, 6);
assert.strictEqual(ACT_SOURCES[2].paragraphs.length, 2);

assert.ok(SKY_GRADIENT_CSS.includes("#184A72"));
assert.ok(SKY_GRADIENT_CSS.includes("#EFF7FD"));

assert.deepStrictEqual(splitByPunctuation("第一句，第二句。"), ["第一句，", "第二句。"]);

assert.ok(dwellMsForLine("短句，") >= MIN_DWELL_MS);
assert.strictEqual(
  dwellMsForLine("心就安稳了~"),
  Math.max(MIN_DWELL_MS, Math.round(Array.from("心就安稳了~").length * MS_PER_CHAR)),
);

console.log("brandIntroTheme.test.js ok");
