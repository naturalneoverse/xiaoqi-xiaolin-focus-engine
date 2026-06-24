/**
 * 品牌引导：分包三幕背景图必须存在
 */
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { BRAND_INTRO_STEPS } = require("./brandIntroTheme");
const { ACT_FILES } = require("../subpkg/brand-intro/backgrounds");

const MIN_BYTES = 4096;
const SUBPKG_INTRO = path.join(__dirname, "..", "subpkg", "brand-intro");

Object.entries(ACT_FILES).forEach(([act, file]) => {
  assert.ok(String(file).endsWith(".jpg"), file);
  const disk = path.join(SUBPKG_INTRO, file);
  assert.ok(fs.existsSync(disk), `missing ${disk}`);
  assert.ok(fs.statSync(disk).size >= MIN_BYTES, `${file} too small`);
});

const acts = new Set(BRAND_INTRO_STEPS.map((s) => s.act));
assert.deepStrictEqual([...acts].sort(), [1, 2, 3]);

console.log("brandIntroAssets.test.js ok");
