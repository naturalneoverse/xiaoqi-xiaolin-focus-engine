/**
 * 品牌引导页：定稿文案、天空渐变与 UI 参数
 */

const STORAGE_KEYS = require("./storageKeys");

const SKY_GRADIENT_STOPS = [
  { pos: 0, color: "#184A72" },
  { pos: 18, color: "#12598F" },
  { pos: 38, color: "#3A7CA8" },
  { pos: 58, color: "#9EC7E6" },
  { pos: 72, color: "#B7D6EA" },
  { pos: 86, color: "#DEEBF8" },
  { pos: 100, color: "#EFF7FD" },
];

const SKY_GRADIENT_CSS = `linear-gradient(180deg, ${SKY_GRADIENT_STOPS.map(
  (s) => `${s.color} ${s.pos}%`,
).join(", ")})`;

const UI = {
  textColor: "#EFF7FD",
  hint: "#B7D6EA",
  skip: "rgba(183, 214, 234, 0.92)",
  btnBg: "#12598F",
  btnText: "#FFFFFF",
  textTopRatio: 0.14,
  textBottomRatio: 0.5,
};

/** 定稿分屏（屏内换行用 \n）；共 15 屏，一屏一句轻触 */
const BRAND_INTRO_STEPS = [
  // 第一幕 · 小麟
  { act: 1, speaker: "lin", text: "您心里装着那么多事，\n每一件都值得被看见。" },
  { act: 1, speaker: "lin", text: "别急着赶路，" },
  { act: 1, speaker: "lin", text: "我们先陪您停下来，" },
  { act: 1, speaker: "lin", text: "坐一会儿。" },
  { act: 1, speaker: "lin", text: "在这里，" },
  { act: 1, speaker: "lin", text: "您的声音会被听见，\n您的感受会被接住，" },
  { act: 1, speaker: "lin", text: "我们一直都在。" },
  // 第二幕 · 小麒
  { act: 2, speaker: "qi", text: "这是只属于您的\n私密思想花园。" },
  { act: 2, speaker: "qi", text: "陪您追问三件事：" },
  { act: 2, speaker: "qi", text: "为谁\n为何\n轻重缓急" },
  { act: 2, speaker: "qi", text: "每一次回答，\n都在为您的时光赋予\n独一无二的意义。" },
  { act: 2, speaker: "qi", text: "让岁月凝结成您的作品，" },
  { act: 2, speaker: "qi", text: "让每一次哲思复盘，\n都看见生命的厚度与连接。" },
  // 第三幕 · 双人
  { act: 3, speaker: "both", text: "今天唯一要紧的事：\n把它安放好" },
  { act: 3, speaker: "both", text: "心就安稳了~" },
];

/** 按幕归档（供测试与导出） */
const ACT_SOURCES = [
  {
    act: 1,
    speaker: "lin",
    paragraphs: BRAND_INTRO_STEPS.filter((s) => s.act === 1).map((s) => s.text),
  },
  {
    act: 2,
    speaker: "qi",
    paragraphs: BRAND_INTRO_STEPS.filter((s) => s.act === 2).map((s) => s.text),
  },
  {
    act: 3,
    speaker: "both",
    paragraphs: BRAND_INTRO_STEPS.filter((s) => s.act === 3).map((s) => s.text),
  },
];

const PUNCT_TAIL_RE = /(?<=[，。：；、？！])/;

function splitByPunctuation(paragraph) {
  return String(paragraph || "")
    .split(PUNCT_TAIL_RE)
    .filter((s) => s.length > 0);
}

function buildBrandIntroSteps() {
  return BRAND_INTRO_STEPS.slice();
}

const CTA_TEXT = "我要记录今日要事";
const HINT_TEXT = "轻触跳下一句";
const SKIP_TEXT = "跳过";

/** 魔法浮现 */
const MAGIC_IN_MS = 680;
/** 魔法消散（Canvas 微光颗粒消融） */
const MAGIC_OUT_MS = 2400;
const ACT_GAP_MS = 650;
const MIN_DWELL_MS = 2200;
const MS_PER_CHAR = 220;

function dwellMsForLine(text) {
  const n = Array.from(String(text || "")).length;
  return Math.max(MIN_DWELL_MS, Math.round(n * MS_PER_CHAR));
}

module.exports = {
  STORAGE_KEY: STORAGE_KEYS.BRAND_INTRO_SEEN,
  SKY_GRADIENT_CSS,
  SKY_GRADIENT_STOPS,
  UI,
  ACT_SOURCES,
  splitByPunctuation,
  buildBrandIntroSteps,
  BRAND_INTRO_STEPS,
  CTA_TEXT,
  HINT_TEXT,
  SKIP_TEXT,
  MAGIC_IN_MS,
  MAGIC_OUT_MS,
  ACT_GAP_MS,
  MIN_DWELL_MS,
  MS_PER_CHAR,
  dwellMsForLine,
};
