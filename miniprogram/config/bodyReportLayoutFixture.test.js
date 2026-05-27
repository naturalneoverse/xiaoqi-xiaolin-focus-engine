/**
 * 运行：node miniprogram/config/bodyReportLayoutFixture.test.js
 */
"use strict";

const assert = require("assert");
const {
  getLayoutFixture,
  STATUS_DESC_75,
  CARE_TEXT_45,
  CARE_TEXT_55,
} = require("./bodyReportLayoutFixture");

const s = getLayoutFixture("1");
assert(s.meta.statusDescChars >= 70 && s.meta.statusDescChars <= 80, `statusDesc ${s.meta.statusDescChars} ~75`);
assert(s.meta.careTextChars >= 42 && s.meta.careTextChars <= 50, `care45 ${s.meta.careTextChars}`);
assert(s.extremeLine, "extreme on variant 1");

const v55 = getLayoutFixture("55");
assert(v55.meta.careTextChars >= 50 && v55.meta.careTextChars <= 58, `care55 ${v55.meta.careTextChars}`);

const v45 = getLayoutFixture("45");
assert(!v45.extremeLine, "no extreme on 45");

console.log("[bodyReportLayoutFixture.test] OK", {
  statusDesc: s.meta.statusDescChars,
  care45: getLayoutFixture("45").meta.careTextChars,
  care55: v55.meta.careTextChars,
});
