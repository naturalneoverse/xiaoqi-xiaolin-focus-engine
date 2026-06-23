"use strict";

const momentScore = require("./momentScore");

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "assertion failed");
}

assert(momentScore.presenceTierName(0, 0, 3) === "进行中", "active without created");
assert(momentScore.presenceTierName(0, 5, 2) === "进行中", "active none done");
assert(momentScore.presenceTierName(3, 5, 1) === "专注", "rate tier when done");
assert(momentScore.presenceTierName(0, 0, 0) === "暂无", "empty week");
assert(momentScore.presenceHintFor(0, 0, 2) === "", "no false no-task hint when active");

console.log("[momentScore.presence.test] OK");
