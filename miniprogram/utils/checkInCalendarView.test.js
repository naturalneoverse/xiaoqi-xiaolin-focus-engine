"use strict";

const v = require("./checkInCalendarView");

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

const map = v.buildCheckedMap(["2025-06-01", "2025-06-22"]);
assert(map["2025-06-22"], "checked map");

const cells = v.buildMonthCells(2025, 6, map, "2025-06-22");
const inMonth = cells.filter((c) => c.inMonth);
assert(inMonth.length === 30, "june days");
assert(inMonth.find((c) => c.dateKey === "2025-06-22").isChecked, "checked cell");
assert(inMonth.find((c) => c.dateKey === "2025-06-22").isToday, "today cell");

assert(v.countCheckInsInMonth(["2025-06-01", "2025-06-22", "2025-05-01"], 2025, 6) === 2, "month count");

const shifted = v.shiftMonth(2025, 1, -1);
assert(shifted.year === 2024 && shifted.month === 12, "shift month");

console.log("[checkInCalendarView.test] OK");
