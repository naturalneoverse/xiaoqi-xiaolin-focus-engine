/**
 * R4 冒烟：小程序方舟读缓存单测
 * 运行：node miniprogram/utils/runReflectionArkQualityTests.js
 */
"use strict";

const { spawnSync } = require("child_process");
const path = require("path");

const file = path.join(__dirname, "reflectionArkReplyQuality.test.js");
const r = spawnSync(process.execPath, [file], { encoding: "utf8", cwd: __dirname });
if (r.stdout) process.stdout.write(r.stdout);
if (r.stderr) process.stderr.write(r.stderr);
if (r.status !== 0) {
  process.exit(r.status || 1);
}
