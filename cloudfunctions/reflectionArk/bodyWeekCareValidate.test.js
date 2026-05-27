/**
 * 运行：node cloudfunctions/reflectionArk/bodyWeekCareValidate.test.js
 */
"use strict";

const assert = require("assert");
const {
  validateGenerateBodyWeekCareParams,
  extractJsonObject,
  assessBodyWeekCareOutput,
} = require("./bodyWeekCareValidate");
const C = require("./bodyWeekCareConstants");

const bullets = [
  { type: "EXTREME_SLEEP", text: "EXTREME_SLEEP: 本周1天睡不着" },
  { type: "BAND", text: "BAND: 展示档位状态平稳" },
];

const v = validateGenerateBodyWeekCareParams({
  bullets,
  weekKey: "2025-05-19",
  dayCount: 5,
  finalStatusTitle: "状态平稳",
});
assert(v.ok, v.errCode);

assert.strictEqual(validateGenerateBodyWeekCareParams({ bullets: [], weekKey: "2025-05-19", dayCount: 5, finalStatusTitle: "x" }).ok, false);
assert.strictEqual(validateGenerateBodyWeekCareParams({ bullets, weekKey: "bad", dayCount: 5, finalStatusTitle: "x" }).errCode, "INVALID_WEEK_KEY");
assert.strictEqual(validateGenerateBodyWeekCareParams({ bullets, weekKey: "2025-05-19", dayCount: 1, finalStatusTitle: "x" }).errCode, "SPARSE_WEEK");

const statusDesc =
  "这周睡眠多数以睡得香为主，运动以动了点居多，身体信号多为没事；整体节奏在状态平稳这一档，有1天睡不着、1天疼了，具体请看上方三张图。";
const careText =
  "小麟看见：这周睡和信号都偏稳，运动略少一点；您已经照顾得很好，下周若想再进一步，每天多走几分钟就够。";

const parsed = extractJsonObject(
  '说明\n```json\n{"statusDesc":"' + statusDesc + '","careText":"' + careText + '"}\n```',
);
const assessed = assessBodyWeekCareOutput(bullets, parsed);
assert(assessed.ok, assessed.errCode);

const statusDescPlain =
  "这周睡眠多数以睡得香为主，运动以动了点居多，身体信号多为没事；整体在状态平稳这一档，没有明显波动，具体分布请看上方三张图。";
const noExtreme = assessBodyWeekCareOutput(
  [{ type: "EXTREME_SLEEP", text: "EXTREME_SLEEP: 本周1天睡不着" }],
  { statusDesc: statusDescPlain, careText },
);
assert.strictEqual(noExtreme.errCode, "EXTREME_NOT_IN_STATUS_DESC");

const forbidden = assessBodyWeekCareOutput([], {
  statusDesc:
    "本周得分很高，睡眠以睡得香为主，运动以动了点为主，身体信号多为没事；整体尚可，请继续观察上方三张分布图。",
  careText,
});
assert.strictEqual(forbidden.errCode, "FORBIDDEN_STATUS_DESC");

const repeat = assessBodyWeekCareOutput([], { statusDesc, careText: statusDesc.slice(0, 40) });
assert.strictEqual(repeat.errCode, "CARE_TEXT_REPEATS_STATUS");

assert(C.checkCopyLength("careText", careText).ok);

console.log("[bodyWeekCareValidate.test] OK");
