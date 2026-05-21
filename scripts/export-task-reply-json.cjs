/**
 * 生成 taskReply 集合批量导入 JSON（64 条）
 * 字段：code, fullPrefix, reply, type1Name, type2Name, type3Name
 * 运行：node scripts/export-task-reply-json.cjs
 */
const fs = require("fs");
const path = require("path");
const {
  TASK_QUIZ_FIXED_INTRO,
  buildFallbackClosing,
  buildFallbackInsight,
} = require(path.join(__dirname, "../cloudfunctions/quickstartFunctions/taskQuiz.js"));

const PRIORITY_TITLES = ["", "重要且紧急", "重要不紧急", "紧急不重要", "不重要不紧急"];
const CIRCLE_TITLES = ["", "自己", "至亲挚友", "外缘", "不二"];
const LAYER_TITLES = ["", "生计", "职责", "真我", "合一"];

const records = [];
for (let p = 1; p <= 4; p++) {
  for (let c = 1; c <= 4; c++) {
    for (let l = 1; l <= 4; l++) {
      const code = `${p}${c}${l}`;
      const type1Name = PRIORITY_TITLES[p];
      const type2Name = CIRCLE_TITLES[c];
      const type3Name = LAYER_TITLES[l];
      records.push({
        code,
        fullPrefix: TASK_QUIZ_FIXED_INTRO,
        reply: buildFallbackClosing(code),
        type1Name,
        type2Name,
        type3Name,
      });
    }
  }
}

const outPath = path.join(__dirname, "taskReply.seed.json");
fs.writeFileSync(outPath, JSON.stringify(records, null, 2), "utf8");
console.log(`Wrote ${records.length} records to ${outPath}`);
console.log("Import into cloud collection: taskReply");
