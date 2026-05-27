"use strict";

const assert = require("assert");
const { isBatchCardRetryable } = require("./generateQuadrantBatch");
const { QUADRANT_Q2_ID } = require("./constants");

const fallbackRow = (errCode) => ({ ok: true, fallback: true, errCode });

assert.strictEqual(isBatchCardRetryable(fallbackRow("ARK_TIMEOUT"), 1), true, "q1 timeout retry");
assert.strictEqual(
  isBatchCardRetryable(fallbackRow("NO_TERMINAL_END"), 1),
  false,
  "q1 incomplete no batch retry",
);

assert.strictEqual(
  isBatchCardRetryable(fallbackRow("NO_TERMINAL_END"), QUADRANT_Q2_ID),
  true,
  "q2 incomplete batch retry",
);
assert.strictEqual(
  isBatchCardRetryable(fallbackRow("TRUNCATE_NO_SENTENCE_END"), QUADRANT_Q2_ID),
  true,
  "q2 truncate batch retry",
);
assert.strictEqual(
  isBatchCardRetryable(fallbackRow("REPLY_INCOMPLETE"), QUADRANT_Q2_ID),
  true,
  "q2 generic incomplete batch retry",
);

assert.strictEqual(
  isBatchCardRetryable({ ok: true, fallback: false, errCode: "" }, QUADRANT_Q2_ID),
  false,
  "success no retry",
);
assert.strictEqual(
  isBatchCardRetryable(fallbackRow("ARK_ENV_MISSING"), QUADRANT_Q2_ID),
  false,
  "q2 env missing no batch retry",
);

console.log("[generateQuadrantBatch.retry.test] OK (8 assertions)");
