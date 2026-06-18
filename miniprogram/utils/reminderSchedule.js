function pad2(n) {
  return String(n).padStart(2, "0");
}

function ymdOfDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** YYYY-MM-DD → { y, m, d }，非法返回 null */
function parseYMD(ymd) {
  const s = String(ymd || "").trim();
  const segs = s.split("-").map(Number);
  if (segs.length !== 3 || segs.some((n) => !Number.isFinite(n))) return null;
  const [y, m, d] = segs;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

function ymdOfParts(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/**
 * 闭区间 [startYMD, endYMD] 内每一天（含首尾）；跨月/跨年由 setDate(+1) 处理。
 * @param {string} startYMD
 * @param {string} endYMD
 * @returns {string[]}
 */
function enumerateDateRangeYMD(startYMD, endYMD) {
  const start = parseYMD(startYMD);
  const end = parseYMD(endYMD);
  if (!start || !end) return [];

  const startKey = ymdOfParts(start.y, start.m, start.d);
  const endKey = ymdOfParts(end.y, end.m, end.d);
  if (startKey > endKey) return [];

  const out = [];
  const cur = new Date(start.y, start.m - 1, start.d, 12, 0, 0, 0);
  const endDate = new Date(end.y, end.m - 1, end.d, 12, 0, 0, 0);

  while (cur.getTime() <= endDate.getTime()) {
    out.push(ymdOfDate(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/**
 * 日历日 + HH:mm → 本地时区 Date（与 addPhoneCalendar startTime 一致）
 */
function localDateTimeFromYMDAndHM(ymd, hour, minute) {
  const p = parseYMD(ymd);
  if (!p) return null;
  const d = new Date(p.y, p.m - 1, p.d, hour, minute, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * 保留触发时刻不早于 now+1min 的日期
 */
function filterFutureReminderDays(days, hour, minute, nowMs) {
  const minMs = (nowMs != null ? nowMs : Date.now()) + 60 * 1000;
  return (days || []).filter((ymd) => {
    const fire = localDateTimeFromYMDAndHM(ymd, hour, minute);
    return fire && fire.getTime() >= minMs;
  });
}

/**
 * 仅按「当日时间」判断：若所选时刻不晚于当前系统时间，则第一次提醒落在「明天」同一时刻；否则为「今天」。
 * @param {string} timeHHmm 如 09:30
 * @returns {string} YYYY-MM-DD
 */
function computeNextReminderDateYMD(timeHHmm) {
  const t = String(timeHHmm || "").trim();
  if (!t) return "";
  const segs = t.split(":");
  const h = Number(segs[0]);
  const m = Number(segs[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  const now = new Date();
  const pick = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  if (pick.getTime() <= now.getTime()) {
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, h, m, 0, 0);
    return ymdOfDate(next);
  }
  return ymdOfDate(now);
}

const FREQ_SINGLE = "单次";
const FREQ_START_END = "起止各一次";
const FREQ_DAILY = "每天";
const REMINDER_FREQ_OPTIONS = [FREQ_SINGLE, FREQ_START_END, FREQ_DAILY];

function normalizeReminderFrequency(f) {
  const s = String(f || "").trim();
  if (s === FREQ_DAILY) return FREQ_DAILY;
  if (s === FREQ_START_END) return FREQ_START_END;
  if (s === "不重复" || s === FREQ_SINGLE) return FREQ_SINGLE;
  return FREQ_SINGLE;
}

function reminderFrequencyIndex(freq) {
  const f = normalizeReminderFrequency(freq);
  const idx = REMINDER_FREQ_OPTIONS.indexOf(f);
  return idx >= 0 ? idx : 0;
}

/**
 * 单次提醒（方案 Y）：起始日优先；起始时刻已过则用结束日；区间内再无则空
 */
function computeSingleReminderDayYMD(startYMD, endYMD, timeHHmm, nowMs) {
  const start = String(startYMD || "").trim();
  if (!start || start === "未设置") return "";
  const end = String(endYMD || "").trim();
  const parts = String(timeHHmm || "").trim().split(":");
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return "";

  const minMs = (nowMs != null ? nowMs : Date.now()) + 60 * 1000;
  const tryDay = (ymd) => {
    const fire = localDateTimeFromYMDAndHM(ymd, hour, minute);
    return fire && fire.getTime() >= minMs ? ymd : "";
  };

  const atStart = tryDay(start);
  if (atStart) return atStart;

  const effectiveEnd = end && end !== "未设置" ? end : start;
  if (effectiveEnd !== start) {
    const atEnd = tryDay(effectiveEnd);
    if (atEnd) return atEnd;
  }

  const rangeDays = enumerateDateRangeYMD(start, effectiveEnd);
  const future = filterFutureReminderDays(rangeDays, hour, minute, nowMs);
  return future.length ? future[future.length - 1] : "";
}

/** 起止各一次：起始日与结束日各一条；同日合并为一条 */
function computeStartEndPairReminderDays(startYMD, endYMD, timeHHmm, nowMs) {
  const start = String(startYMD || "").trim();
  if (!start || start === "未设置") return [];
  const endRaw = String(endYMD || "").trim();
  const effectiveEnd = endRaw && endRaw !== "未设置" ? endRaw : start;
  const parts = String(timeHHmm || "").trim().split(":");
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return [];

  const unique = start === effectiveEnd ? [start] : [start, effectiveEnd];
  return filterFutureReminderDays(unique, hour, minute, nowMs);
}

function computeReminderPreview(startYMD, endYMD, timeHHmm, frequency, statusText, nowMs) {
  if (statusText === "已完成" || statusText === "已取消") {
    return { days: [], label: "" };
  }
  const t = String(timeHHmm || "").trim();
  const start = String(startYMD || "").trim();
  if (!t || !start || start === "未设置") {
    return { days: [], label: "" };
  }
  const freq = normalizeReminderFrequency(frequency);
  const end = String(endYMD || "").trim();
  let days = [];
  if (freq === FREQ_DAILY) {
    const effectiveEnd = end && end !== "未设置" ? end : start;
    const parts = t.split(":");
    const hour = Number(parts[0]);
    const minute = Number(parts[1]);
    days = filterFutureReminderDays(
      enumerateDateRangeYMD(start, effectiveEnd),
      hour,
      minute,
      nowMs,
    );
  } else if (freq === FREQ_START_END) {
    days = computeStartEndPairReminderDays(start, end, t, nowMs);
  } else {
    const one = computeSingleReminderDayYMD(start, end, t, nowMs);
    days = one ? [one] : [];
  }
  return { days, label: formatNextReminderDisplay(days, t) };
}

function reminderDisplayText(timeHHmm, freq) {
  if (!String(timeHHmm || "").trim()) return "未设置";
  return `${String(timeHHmm).trim()}（${normalizeReminderFrequency(freq)}）`;
}

/** 任务详情：下次提醒展示，如「下次提醒：5月23日 09:30」或「5月22日、5月30日 09:30」 */
function formatNextReminderDisplay(dayYMDs, timeHHmm) {
  const t = String(timeHHmm || "").trim();
  const list = Array.isArray(dayYMDs) ? dayYMDs.filter(Boolean) : [];
  if (!t || !list.length) return "";
  const dateParts = list
    .map((ymd) => {
      const p = parseYMD(ymd);
      return p ? `${p.m}月${p.d}日` : "";
    })
    .filter(Boolean);
  if (!dateParts.length) return "";
  if (dateParts.length === 1) {
    return `下次提醒：${dateParts[0]} ${t}`;
  }
  return `下次提醒：${dateParts.join("、")} ${t}`;
}

/** @deprecated 使用 formatNextReminderDisplay */
function formatNextReminderLabel(reminderDateYMD, timeHHmm) {
  return formatNextReminderDisplay(reminderDateYMD ? [reminderDateYMD] : [], timeHHmm);
}

function formatMdFromYMD(ymd) {
  const p = parseYMD(ymd);
  return p ? `${p.m}/${p.d}` : "";
}

function formatReminderDateRangeMd(startYMD, endYMD) {
  const start = formatMdFromYMD(startYMD);
  if (!start) return "";
  const endRaw = String(endYMD || "").trim();
  const end = endRaw ? formatMdFromYMD(endRaw) : "";
  if (!end || end === start) return start;
  return `${start}–${end}`;
}

/**
 * 任务详情提醒区浏览态一行摘要，如「提醒：每天 15:22 · 6/18–6/21」
 */
function formatReminderSummaryLine(fields) {
  const statusText = fields && fields.statusText;
  if (statusText === "已完成" || statusText === "已取消") {
    return "提醒：已停止";
  }
  const time = String((fields && fields.reminderTime) || "").trim();
  if (!time) return "提醒：未设置";
  const start = String((fields && fields.reminderStartDate) || "").trim();
  if (!start || start === "未设置") return "提醒：未设置";
  const freq = normalizeReminderFrequency(fields && fields.reminderFrequency);
  const datePart = formatReminderDateRangeMd(start, fields && fields.reminderEndDate);
  return `提醒：${freq} ${time} · ${datePart}`;
}

module.exports = {
  FREQ_SINGLE,
  FREQ_START_END,
  FREQ_DAILY,
  REMINDER_FREQ_OPTIONS,
  computeNextReminderDateYMD,
  normalizeReminderFrequency,
  reminderFrequencyIndex,
  computeSingleReminderDayYMD,
  computeStartEndPairReminderDays,
  computeReminderPreview,
  reminderDisplayText,
  formatNextReminderDisplay,
  formatNextReminderLabel,
  formatReminderSummaryLine,
  formatReminderDateRangeMd,
  parseYMD,
  enumerateDateRangeYMD,
  localDateTimeFromYMDAndHM,
  filterFutureReminderDays,
};
