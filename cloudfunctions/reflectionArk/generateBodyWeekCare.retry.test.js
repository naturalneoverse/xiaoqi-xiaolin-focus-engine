/**
 * 运行：node cloudfunctions/reflectionArk/generateBodyWeekCare.retry.test.js
 */
"use strict";

const assert = require("assert");
const {
  TRANSPORT_RETRY_CODES,
  VALIDATION_RETRY_CODES,
} = require("./generateBodyWeekCare");

assert(TRANSPORT_RETRY_CODES.has("DASHSCOPE_TIMEOUT"));
assert(VALIDATION_RETRY_CODES.has("EXTREME_NOT_IN_STATUS_DESC"));
assert(VALIDATION_RETRY_CODES.has("PARSE_JSON_FAILED"));

console.log("[generateBodyWeekCare.retry.test] OK");
