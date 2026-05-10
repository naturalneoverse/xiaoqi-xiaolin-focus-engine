/**
 * 身体边界：按天取末条、周/近七日聚合、极值与状态降级（与 config/bodyFeedback 分值表一致）
 */
const { getRecordScore, getWeekStatus, SCORE_MAP, WEEK_STATUS_RULES } = require("../config/bodyFeedback");

const STATUS_ORDER = ["身心满格", "状态平稳", "轻微失衡", "需要调整"];

function parseLooseDateTime(str) {
  if (!str) return null;
  const s = String(str).trim().replace(/\//g, "-");
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return null;
  const y = +m[1];
  const mo = +m[2] - 1;
  const day = +m[3];
  const hh = m[4] != null ? +m[4] : 12;
  const mm = m[5] != null ? +m[5] : 0;
  return new Date(y, mo, day, hh, mm, 0, 0);
}

function recordTimeMs(r) {
  const t = parseLooseDateTime(r.createdAt);
  if (t && !Number.isNaN(t.getTime())) return t.getTime();
  const d = parseLooseDateTime(`${r.dateKey}T12:00`);
  return d ? d.getTime() : 0;
}

/** 同一天多条时保留 createdAt 最晚的一条 */
function pickLastRecordPerDay(records) {
  const map = new Map();
  (records || []).forEach((r) => {
    if (!r || !r.dateKey) return;
    const prev = map.get(r.dateKey);
    if (!prev) {
      map.set(r.dateKey, r);
      return;
    }
    if (recordTimeMs(r) >= recordTimeMs(prev)) map.set(r.dateKey, r);
  });
  return Array.from(map.values());
}

function parseDateKeyToDate(dateKey) {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const d = new Date(`${dateKey}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function filterRecordsInRange(records, start, end) {
  return (records || []).filter((item) => {
    const d = parseDateKeyToDate(item && item.dateKey);
    return d && d >= start && d <= end;
  });
}

function getIsoWeekMondayFromDate(date) {
  const dt = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = dt.getDay();
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  dt.setDate(dt.getDate() - daysFromMonday);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function getWeekRangeContaining(date) {
  const mon = getIsoWeekMondayFromDate(date);
  const end = new Date(mon);
  end.setDate(mon.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start: mon, end };
}

/** 含今天共 7 天：从今天往前 6 天，本地 0 点边界 */
function getLast7DayRange(now) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  return { start, end };
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

/** 近七日：睡眠均分 → 状态词（10–17 欠眠 / 不适类低段对齐） */
function labelSleep7Day(avg) {
  if (avg >= 38) return "踏实";
  if (avg >= 28) return "安稳";
  if (avg >= 18) return "偏浅";
  return "欠眠";
}

function labelSport7Day(avg) {
  if (avg >= 38) return "充沛";
  if (avg >= 28) return "活跃";
  if (avg >= 18) return "适度";
  return "偏少";
}

function labelSignal7Day(avg) {
  if (avg >= 38) return "通畅";
  if (avg >= 28) return "平稳";
  if (avg >= 18) return "偏累";
  return "不适";
}

function barWidthFromAvg(avg) {
  const clamped = Math.max(10, Math.min(40, avg || 10));
  const pct = Math.round(((clamped - 10) / 30) * 100);
  return Math.max(8, Math.min(100, pct));
}

/** 极值类型种数（各最多算 1）：睡不着 / 动过头了 / 疼了 */
function countExtremeTypesInRecords(deduped) {
  let n = 0;
  const list = deduped || [];
  if (list.some((r) => r.sleep === "睡不着")) n += 1;
  if (list.some((r) => r.sport === "动过头了")) n += 1;
  if (list.some((r) => r.signal === "疼了")) n += 1;
  return n;
}

function countDaysWithValue(deduped, field, value) {
  return (deduped || []).filter((r) => r[field] === value).length;
}

/** 触底修正：极值类型 ≥2 时降一级；已是「需要调整」则不再降 */
function applyDowngradeStatus(baseTitle, extremeTypeCount) {
  if (extremeTypeCount < 2) return baseTitle;
  const idx = STATUS_ORDER.indexOf(baseTitle);
  if (idx < 0) return baseTitle;
  if (idx >= STATUS_ORDER.length - 1) return baseTitle;
  return STATUS_ORDER[idx + 1];
}

function statusDescForTitle(title) {
  const rule = WEEK_STATUS_RULES.find((r) => r.title === title);
  return rule ? rule.desc : "";
}

function buildWeekExtremeLine(deduped) {
  const parts = [];
  const ins = countDaysWithValue(deduped, "sleep", "睡不着");
  const ov = countDaysWithValue(deduped, "sport", "动过头了");
  const pa = countDaysWithValue(deduped, "signal", "疼了");
  if (ins) parts.push(`本周有过${ins}天失眠`);
  if (ov) parts.push(`有过${ov}天过载`);
  if (pa) parts.push(`有过${pa}天疼痛`);
  if (!parts.length) return "";
  return `⚠️ ${parts.join(" · ")}`;
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
  let best = options[0];
  let max = -1;
  options.forEach((k) => {
    if (counts[k] > max) {
      max = counts[k];
      best = k;
    }
  });
  return max <= 0 ? "" : best;
}

const SLEEP_OPTIONS = ["睡得香", "做梦了", "睡不实", "睡不着"];
const SPORT_OPTIONS = ["动够了", "动了点", "没咋动", "动过头了"];
const SIGNAL_OPTIONS = ["没事", "有劲", "累了", "疼了"];

function buildSleepNarrative(deduped) {
  const ins = countDaysWithValue(deduped, "sleep", "睡不着");
  const dom = dominantLabel(deduped, "sleep", SLEEP_OPTIONS);
  if (ins) {
    const rest = deduped.length - ins;
    return rest > 0 ? `大多${dom ? `${dom}为主` : "有记录"}，有${ins}天失眠信号。` : `本周睡眠以失眠信号为主，共${ins}天。`;
  }
  return "本周有睡眠记录，继续保持觉察。";
}

function buildSportNarrative(deduped) {
  const ov = countDaysWithValue(deduped, "sport", "动过头了");
  if (ov) {
    const dom = dominantLabel(deduped, "sport", SPORT_OPTIONS);
    return `大多${dom ? `以「${dom}」为主` : "有记录"}，有${ov}天运动过载，记得留白恢复。`;
  }
  return "本周有运动记录，量力而行就好。";
}

function buildSignalNarrative(deduped) {
  const pa = countDaysWithValue(deduped, "signal", "疼了");
  if (pa) {
    const dom = dominantLabel(deduped, "signal", SIGNAL_OPTIONS);
    return `大多${dom ? `以「${dom}」为主` : "有记录"}，有${pa}天疼痛信号，值得放慢一点。`;
  }
  return "本周有身体信号记录，温柔对待自己。";
}

function buildWeekXiaolinCare(deduped, averageScore, extremeLine) {
  const dayCount = deduped.length;
  const ins = countDaysWithValue(deduped, "sleep", "睡不着");
  const pa = countDaysWithValue(deduped, "signal", "疼了");
  if (averageScore >= 70 && !extremeLine) {
    return "这周大多数时候你在好好照顾自己，节奏不错，继续保持这份觉察。";
  }
  if (ins && pa) {
    return `本周大多数时候你在好好照顾自己。那${ins}天失眠和${pa}天疼痛，身体在提醒你留意，下周可以睡早一点、疼了就停一停。`;
  }
  if (ins) {
    return `本周大多数时候你在好好照顾自己。有${ins}天睡眠偏吃力，身体在提醒你留意休息窗口。`;
  }
  if (pa) {
    return `本周大多数时候你在好好照顾自己。有${pa}天疼痛信号，记得给身体多一点缓冲。`;
  }
  if (countDaysWithValue(deduped, "sport", "动过头了")) {
    return "本周你在动与歇之间找平衡。有过运动偏猛的日子，记得穿插恢复，下周更轻松一点。";
  }
  return `这周你记录了 ${dayCount} 天的身体边界，平均分在 ${averageScore} 分左右。慢慢调整，一步一步来。`;
}

/**
 * 近七日（含今天）：范围内按天取末条，再算三维度均分与文案
 */
function buildSevenDaySummary(allRecords, now) {
  const { start, end } = getLast7DayRange(now || new Date());
  const inRange = filterRecordsInRange(allRecords, start, end);
  const deduped = pickLastRecordPerDay(inRange);
  if (!deduped.length) {
    return {
      hasSevenDay: false,
      sleepSevenLabel: "—",
      sportSevenLabel: "—",
      signalSevenLabel: "—",
      sleepSevenWarn: "",
      sportSevenWarn: "",
      signalSevenWarn: "",
      sleepSevenBar: "width: 0%;",
      sportSevenBar: "width: 0%;",
      signalSevenBar: "width: 0%;",
    };
  }
  const sleepScores = deduped.map((r) => dimScore(r, "sleep"));
  const sportScores = deduped.map((r) => dimScore(r, "sport"));
  const signalScores = deduped.map((r) => dimScore(r, "signal"));
  const avgS = average(sleepScores);
  const avgP = average(sportScores);
  const avgG = average(signalScores);
  const insAny = deduped.some((r) => r.sleep === "睡不着");
  const ovAny = deduped.some((r) => r.sport === "动过头了");
  const paAny = deduped.some((r) => r.signal === "疼了");
  const insDays = countDaysWithValue(deduped, "sleep", "睡不着");
  const paDays = countDaysWithValue(deduped, "signal", "疼了");
  const ovDays = countDaysWithValue(deduped, "sport", "动过头了");
  return {
    hasSevenDay: true,
    sleepSevenLabel: labelSleep7Day(avgS),
    sportSevenLabel: labelSport7Day(avgP),
    signalSevenLabel: labelSignal7Day(avgG),
    sleepSevenWarn: insAny ? `⚠️ 有过${insDays}天失眠` : "",
    sportSevenWarn: ovAny ? `⚠️ 有过${ovDays}天过载` : "",
    signalSevenWarn: paAny ? `⚠️ 有过${paDays}天疼痛` : "",
    sleepSevenBar: `width: ${barWidthFromAvg(avgS)}%;`,
    sportSevenBar: `width: ${barWidthFromAvg(avgP)}%;`,
    signalSevenBar: `width: ${barWidthFromAvg(avgG)}%;`,
  };
}

function buildWeekReportPayload(allRecords, weekStart, weekEnd) {
  const weekRaw = filterRecordsInRange(allRecords, weekStart, weekEnd);
  const deduped = pickLastRecordPerDay(weekRaw);
  if (!deduped.length) {
    return {
      hasRecords: false,
      deduped: [],
      dayCount: 0,
      averageScore: 0,
      baseStatusTitle: "",
      finalStatusTitle: "",
      statusDesc: "",
      extremeTypeCount: 0,
      extremeLine: "",
      sleepNarrative: "",
      sportNarrative: "",
      signalNarrative: "",
      totalSubmits: weekRaw.length,
    };
  }
  const dayCount = deduped.length;
  const totalScore = deduped.reduce((s, r) => s + getRecordScore(r), 0);
  const averageScore = Math.round(totalScore / dayCount);
  const base = getWeekStatus(averageScore);
  const extremeTypeCount = countExtremeTypesInRecords(deduped);
  const finalTitle = applyDowngradeStatus(base.title, extremeTypeCount);
  const extremeLine = buildWeekExtremeLine(deduped);
  return {
    hasRecords: true,
    deduped,
    dayCount,
    averageScore,
    baseStatusTitle: base.title,
    finalStatusTitle: finalTitle,
    statusDesc: statusDescForTitle(finalTitle),
    extremeTypeCount,
    extremeLine,
    sleepNarrative: buildSleepNarrative(deduped),
    sportNarrative: buildSportNarrative(deduped),
    signalNarrative: buildSignalNarrative(deduped),
    careText: buildWeekXiaolinCare(deduped, averageScore, extremeLine),
    totalSubmits: weekRaw.length,
  };
}

module.exports = {
  pickLastRecordPerDay,
  filterRecordsInRange,
  getWeekRangeContaining,
  getLast7DayRange,
  buildSevenDaySummary,
  buildWeekReportPayload,
  parseDateKeyToDate,
  SLEEP_OPTIONS,
  SPORT_OPTIONS,
  SIGNAL_OPTIONS,
};
