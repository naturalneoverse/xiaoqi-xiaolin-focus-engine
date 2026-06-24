/**
 * 任务时间戳：冲突合并与增量同步共用，避免 cloudDataSync / syncConflict 各算一套。
 */

function parseCreatedToMs(taskOrRecord) {
  const s = String((taskOrRecord && (taskOrRecord.createdAt || taskOrRecord.timeText)) || "")
    .trim()
    .replace(/\//g, "-");
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return 0;
  const t = new Date(+m[1], +m[2] - 1, +m[3], m[4] != null ? +m[4] : 0, m[5] != null ? +m[5] : 0, 0, 0);
  const ms = t.getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/** 用于与 lastSync* 严格大于比较：优先 updatedAt，否则回退 createdAt 解析 */
function getTaskEffectiveMs(task) {
  if (task && Number.isFinite(Number(task.updatedAt)) && Number(task.updatedAt) > 0) {
    return Number(task.updatedAt);
  }
  return parseCreatedToMs(task) || 0;
}

function getTaskServerMs(task) {
  if (!task) return 0;
  const s = Number(task.serverUpdatedAtMs);
  if (Number.isFinite(s) && s > 0) return s;
  return getTaskEffectiveMs(task);
}

module.exports = {
  parseCreatedToMs,
  getTaskEffectiveMs,
  getTaskServerMs,
};
