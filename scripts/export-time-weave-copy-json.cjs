/**
 * 生成云库导入用 timeWeaveCopy 种子：node scripts/export-time-weave-copy-json.cjs
 */
const fs = require("fs");
const path = require("path");
const { TIME_WEAVE_COPY } = require("../miniprogram/config/timeWeaveMascotCopy");
const { countCopyChars, BODY_CHAR_LENGTH_BY_KEY } = require("../miniprogram/config/timeWeaveCopyLimits");

const rows = [];
let warn = 0;
Object.keys(TIME_WEAVE_COPY).forEach((copyKey) => {
  const target = BODY_CHAR_LENGTH_BY_KEY[copyKey];
  TIME_WEAVE_COPY[copyKey].forEach((text, i) => {
    const n = countCopyChars(text);
    if (target && n !== target) {
      console.warn(`[字数] ${copyKey} #${i + 1}: ${n} ≠ ${target}  ${text}`);
      warn += 1;
    }
    rows.push({
      copyKey,
      lineIndex: i + 1,
      text,
    });
  });
});
if (warn) console.warn(`共 ${warn} 条正文未达定稿字数，润色后重跑本脚本`);

const out = path.join(__dirname, "timeWeaveCopy.seed.json");
fs.writeFileSync(out, JSON.stringify(rows, null, 2), "utf8");
console.log("Wrote", rows.length, "records to", out);
