/**
 * Q2 S2：阶段 B 硬标记拆分
 * 运行：node cloudfunctions/reflectionArk/generateQuadrantQ2S2.test.js
 */
"use strict";

const assert = require("assert");
const {
  parseStageBMarkers,
  MARKER_C1,
  MARKER_C2,
} = require("./generateQuadrantQ2S2");

const validRaw = [
  "前言应忽略",
  MARKER_C1,
  "第一段回应正文。",
  MARKER_C2,
  "第二段回应正文。",
].join("\n");

const parsed = parseStageBMarkers(validRaw);
assert.strictEqual(parsed.ok, true, "valid markers");
assert.strictEqual(parsed.c1, "第一段回应正文。");
assert.strictEqual(parsed.c2, "第二段回应正文。");

const dupC1 = `${MARKER_C1}甲${MARKER_C1}乙${MARKER_C2}丙`;
const dup = parseStageBMarkers(dupC1);
assert.strictEqual(dup.ok, true, "dup c1");
assert.strictEqual(dup.c1, `甲${MARKER_C1}乙`, "first c1 to last c2");
assert.strictEqual(dup.c2, "丙", "last c2 segment");

const dupC2 = `${MARKER_C1}一${MARKER_C2}二${MARKER_C2}三`;
const dup2 = parseStageBMarkers(dupC2);
assert.strictEqual(dup2.ok, true, "dup c2");
assert.strictEqual(dup2.c1, `一${MARKER_C2}二`);
assert.strictEqual(dup2.c2, "三", "last c2 marker");

assert.strictEqual(parseStageBMarkers(`${MARKER_C1}仅一段`).ok, false, "missing c2");
assert.strictEqual(parseStageBMarkers(`${MARKER_C2}反序${MARKER_C1}`).ok, false, "wrong order");

const spaced = `=== c1 ===\n第一段。\n=== c2 ===\n第二段。`;
const spacedParsed = parseStageBMarkers(spaced);
assert.strictEqual(spacedParsed.ok, true, "spaced markers");
assert.strictEqual(spacedParsed.c1, "第一段。");

console.log("[generateQuadrantQ2S2.test] OK (11 assertions)");
