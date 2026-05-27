/**
 * 运行：node cloudfunctions/reflectionArk/bodyWeekCareConstants.test.js
 */
"use strict";

const assert = require("assert");
const C = require("./bodyWeekCareConstants");

assert.strictEqual(C.SPARSE_MIN_VALID_DAYS, 2);
assert.strictEqual(C.STATUS_DESC_MIN_CHARS, 50);
assert.strictEqual(C.CARE_TEXT_HARD_MAX_CHARS, 55);

const hit = C.findForbiddenUserCopyHits("周均108");
assert(!hit.ok);

console.log("[bodyWeekCareConstants.test] OK");
