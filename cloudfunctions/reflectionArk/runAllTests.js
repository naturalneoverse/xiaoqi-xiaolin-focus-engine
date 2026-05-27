/**
 * 运行 reflectionArk 全部单测（P8 + R4 Q1·c2）
 * 运行：node cloudfunctions/reflectionArk/runAllTests.js
 */
"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

const tests = [
  "replyCompleteness.test.js",
  "openingCheck.test.js",
  "q2Patch.test.js",
  "q1c2Terminal.test.js",
  "q1c2GenerateReply.test.js",
  "generateReply.produceRetry.test.js",
  "generateQuadrantBatch.retry.test.js",
  "generateQuadrantQ2S2.test.js",
  "q2Prompts.test.js",
  "q3Prompts.test.js",
  "q1Prompts.test.js",
  "q4Prompts.test.js",
  "bodyWeekCareConstants.test.js",
  "bodyWeekCareValidate.test.js",
  "generateBodyWeekCare.retry.test.js",
];

let failed = 0;
tests.forEach((file) => {
  const full = path.join(__dirname, file);
  const r = spawnSync(process.execPath, [full], { encoding: "utf8", cwd: __dirname });
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.stderr) process.stderr.write(r.stderr);
  if (r.status !== 0) {
    failed += 1;
    console.error(`[runAllTests] FAILED: ${file} (exit ${r.status})`);
  }
});

if (failed > 0) {
  console.error(`[runAllTests] ${failed}/${tests.length} failed`);
  process.exit(1);
}
console.log(`[runAllTests] OK (${tests.length} files)`);
