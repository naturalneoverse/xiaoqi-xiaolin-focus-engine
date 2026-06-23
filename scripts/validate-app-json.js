/**
 * 校验 miniprogram/app.json 中易踩坑配置（本地/CI 可跑：node scripts/validate-app-json.js）
 */
const fs = require("fs");
const path = require("path");

const APP_JSON = path.join(__dirname, "../miniprogram/app.json");
const ALLOWED_REQUIRED_PRIVATE_INFOS = new Set([
  "chooseAddress",
  "chooseLocation",
  "choosePoi",
  "getFuzzyLocation",
  "getLocation",
  "onLocationChange",
  "startLocationUpdate",
  "startLocationUpdateBackground",
]);

const INVALID_IN_REQUIRED_PRIVATE_INFOS = new Set(["chooseImage", "chooseMedia"]);

function fail(msg) {
  console.error(`[validate-app-json] FAIL: ${msg}`);
  process.exit(1);
}

const raw = fs.readFileSync(APP_JSON, "utf8");
let json;
try {
  json = JSON.parse(raw);
} catch (e) {
  fail(`app.json 不是合法 JSON: ${e.message}`);
}

if (!json.__usePrivacyCheck__) {
  fail("使用相册/相机等隐私接口时须设置 __usePrivacyCheck__: true（勿用 requiredPrivateInfos 声明选图）");
}

const infos = Array.isArray(json.requiredPrivateInfos) ? json.requiredPrivateInfos : [];
infos.forEach((item, i) => {
  if (INVALID_IN_REQUIRED_PRIVATE_INFOS.has(item)) {
    fail(
      `requiredPrivateInfos[${i}]="${item}" 非法：选图接口不能写在此字段，应使用 __usePrivacyCheck__ + 后台隐私指引`,
    );
  }
  if (!ALLOWED_REQUIRED_PRIVATE_INFOS.has(item)) {
    fail(`requiredPrivateInfos[${i}]="${item}" 不在微信允许的位置类 API 列表中`);
  }
});

console.log("[validate-app-json] OK");
