const dailyCheckIn = require("./dailyCheckIn");

const WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function todayDateKey() {
  return dailyCheckIn.dateKeyFromDate(new Date());
}

function buildCheckedMap(dateKeys) {
  const map = Object.create(null);
  (Array.isArray(dateKeys) ? dateKeys : []).forEach((k) => {
    const n = dailyCheckIn.normalizeDateKey(k);
    if (n) map[n] = true;
  });
  return map;
}

function countCheckInsInMonth(dateKeys, year, month) {
  const y = Number(year);
  const m = Number(month);
  if (!y || !m) return 0;
  const prefix = `${y}-${pad2(m)}-`;
  return (Array.isArray(dateKeys) ? dateKeys : []).filter((k) => {
    const n = dailyCheckIn.normalizeDateKey(k);
    return n && n.startsWith(prefix);
  }).length;
}

function formatMonthTitle(year, month) {
  return `${year}年${month}月`;
}

/**
 * 生成月历格（周一为首列）
 * @returns {{ day: number, dateKey: string, inMonth: boolean, isToday: boolean, isChecked: boolean }[]}
 */
function buildMonthCells(year, month, checkedMap, todayKey) {
  const y = Number(year);
  const m = Number(month);
  const map = checkedMap || Object.create(null);
  const today = todayKey || todayDateKey();
  const first = new Date(y, m - 1, 1);
  const daysInMonth = new Date(y, m, 0).getDate();
  const leading = (first.getDay() + 6) % 7;
  const cells = [];

  for (let i = 0; i < leading; i += 1) {
    cells.push({ day: 0, dateKey: "", inMonth: false, isToday: false, isChecked: false });
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    const dateKey = `${y}-${pad2(m)}-${pad2(d)}`;
    cells.push({
      day: d,
      dateKey,
      inMonth: true,
      isToday: dateKey === today,
      isChecked: !!map[dateKey],
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ day: 0, dateKey: "", inMonth: false, isToday: false, isChecked: false });
  }
  return cells;
}

function loadCheckInCalendarState(viewYear, viewMonth) {
  const keys = dailyCheckIn.readCheckInDateKeys();
  const now = new Date();
  const year = Number(viewYear) > 0 ? Number(viewYear) : now.getFullYear();
  const month = Number(viewMonth) > 0 ? Number(viewMonth) : now.getMonth() + 1;
  const checkedMap = buildCheckedMap(keys);
  return {
    dateKeys: keys,
    checkedMap,
    totalDays: keys.length,
    monthDays: countCheckInsInMonth(keys, year, month),
    monthTitle: formatMonthTitle(year, month),
    todayKey: todayDateKey(),
    cells: buildMonthCells(year, month, checkedMap, todayDateKey()),
    weekLabels: WEEK_LABELS,
    viewYear: year,
    viewMonth: month,
  };
}

function shiftMonth(year, month, delta) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

module.exports = {
  WEEK_LABELS,
  todayDateKey,
  buildCheckedMap,
  countCheckInsInMonth,
  formatMonthTitle,
  buildMonthCells,
  loadCheckInCalendarState,
  shiftMonth,
};
