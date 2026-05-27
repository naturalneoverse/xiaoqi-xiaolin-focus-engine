/**
 * 身体边界周报 · 本地周存档（body_week_archive_v1）
 * 阶段 1：读写与条目校验；阶段 4 接入 body-report 加载与结案。
 */

const STORAGE_KEYS = require("../config/storageKeys");
const C = require("../config/bodyWeekArchiveConstants");

/**
 * @typedef {import("../config/bodyWeekArchiveConstants").BodyWeekArchiveEntry} BodyWeekArchiveEntry
 */

/**
 * @typedef {object} BodyWeekArchiveStore
 * @property {number} version
 * @property {Record<string, BodyWeekArchiveEntry>} weeks
 */

function emptyStore() {
  return { version: C.ARCHIVE_SCHEMA_VERSION, weeks: {} };
}

/**
 * @param {unknown} raw
 * @returns {BodyWeekArchiveStore}
 */
function normalizeStore(raw) {
  if (!raw || typeof raw !== "object") return emptyStore();
  const version =
    typeof raw.version === "number" && raw.version > 0 ? raw.version : C.ARCHIVE_SCHEMA_VERSION;
  let weeks = raw.weeks;
  if (!weeks || typeof weeks !== "object") {
    weeks = {};
    const skip = new Set(["version", "weeks"]);
    Object.keys(raw).forEach((k) => {
      if (!skip.has(k) && C.WEEK_KEY_RE.test(k)) weeks[k] = raw[k];
    });
  }
  const out = emptyStore();
  out.version = version;
  Object.keys(weeks).forEach((weekKey) => {
    const entry = normalizeEntry(weeks[weekKey], weekKey);
    if (entry) out.weeks[weekKey] = entry;
  });
  return out;
}

/**
 * @param {string} weekKey
 * @returns {boolean}
 */
function isValidWeekKey(weekKey) {
  return C.WEEK_KEY_RE.test(String(weekKey || "").trim());
}

/**
 * @param {unknown} bullet
 * @returns {{ type: string, text: string }|null}
 */
function normalizeBullet(bullet) {
  if (!bullet || typeof bullet !== "object") return null;
  const type = String(bullet.type || "").trim();
  const text = String(bullet.text || "").trim();
  if (!type || !text) return null;
  if (C.BULLET_TYPES.indexOf(type) < 0) return { type, text };
  return { type, text };
}

/**
 * @param {unknown} partial
 * @param {string} [weekKeyHint]
 * @returns {BodyWeekArchiveEntry|null}
 */
function normalizeEntry(partial, weekKeyHint) {
  if (!partial || typeof partial !== "object") return null;
  const weekKey = String(partial.weekKey || weekKeyHint || "").trim();
  if (!isValidWeekKey(weekKey)) return null;

  const statsHash = String(partial.statsHash || "").trim();
  const status = String(partial.status || C.ARCHIVE_STATUS.OPEN);
  if (C.ARCHIVE_STATUSES.indexOf(status) < 0) return null;

  const source = String(partial.source || "");
  if (C.ARCHIVE_SOURCES.indexOf(source) < 0) return null;

  const bullets = Array.isArray(partial.bullets)
    ? partial.bullets.map(normalizeBullet).filter(Boolean)
    : [];

  const entry = {
    weekKey,
    statsHash,
    status,
    closedAt: partial.closedAt != null ? String(partial.closedAt) : "",
    bullets,
    statusDesc: String(partial.statusDesc || "").trim(),
    careText: String(partial.careText || "").trim(),
    source,
    finalStatusTitle: String(partial.finalStatusTitle || "").trim(),
    extremeLine: partial.extremeLine != null ? String(partial.extremeLine) : "",
    validDayCount:
      partial.validDayCount != null && !Number.isNaN(Number(partial.validDayCount))
        ? Number(partial.validDayCount)
        : undefined,
    updatedAt: partial.updatedAt != null ? String(partial.updatedAt) : "",
  };

  if (status === C.ARCHIVE_STATUS.CLOSED && !entry.closedAt) {
    entry.closedAt = new Date().toISOString();
  }
  if (!entry.updatedAt) entry.updatedAt = new Date().toISOString();

  return entry;
}

/**
 * @param {BodyWeekArchiveEntry} entry
 * @returns {{ ok: boolean, errors: string[] }}
 */
function validateEntry(entry) {
  const errors = [];
  if (!entry || typeof entry !== "object") {
    return { ok: false, errors: ["entry_missing"] };
  }
  if (!isValidWeekKey(entry.weekKey)) errors.push("invalid_weekKey");
  if (!entry.statsHash) errors.push("missing_statsHash");
  if (C.ARCHIVE_STATUSES.indexOf(entry.status) < 0) errors.push("invalid_status");
  if (C.ARCHIVE_SOURCES.indexOf(entry.source) < 0) errors.push("invalid_source");
  if (!entry.finalStatusTitle) errors.push("missing_finalStatusTitle");
  if (entry.status === C.ARCHIVE_STATUS.CLOSED && !entry.closedAt) errors.push("missing_closedAt");

  const isSparseWeek =
    entry.validDayCount != null && entry.validDayCount < C.SPARSE_MIN_VALID_DAYS;
  const isRuleSource =
    entry.source === C.ARCHIVE_SOURCE.RULE || entry.source === C.ARCHIVE_SOURCE.RULE_FALLBACK;
  if (!isSparseWeek && !isRuleSource) {
    if (!entry.statusDesc) errors.push("missing_statusDesc");
    if (!entry.careText) errors.push("missing_careText");
  }
  if (entry.source === C.ARCHIVE_SOURCE.MODEL) {
    const lenS = C.checkCopyLength("statusDesc", entry.statusDesc);
    if (!lenS.ok) errors.push(lenS.reason || "statusDesc_length");
    const lenC = C.checkCopyLength("careText", entry.careText);
    if (!lenC.ok) errors.push(lenC.reason || "careText_length");
  }

  const forbidden = findForbiddenInEntry(entry);
  if (!forbidden.ok) errors.push(...forbidden.errors);

  return { ok: errors.length === 0, errors };
}

/**
 * @param {BodyWeekArchiveEntry} entry
 */
function findForbiddenInEntry(entry) {
  const errors = [];
  const fields = [
    ["statusDesc", entry.statusDesc],
    ["careText", entry.careText],
    ["finalStatusTitle", entry.finalStatusTitle],
    ["extremeLine", entry.extremeLine],
  ];
  fields.forEach(([name, text]) => {
    const hit = C.findForbiddenUserCopyHits(text);
    if (!hit.ok) errors.push(`forbidden_${name}:${hit.hits.join(",")}`);
  });
  (entry.bullets || []).forEach((b, i) => {
    const hit = C.findForbiddenUserCopyHits(b.text);
    if (!hit.ok) errors.push(`forbidden_bullet_${i}:${hit.hits.join(",")}`);
  });
  return { ok: errors.length === 0, errors };
}

/**
 * @returns {BodyWeekArchiveStore}
 */
function readArchiveStore() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEYS.BODY_WEEK_ARCHIVE_V1);
    return normalizeStore(raw);
  } catch (e) {
    console.error("[bodyWeekArchive] read", e);
    return emptyStore();
  }
}

/**
 * @param {BodyWeekArchiveStore} store
 */
function writeArchiveStore(store) {
  const normalized = normalizeStore(store);
  wx.setStorageSync(STORAGE_KEYS.BODY_WEEK_ARCHIVE_V1, normalized);
  return normalized;
}

/**
 * @param {string} weekKey
 * @returns {BodyWeekArchiveEntry|null}
 */
function getEntry(weekKey) {
  const key = String(weekKey || "").trim();
  if (!isValidWeekKey(key)) return null;
  const store = readArchiveStore();
  return store.weeks[key] || null;
}

/**
 * @param {string} weekKey
 * @param {BodyWeekArchiveEntry} entry
 * @returns {{ ok: boolean, errors?: string[], entry?: BodyWeekArchiveEntry }}
 */
function putEntry(weekKey, entry) {
  const key = String(weekKey || "").trim();
  const normalized = normalizeEntry(Object.assign({}, entry, { weekKey: key }), key);
  if (!normalized) return { ok: false, errors: ["normalize_failed"] };
  const v = validateEntry(normalized);
  if (!v.ok) return { ok: false, errors: v.errors };

  const store = readArchiveStore();
  normalized.updatedAt = new Date().toISOString();
  store.weeks[key] = normalized;
  writeArchiveStore(store);
  try {
    const cloud = require("./bodyWeekArchiveCloud");
    cloud.schedulePushEntry(normalized);
  } catch (e) {
    console.warn("[bodyWeekArchive] schedulePush", e);
  }
  return { ok: true, entry: normalized };
}

/**
 * @param {BodyWeekArchiveEntry|null|undefined} entry
 */
function isWeekClosed(entry) {
  return !!(entry && entry.status === C.ARCHIVE_STATUS.CLOSED);
}

/**
 * 周一 0 点（本地）之后，上周自然周可结案（阶段 4 调用）。
 * @param {string} weekKey 目标周周一
 * @param {Date} [now]
 */
function shouldCloseWeek(weekKey, now) {
  const key = String(weekKey || "").trim();
  if (!isValidWeekKey(key)) return false;
  const ref = now instanceof Date ? now : new Date();
  const parts = key.split("-").map(Number);
  const weekMon = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
  const nextMon = new Date(weekMon);
  nextMon.setDate(nextMon.getDate() + 7);
  return ref.getTime() >= nextMon.getTime();
}

module.exports = {
  emptyStore,
  normalizeStore,
  normalizeEntry,
  validateEntry,
  isValidWeekKey,
  readArchiveStore,
  writeArchiveStore,
  getEntry,
  putEntry,
  isWeekClosed,
  shouldCloseWeek,
  findForbiddenInEntry,
};
