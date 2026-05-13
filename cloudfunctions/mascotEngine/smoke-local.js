/**
 * 本地冒烟（不连微信云）：node smoke-local.js
 * 用于确认 pipeline 返回的 text；云端日志需在开发者工具部署后看「云函数日志」。
 */
/* eslint-disable no-console */
const { runMascotPipeline } = require("./orchestrate");

const cases = [
  { name: "body_daily sleep", event: { scene: "body_daily", subType: "sleep_睡得香" } },
  { name: "alias dailyBodyReport", event: { scene: "dailyBodyReport", rawData: { field: "sleep", value: "睡得香" } } },
  { name: "weekly_time neutral", event: { scene: "weekly_time" } },
  {
    name: "body_week insufficient_data",
    event: { scene: "body_week", stats: { hits: ["insufficient_data"] } },
  },
  { name: "body_week no hit neutral", event: { scene: "body_week", stats: { hits: [] } } },
  {
    name: "weekly_time moment_high",
    event: { scene: "weekly_time", stats: { hits: ["moment_high"] } },
  },
  {
    name: "weekly_time deep_work_low",
    event: { scene: "weekly_time", stats: { hits: ["deep_work_low"] } },
  },
  { name: "weekly_time no hit neutral", event: { scene: "weekly_time", stats: { hits: [] } } },
];

cases.forEach(({ name, event }) => {
  const r = runMascotPipeline(event);
  console.log("---", name, "---");
  console.log(JSON.stringify({ ok: r.ok, text: r.text, adapted: r.adapted }, null, 2));
});
