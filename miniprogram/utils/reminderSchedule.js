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

function normalizeReminderFrequency(f) {
  return f === "每天" ? "每天" : "不重复";
}

function reminderDisplayText(timeHHmm, freq) {
  if (!String(timeHHmm || "").trim()) return "未设置";
  return `${String(timeHHmm).trim()}（${normalizeReminderFrequency(freq)}）`;
}

module.exports = {
  computeNextReminderDateYMD,
  normalizeReminderFrequency,
  reminderDisplayText,
  parseYMD,
  enumerateDateRangeYMD,
  localDateTimeFromYMDAndHM,
  filterFutureReminderDays,
};
