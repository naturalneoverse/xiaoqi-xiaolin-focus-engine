/**
 * 哲思复盘本地存储结构（Step 6）
 *
 * Storage key: reflection_records（见 storageKeys.REFLECTION_RECORDS）
 * 存储形态: ReflectionRecord[]，按 taskId 唯一，最新更新排在数组前部（Step 7 写入时维护）
 *
 * ReflectionRecord {
 *   taskId: string
 *   taskTitle: string
 *   quadrants: {
 *     "1" | "2" | "3" | "4": ReflectionQuadrantEntry
 *   }
 *   createdAt: number          // 首次复盘毫秒时间戳
 *   updatedAt: number          // 最近一次写入毫秒时间戳
 *   latestCompletedAt: string  // 展示用，如「2026年5月18日 09:15」
 *   latestCompletedAtMs: number
 * }
 *
 * ReflectionQuadrantEntry {
 *   cardResponses: CardResponseItem[]
 *   completedAt: string       // 该象限提交时间（展示）
 *   completedAtMs: number
 * }
 *
 * CardResponseItem（按象限题型不同，见各 Step 题型实现）:
 *   { type: "text", text: string }
 *   { type: "single", selected: string, label: string }
 *   { type: "multi", selected: string[], experience?: string, feeling?: string, decision?: string }
 */

const QUADRANT_IDS = [1, 2, 3, 4];

function isValidQuadrantId(id) {
  const n = Number(id);
  return QUADRANT_IDS.includes(n);
}

function formatCompletedAt(date) {
  const d = date instanceof Date ? date : new Date(date || Date.now());
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}年${m}月${day}日 ${hh}:${mm}`;
}

function createEmptyQuadrantsMap() {
  return {};
}

/**
 * @param {string} taskId
 * @param {string} [taskTitle]
 * @returns {ReflectionRecord}
 */
function createEmptyRecord(taskId, taskTitle) {
  const now = Date.now();
  return {
    taskId: String(taskId || ""),
    taskTitle: String(taskTitle || "未命名任务"),
    quadrants: createEmptyQuadrantsMap(),
    createdAt: now,
    updatedAt: now,
    latestCompletedAt: "",
    latestCompletedAtMs: 0,
  };
}

/**
 * @param {unknown} raw
 * @returns {ReflectionRecord|null}
 */
function normalizeRecord(raw) {
  if (!raw || typeof raw !== "object") return null;
  const r = raw;
  if (!r.taskId || typeof r.taskId !== "string") return null;

  const quadrants = {};
  if (r.quadrants && typeof r.quadrants === "object") {
    QUADRANT_IDS.forEach((id) => {
      const key = String(id);
      const entry = r.quadrants[key];
      if (!entry || typeof entry !== "object") return;
      const cardResponses = Array.isArray(entry.cardResponses) ? entry.cardResponses : [];
      quadrants[key] = {
        cardResponses,
        completedAt: typeof entry.completedAt === "string" ? entry.completedAt : "",
        completedAtMs: Number(entry.completedAtMs) || 0,
      };
    });
  }

  return {
    taskId: r.taskId,
    taskTitle: typeof r.taskTitle === "string" ? r.taskTitle : "未命名任务",
    quadrants,
    createdAt: Number(r.createdAt) || Date.now(),
    updatedAt: Number(r.updatedAt) || Date.now(),
    latestCompletedAt: typeof r.latestCompletedAt === "string" ? r.latestCompletedAt : "",
    latestCompletedAtMs: Number(r.latestCompletedAtMs) || 0,
  };
}

/**
 * @param {unknown} raw
 * @returns {ReflectionRecord[]}
 */
function normalizeRecordList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeRecord).filter(Boolean);
}

module.exports = {
  QUADRANT_IDS,
  isValidQuadrantId,
  formatCompletedAt,
  createEmptyQuadrantsMap,
  createEmptyRecord,
  normalizeRecord,
  normalizeRecordList,
};
