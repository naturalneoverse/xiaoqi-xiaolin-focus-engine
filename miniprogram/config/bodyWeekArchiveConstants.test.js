/**
 * 运行：node miniprogram/config/bodyWeekArchiveConstants.test.js
 */
"use strict";

const assert = require("assert");
const mp = require("./bodyWeekArchiveConstants");
const cloud = require("../../cloudfunctions/reflectionArk/bodyWeekCareConstants");

function assertCloudSync(field) {
  assert.strictEqual(mp[field], cloud[field], `cloud sync: ${field}`);
}

[
  "SPARSE_MIN_VALID_DAYS",
  "STATUS_DESC_MIN_CHARS",
  "STATUS_DESC_MAX_CHARS",
  "CARE_TEXT_MIN_CHARS",
  "CARE_TEXT_MAX_CHARS",
  "CARE_TEXT_HARD_MAX_CHARS",
].forEach(assertCloudSync);

assert.strictEqual(mp.FORBIDDEN_USER_COPY_RE.source, cloud.FORBIDDEN_USER_COPY_RE.source);
assert.strictEqual(mp.FORBIDDEN_SCORE_PHRASE_RE.source, cloud.FORBIDDEN_SCORE_PHRASE_RE.source);

assert.strictEqual(mp.findForbiddenUserCopyHits("本周得分不错").ok, false);
assert.strictEqual(mp.findForbiddenUserCopyHits("平均分在108分左右").ok, false);
assert.strictEqual(mp.findForbiddenUserCopyHits("身心满格，睡得香居多").ok, true);

const { STATUS_DESC_75 } = require("./bodyReportLayoutFixture");
const lenCheck = mp.checkCopyLength("statusDesc", STATUS_DESC_75);
assert(lenCheck.ok, lenCheck);
assert(lenCheck.chars >= mp.STATUS_DESC_MIN_CHARS && lenCheck.chars <= mp.STATUS_DESC_MAX_CHARS, lenCheck);

const care = "小麟看见：这周睡和信号都偏稳，运动略少一点；您已经照顾得很好，下周多走几分钟就够。";
const careLen = mp.checkCopyLength("careText", care);
assert(careLen.ok, careLen);
assert(careLen.chars <= mp.CARE_TEXT_HARD_MAX_CHARS, careLen);

console.log("[bodyWeekArchiveConstants.test] OK");
