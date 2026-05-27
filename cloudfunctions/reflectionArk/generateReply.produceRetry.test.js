"use strict";

const assert = require("assert");
const {
  shouldProduceRetryOnce,
  resolveProduceMaxAttempts,
} = require("./generateReply");
const { QUADRANT_Q2_ID } = require("./constants");

assert.strictEqual(shouldProduceRetryOnce(undefined, 1), false, "q1 no retry without flag");
assert.strictEqual(resolveProduceMaxAttempts(undefined, 1), 1, "q1 max 1");

assert.strictEqual(shouldProduceRetryOnce({ allowRetryOnce: true }, 1), true, "flag enables retry");
assert.strictEqual(resolveProduceMaxAttempts({ allowRetryOnce: true }, 3), 2, "flag max 2");

assert.strictEqual(
  shouldProduceRetryOnce({ allowRetryOnce: false }, QUADRANT_Q2_ID),
  true,
  "q2 retries without allowRetryOnce",
);
assert.strictEqual(
  resolveProduceMaxAttempts({ allowRetryOnce: false }, QUADRANT_Q2_ID),
  2,
  "q2 max 2",
);
assert.strictEqual(
  shouldProduceRetryOnce(undefined, QUADRANT_Q2_ID),
  true,
  "q2 retries with no options",
);

console.log("[generateReply.produceRetry.test] OK (8 assertions)");
