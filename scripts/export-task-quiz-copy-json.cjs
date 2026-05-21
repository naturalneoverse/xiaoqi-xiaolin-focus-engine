const fs = require("fs");
const path = require("path");
const { buildSeedRecords } = require(path.join(
  __dirname,
  "../cloudfunctions/quickstartFunctions/taskQuiz.js",
));

const outPath = path.join(__dirname, "task_quiz_copy.seed.json");
const records = buildSeedRecords();
fs.writeFileSync(outPath, JSON.stringify(records, null, 2), "utf8");
console.log(`Wrote ${records.length} records to ${outPath}`);
console.log("Import into WeChat cloud collection: task_quiz_copy (field: code, closing, insight)");
