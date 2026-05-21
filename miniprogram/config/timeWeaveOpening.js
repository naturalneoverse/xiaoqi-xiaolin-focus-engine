/**
 * 时间编织报告 · 小麟固定开场（前端随机，不进云库）
 * 字数见 config/timeWeaveCopyLimits.js OPENING_CHAR_LENGTHS（含句号、含逗号）
 */

/** 与产品定稿一致；导出别名 xiaoLinOpening */
const xiaoLinOpening = [
  "小麟静静相伴，陪您看见自身成长模样。", // 18
  "日常步履皆有回响，小麟暖心伴您前行。", // 16（定稿表；当前文件请用 check 脚本核对）
  "岁月缓缓前行，小麟温柔相守。", // 12
  "步履不停陪伴不止，小麟与您一同遇见更好的自己。", // 22
];

const XIAOLIN_OPENING_LINES = xiaoLinOpening;

/** 随机取 1 句开场（每次调用独立随机） */
function pickOpeningLine() {
  const n = XIAOLIN_OPENING_LINES.length;
  if (!n) return "";
  const i = Math.floor(Math.random() * n);
  return XIAOLIN_OPENING_LINES[i] || XIAOLIN_OPENING_LINES[0];
}

module.exports = {
  xiaoLinOpening,
  XIAOLIN_OPENING_LINES,
  pickOpeningLine,
};
