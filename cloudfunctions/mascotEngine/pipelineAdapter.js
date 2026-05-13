/**
 * 将前端 / 将来 DB 的 payload 转成规则引擎使用的统一口径。
 * 主场景命名与小程序侧 stats 一致：body_daily | body_week | weekly_time | task_create
 * 同时兼容历史别名，便于逐步迁移。
 */

function adaptForPipeline(payload) {
  const p = payload || {};
  let ruleSceneType = p.scene || null;
  let ruleSubType = p.subType || null;
  const stats = p.stats != null ? p.stats : null;
  const rawData = p.rawData != null ? p.rawData : null;

  switch (p.scene) {
    case "dailyBodyReport": {
      const r = rawData || {};
      const field = r.field || r.source || "signal";
      const value = r.value || r.answer || "";
      ruleSceneType = "body_daily";
      ruleSubType = value ? `${field}_${value}` : null;
      break;
    }
    case "timeWeekly":
      ruleSceneType = "weekly_time";
      break;
    case "bodyWeekly":
      ruleSceneType = "body_week";
      break;
    default:
      break;
  }

  return {
    ruleSceneType,
    ruleSubType,
    stats,
    rawData,
  };
}

module.exports = {
  adaptForPipeline,
};
