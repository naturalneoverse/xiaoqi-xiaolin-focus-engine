/**
 * 将 64 组任务答题文案写入云数据库 task_quiz_copy（需在项目根目录配置云开发环境后执行）。
 * 用法：node scripts/seed-task-quiz-copy.cjs
 * 依赖：cloudfunctions/quickstartFunctions/taskQuiz.js 中的 buildSeedRecords
 */
const path = require("path");
const { buildSeedRecords, COLL } = require(path.join(
  __dirname,
  "../cloudfunctions/quickstartFunctions/taskQuiz.js",
));

console.log(
  `[seed-task-quiz-copy] 集合 ${COLL}，共 ${buildSeedRecords().length} 条。`,
);
console.log(
  "请在微信云开发控制台创建集合 task_quiz_copy，或使用云函数批量导入以下结构：",
);
console.log(JSON.stringify(buildSeedRecords().slice(0, 2), null, 2), "...");
console.log(
  "完整 JSON 可运行：node -e \"console.log(JSON.stringify(require('./cloudfunctions/quickstartFunctions/taskQuiz').buildSeedRecords()))\" > task_quiz_copy.json",
);
