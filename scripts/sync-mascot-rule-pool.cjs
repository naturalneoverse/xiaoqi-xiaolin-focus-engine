/**
 * 将 miniprogram/utils/mascotRulePool.js 同步到各云函数目录内的 packages/mascot-rule-pool/index.js。
 * 云函数通过 require("./packages/mascot-rule-pool") 加载。
 *
 * 用法：在项目根目录执行  node scripts/sync-mascot-rule-pool.cjs
 */
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const srcFile = path.join(root, "miniprogram", "utils", "mascotRulePool.js");
const targets = [
  path.join(root, "cloudfunctions", "mascotEngine", "packages", "mascot-rule-pool"),
  path.join(root, "cloudfunctions", "quickstartFunctions", "packages", "mascot-rule-pool"),
];

if (!fs.existsSync(srcFile)) {
  console.error("Missing source file:", srcFile);
  process.exit(1);
}

const body = fs.readFileSync(srcFile, "utf8");

targets.forEach((destDir) => {
  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(path.join(destDir, "index.js"), body);
  console.log("synced ->", path.relative(root, path.join(destDir, "index.js")));
});
