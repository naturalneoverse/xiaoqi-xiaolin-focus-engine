/**
 * 将云数据库 reflection_quadrants 文档聚合成 ReflectionRecord[]（与云函数 aggregate 对齐）
 */
const { QUADRANT_IDS, isValidQuadrantId } = require("../config/reflectionRecordSchema");

function normalizeCardResponses(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const type = item.type != null ? String(item.type) : "";
      const out = { type };
      if (item.text != null) out.text = String(item.text);
      if (item.selected != null) {
        out.selected = Array.isArray(item.selected)
          ? item.selected.map(String)
          : String(item.selected);
      }
      if (item.label != null) out.label = String(item.label);
      if (item.experience != null) out.experience = String(item.experience);
      if (item.feeling != null) out.feeling = String(item.feeling);
      if (item.decision != null) out.decision = String(item.decision);
      return out;
    })
    .filter(Boolean);
}

/**
 * @param {object[]} docs 云库文档（含 taskId、quadrantId、cardResponses 等）
 * @returns {object[]}
 */
function aggregateQuadrantDocsToRecords(docs) {
  const byTask = Object.create(null);
  (docs || []).forEach((doc) => {
    if (!doc || doc.status === "deleted") return;
    const taskId = String(doc.taskId || "").trim();
    const qid = Number(doc.quadrantId);
    if (!taskId || !isValidQuadrantId(qid)) return;

    let rec = byTask[taskId];
    if (!rec) {
      rec = {
        taskId,
        taskTitle: String(doc.taskTitle || "未命名任务"),
        quadrants: {},
        createdAt: Number(doc.recordCreatedAt) || Number(doc.completedAtMs) || 0,
        updatedAt: 0,
        latestCompletedAt: "",
        latestCompletedAtMs: 0,
      };
      byTask[taskId] = rec;
    }

    const recordUpdatedAt = Number(doc.recordUpdatedAt) || Number(doc.completedAtMs) || 0;
    if (recordUpdatedAt > rec.updatedAt) rec.updatedAt = recordUpdatedAt;
    const recordCreatedAt = Number(doc.recordCreatedAt) || Number(doc.completedAtMs) || 0;
    if (!rec.createdAt || recordCreatedAt < rec.createdAt) rec.createdAt = recordCreatedAt;

    const completedAtMs = Number(doc.completedAtMs) || 0;
    if (completedAtMs >= rec.latestCompletedAtMs) {
      rec.latestCompletedAtMs = completedAtMs;
      rec.latestCompletedAt =
        doc.latestCompletedAt != null
          ? String(doc.latestCompletedAt)
          : String(doc.completedAt || "");
    }

    const serverMs = Number(doc.serverUpdatedAtMs) || 0;
    rec.quadrants[String(qid)] = {
      cardResponses: normalizeCardResponses(doc.cardResponses),
      completedAt: doc.completedAt != null ? String(doc.completedAt) : "",
      completedAtMs,
      serverUpdatedAtMs: serverMs,
    };
  });

  return Object.keys(byTask)
    .map((k) => byTask[k])
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

module.exports = {
  aggregateQuadrantDocsToRecords,
  QUADRANT_IDS,
};
