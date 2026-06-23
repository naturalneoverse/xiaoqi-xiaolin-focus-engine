"use strict";

const d = require("./dailyCheckIn");

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

assert(d.normalizeDateKey("2025-06-22") === "2025-06-22", "padded date");
assert(d.normalizeDateKey("2025/6/2") === "2025-06-02", "slash and single digit");
assert(d.normalizeDateKey("bad") === "", "invalid date");

const merged = d.mergeCheckInDateKeys(
  ["2025-06-01", "2025-06-02"],
  ["2025-06-02", "2025-06-03"],
  { dates: ["2025-06-04"] },
);
assert(merged.length === 4, "union dedupes and accepts {dates:[]} wrapper");
assert(merged[0] === "2025-06-04", "sorted descending");

const shrunk = d.mergeCheckInDateKeys(["2025-06-01"], []);
assert(shrunk.length === 1, "merge never drops on empty second list");

console.log("[dailyCheckIn.test] OK");
