/**
 * 身体边界周报存档 · 云同步（阶段 7.1）
 * 登录/启动时拉取合并；本地 putEntry 成功后异步上传。
 */

const bodyWeekArchive = require("./bodyWeekArchive");
const C = require("../config/bodyWeekArchiveConstants");

let _pushTimer = null;
let _pullInflight = null;

function isCloudCallable() {
  return !!(wx.cloud && typeof wx.cloud.callFunction === "function");
}

function entryTimeMs(entry) {
  const raw = (entry && (entry.updatedAt || entry.closedAt)) || "";
  const t = Date.parse(String(raw));
  return Number.isFinite(t) ? t : 0;
}

/**
 * 合并单周：closed 优先；同为 open 取 updatedAt 较新
 * @param {object|null} local
 * @param {object|null} cloud
 */
function pickPreferredEntry(local, cloud) {
  if (!local) return cloud;
  if (!cloud) return local;
  if (local.status === C.ARCHIVE_STATUS.CLOSED && cloud.status !== C.ARCHIVE_STATUS.CLOSED) {
    return local;
  }
  if (cloud.status === C.ARCHIVE_STATUS.CLOSED && local.status !== C.ARCHIVE_STATUS.CLOSED) {
    return cloud;
  }
  return entryTimeMs(cloud) >= entryTimeMs(local) ? cloud : local;
}

/**
 * @param {Record<string, object>} cloudWeeks
 */
function mergeCloudWeeksIntoLocal(cloudWeeks) {
  if (!cloudWeeks || typeof cloudWeeks !== "object") return { merged: 0 };
  const store = bodyWeekArchive.readArchiveStore();
  let merged = 0;
  Object.keys(cloudWeeks).forEach((weekKey) => {
    if (!C.WEEK_KEY_RE.test(weekKey)) return;
    const cloudEntry = bodyWeekArchive.normalizeEntry(cloudWeeks[weekKey], weekKey);
    if (!cloudEntry) return;
    const localEntry = store.weeks[weekKey] || null;
    const picked = pickPreferredEntry(localEntry, cloudEntry);
    if (!picked) return;
    if (
      !localEntry ||
      picked.status !== localEntry.status ||
      picked.statsHash !== localEntry.statsHash ||
      entryTimeMs(picked) > entryTimeMs(localEntry)
    ) {
      store.weeks[weekKey] = picked;
      merged += 1;
    }
  });
  if (merged > 0) {
    try {
      bodyWeekArchive.writeArchiveStore(store);
    } catch (e) {
      console.warn("[bodyWeekArchiveCloud] writeArchiveStore", e);
    }
  }
  return { merged };
}

function cloudEntryFromDoc(doc) {
  if (!doc) return null;
  const weekKey = String(doc.weekKey || "").trim();
  return bodyWeekArchive.normalizeEntry(doc, weekKey);
}

/**
 * @param {import("../config/bodyWeekArchiveConstants").BodyWeekArchiveEntry} entry
 */
async function pushEntryToCloud(entry) {
  if (!entry || !isCloudCallable()) return false;
  try {
    const res = await wx.cloud.callFunction({
      name: "quickstartFunctions",
      data: { type: "saveBodyWeekArchive", entry },
    });
    let raw = res && res.result;
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch (e) {
        raw = null;
      }
    }
    return !!(raw && raw.success);
  } catch (e) {
    console.warn("[bodyWeekArchiveCloud] pushEntry", e);
    return false;
  }
}

/**
 * @param {import("../config/bodyWeekArchiveConstants").BodyWeekArchiveEntry} entry
 */
function schedulePushEntry(entry) {
  if (!entry || !entry.weekKey) return;
  const snapshot = Object.assign({}, entry);
  if (_pushTimer) clearTimeout(_pushTimer);
  _pushTimer = setTimeout(() => {
    _pushTimer = null;
    pushEntryToCloud(snapshot).catch(() => {});
  }, 800);
}

/**
 * @returns {Promise<{ ok: boolean, merged: number }>}
 */
async function pullAndMergeFromCloud() {
  if (!isCloudCallable()) return { ok: false, merged: 0 };
  if (_pullInflight) return _pullInflight;

  _pullInflight = wx.cloud
    .callFunction({
      name: "quickstartFunctions",
      data: { type: "listBodyWeekArchives" },
    })
    .then((res) => {
      let raw = res && res.result;
      if (typeof raw === "string") {
        try {
          raw = JSON.parse(raw);
        } catch (e) {
          raw = null;
        }
      }
      if (!raw || !raw.success) {
        console.warn("[bodyWeekArchiveCloud] pull failed", raw && raw.errMsg);
        return { ok: false, merged: 0 };
      }
      const weeks = {};
      (raw.entries || []).forEach((doc) => {
        const entry = cloudEntryFromDoc(doc);
        if (entry) weeks[entry.weekKey] = entry;
      });
      const { merged } = mergeCloudWeeksIntoLocal(weeks);
      console.info("[bodyWeekArchiveCloud] pull merged", merged, "weeks");
      return { ok: true, merged };
    })
    .catch((e) => {
      console.warn("[bodyWeekArchiveCloud] pull", e);
      return { ok: false, merged: 0 };
    })
    .finally(() => {
      _pullInflight = null;
    });

  return _pullInflight;
}

module.exports = {
  pickPreferredEntry,
  mergeCloudWeeksIntoLocal,
  pushEntryToCloud,
  schedulePushEntry,
  pullAndMergeFromCloud,
};
