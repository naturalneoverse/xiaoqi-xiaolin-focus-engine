/**
 * 身体边界周报 · statsHash 与方案 D 事实 bullet（阶段 2）
 * 模型只能改写 bullet 事实，不得增删；bullet 不对用户暴露分值数字。
 */

const { SCORE_MAP } = require("../config/bodyFeedback");
const C = require("../config/bodyWeekArchiveConstants");
const bodyStats = require("./bodyStats");
const { sha256Hex } = require("./reflectionArkSha256");

const SLEEP_OPTIONS = bodyStats.SLEEP_OPTIONS;
const SPORT_OPTIONS = bodyStats.SPORT_OPTIONS;
const SIGNAL_OPTIONS = bodyStats.SIGNAL_OPTIONS;

const DIM_FIELDS = Object.freeze([
  { field: "sleep", domType: "SLEEP_DOM", weakType: "WEAK_SLEEP", options: SLEEP_OPTIONS },
  { field: "sport", domType: "SPORT_DOM", weakType: "WEAK_SPORT", options: SPORT_OPTIONS },
  { field: "signal", domType: "SIGNAL_DOM", weakType: "WEAK_SIGNAL", options: SIGNAL_OPTIONS },
]);

function countDaysWithValue(deduped, field, value) {
  return (deduped || []).filter((r) => r[field] === value).length;
}

function dominantLabel(records, field, options) {
  const counts = {};
  options.forEach((k) => {
    counts[k] = 0;
  });
  (records || []).forEach((r) => {
    const v = r[field];
    if (counts[v] !== undefined) counts[v] += 1;
  });
  let best = "";
  let max = -1;
  options.forEach((k) => {
    if (counts[k] > max) {
      max = counts[k];
      best = k;
    }
  });
  return max <= 0 ? "" : best;
}

function dimScore(record, dim) {
  const map = SCORE_MAP[dim];
  if (!map || !record) return 0;
  return map[record[dim]] || 0;
}

function average(nums) {
  const arr = (nums || []).filter((n) => typeof n === "number" && !Number.isNaN(n));
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function sortDedupedByDate(deduped) {
  return [...(deduped || [])].sort((a, b) => String(a.dateKey).localeCompare(String(b.dateKey)));
}

/**
 * 稳定指纹：末条 dedupe 后每日三维选项 + 档位 + 极值天数（不含用户可见均分数字）
 * @param {object} rep buildWeekReportPayload 结果
 * @returns {string}
 */
function buildBodyWeekStatsHash(rep) {
  const payload = buildStatsHashPayload(rep);
  return sha256Hex(JSON.stringify(payload));
}

/**
 * @param {object} rep
 * @returns {object}
 */
function buildStatsHashPayload(rep) {
  if (!rep || !rep.hasRecords) {
    return { v: 1, empty: true };
  }
  const deduped = sortDedupedByDate(rep.deduped);
  return {
    v: 1,
    dayCount: rep.dayCount,
    baseTitle: rep.baseStatusTitle || "",
    finalTitle: rep.finalStatusTitle || "",
    extremeTypeCount: rep.extremeTypeCount || 0,
    insDays: countDaysWithValue(deduped, "sleep", "睡不着"),
    ovDays: countDaysWithValue(deduped, "sport", "动过头了"),
    paDays: countDaysWithValue(deduped, "signal", "疼了"),
    days: deduped.map((r) => `${r.dateKey}|${r.sleep}|${r.sport}|${r.signal}`),
  };
}

/**
 * @param {object} rep
 * @param {object} [stats] buildBodyWeekStats（可选，阶段 7 TREND）
 * @returns {import("../config/bodyWeekArchiveConstants").BodyWeekBullet[]}
 */
const TREND_DIM_LABELS = Object.freeze({
  sleep: "睡眠",
  sport: "运动",
  signal: "身体信号",
});

const TREND_DIR_TEXT = Object.freeze({
  up: "较上周改善",
  down: "较上周偏弱",
  flat: "大体持平",
});

/**
 * @param {object} stats buildBodyWeekStats
 * @param {object|null} prevRep 上周 buildWeekReportPayload
 * @returns {{ type: string, text: string }|null}
 */
function buildTrendBullet(stats, prevRep) {
  if (!stats || !prevRep || !prevRep.hasRecords || (prevRep.dayCount || 0) < C.SPARSE_MIN_VALID_DAYS) {
    return null;
  }
  const parts = [];
  ["sleep", "sport", "signal"].forEach((key) => {
    const row = stats[key];
    const dir = row && row.trend_vs_prev;
    if (dir && dir !== "flat") {
      parts.push(`${TREND_DIM_LABELS[key]}${TREND_DIR_TEXT[dir]}`);
    }
  });
  const text =
    parts.length > 0
      ? `TREND: ${parts.join("；")}`
      : "TREND: 与上周相比，睡眠、运动与身体信号节奏大体持平";
  return { type: "TREND", text };
}

function buildBodyWeekBullets(rep, stats, prevRep) {
  if (!rep || !rep.hasRecords) return [];
  const dayCount = rep.dayCount || 0;
  if (dayCount < C.SPARSE_MIN_VALID_DAYS) return [];

  const deduped = rep.deduped || [];
  const bullets = [];

  const finalTitle = rep.finalStatusTitle || "";
  const baseTitle = rep.baseStatusTitle || "";
  const downgraded = finalTitle && baseTitle && finalTitle !== baseTitle;

  let bandText = `BAND: 展示档位${finalTitle}`;
  if (downgraded) {
    bandText += `（由${baseTitle}降一档，因本周极值类型≥2类）`;
  }
  bullets.push({ type: "BAND", text: bandText });

  bullets.push({ type: "DAYS", text: `DAYS: 有效记录${dayCount}天` });

  DIM_FIELDS.forEach(({ field, domType, options }) => {
    const dom = dominantLabel(deduped, field, options);
    if (dom) bullets.push({ type: domType, text: `${domType}: ${dom}（本周占比最高）` });
  });

  const ins = countDaysWithValue(deduped, "sleep", "睡不着");
  const ov = countDaysWithValue(deduped, "sport", "动过头了");
  const pa = countDaysWithValue(deduped, "signal", "疼了");
  const hasExtreme = ins > 0 || ov > 0 || pa > 0;

  if (ins > 0) {
    bullets.push({ type: "EXTREME_SLEEP", text: `EXTREME_SLEEP: 本周${ins}天睡不着` });
  }
  if (ov > 0) {
    bullets.push({ type: "EXTREME_SPORT", text: `EXTREME_SPORT: 本周${ov}天动过头了` });
  }
  if (pa > 0) {
    bullets.push({ type: "EXTREME_SIGNAL", text: `EXTREME_SIGNAL: 本周${pa}天疼了` });
  }
  if (!hasExtreme) {
    bullets.push({ type: "EXTREME_NONE", text: "EXTREME_NONE: 无失眠、无运动过载、无疼痛" });
  }

  if (downgraded) {
    bullets.push({
      type: "DOWNGRADE",
      text: `DOWNGRADE: 展示档位${finalTitle}；规则档位${baseTitle}；因极值降一档`,
    });
  }

  const weak = pickWeakestDimBullet(deduped);
  if (weak) bullets.push(weak);

  const trend = buildTrendBullet(stats, prevRep);
  if (trend) bullets.push(trend);

  return bullets.slice(0, 10);
}

/**
 * @param {object[]} deduped
 * @returns {{ type: string, text: string }|null}
 */
function pickWeakestDimBullet(deduped) {
  if (!deduped || deduped.length < 2) return null;
  const avgs = DIM_FIELDS.map(({ field }) => ({
    field,
    avg: average(deduped.map((r) => dimScore(r, field))),
  })).sort((a, b) => a.avg - b.avg);
  const weakest = avgs[0];
  const strongest = avgs[avgs.length - 1];
  if (strongest.avg - weakest.avg < 8) return null;

  const row = DIM_FIELDS.find((d) => d.field === weakest.field);
  if (!row) return null;
  const dom = dominantLabel(deduped, row.field, row.options);
  return {
    type: row.weakType,
    text: `${row.weakType}: ${row.field === "sleep" ? "睡眠" : row.field === "sport" ? "运动" : "身体信号"}维度相对偏低，多见${dom || "—"}`,
  };
}

/**
 * @param {import("../config/bodyWeekArchiveConstants").BodyWeekBullet[]} bullets
 * @returns {{ ok: boolean, errors: string[] }}
 */
function validateBulletsForUserCopy(bullets) {
  const errors = [];
  (bullets || []).forEach((b, i) => {
    const hit = C.findForbiddenUserCopyHits(b.text);
    if (!hit.ok) errors.push(`bullet_${i}:${hit.hits.join(",")}`);
    if (/\b\d{3}\b/.test(b.text)) errors.push(`bullet_${i}:suspicious_3digit`);
  });
  return { ok: errors.length === 0, errors };
}

module.exports = {
  buildBodyWeekStatsHash,
  buildStatsHashPayload,
  buildBodyWeekBullets,
  buildTrendBullet,
  validateBulletsForUserCopy,
  countDaysWithValue,
  dominantLabel,
};
