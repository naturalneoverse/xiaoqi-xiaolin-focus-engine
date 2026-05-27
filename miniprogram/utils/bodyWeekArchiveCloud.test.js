/**
 * 运行：node miniprogram/utils/bodyWeekArchiveCloud.test.js
 */
"use strict";

const assert = require("assert");
const C = require("../config/bodyWeekArchiveConstants");
const { pickPreferredEntry } = require("./bodyWeekArchiveCloud");

const base = {
  weekKey: "2026-05-19",
  statsHash: "h1",
  bullets: [],
  statusDesc: "x",
  careText: "y",
  finalStatusTitle: "身心满格",
  validDayCount: 5,
};

const localOpen = Object.assign({}, base, {
  status: C.ARCHIVE_STATUS.OPEN,
  source: C.ARCHIVE_SOURCE.MODEL,
  updatedAt: "2026-05-27T10:00:00.000Z",
});

const cloudClosed = Object.assign({}, base, {
  status: C.ARCHIVE_STATUS.CLOSED,
  source: C.ARCHIVE_SOURCE.MODEL,
  updatedAt: "2026-05-26T10:00:00.000Z",
  closedAt: "2026-05-26T10:00:00.000Z",
});

assert.strictEqual(pickPreferredEntry(localOpen, cloudClosed).status, C.ARCHIVE_STATUS.CLOSED);

const newerOpen = Object.assign({}, localOpen, { updatedAt: "2026-05-28T10:00:00.000Z" });
const olderOpen = Object.assign({}, localOpen, { updatedAt: "2026-05-25T10:00:00.000Z" });
assert.strictEqual(pickPreferredEntry(olderOpen, newerOpen).updatedAt, newerOpen.updatedAt);

console.log("[bodyWeekArchiveCloud.test] OK");
