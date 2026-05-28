/**
 * 身体边界周报 · 存档与成文加载（方案 D，阶段 4）
 */

const C = require("../config/bodyWeekArchiveConstants");
const bodyStats = require("./bodyStats");
const momentScore = require("./momentScore");
const mascotCopyStats = require("./mascotCopyStats");
const mascotCopyClient = require("./mascotCopyClient");
const bodyWeekArchive = require("./bodyWeekArchive");
const bodyWeekBullets = require("./bodyWeekBullets");
const bodyWeekCareClient = require("./bodyWeekCareClient");

/**
 * @typedef {"archive_readonly"|"archive_hit"|"rule_sparse"|"refresh_open"|"close_week"} BodyWeekCareMode
 */

/**
 * @param {string} weekKey
 * @param {object} rep
 * @param {import("../config/bodyWeekArchiveConstants").BodyWeekArchiveEntry|null} entry
 * @param {Date} [now]
 */
function resolveCarePlan(weekKey, rep, entry, now) {
  const statsHash = bodyWeekBullets.buildBodyWeekStatsHash(rep);
  const validDayCount = rep.hasRecords ? rep.dayCount || 0 : 0;
  const sparse = validDayCount < C.SPARSE_MIN_VALID_DAYS;
  const closingDue = bodyWeekArchive.shouldCloseWeek(weekKey, now || new Date());

  if (entry && bodyWeekArchive.isWeekClosed(entry)) {
    return {
      mode: "archive_readonly",
      statsHash,
      validDayCount,
      sparse,
      closingDue,
      entry,
    };
  }

  if (closingDue) {
    return {
      mode: "close_week",
      statsHash,
      validDayCount,
      sparse,
      closingDue,
      entry: entry || null,
    };
  }

  if (entry && entry.statsHash === statsHash && entry.statusDesc && entry.careText) {
    return {
      mode: "archive_hit",
      statsHash,
      validDayCount,
      sparse,
      closingDue,
      entry,
    };
  }

  if (sparse) {
    return {
      mode: "rule_sparse",
      statsHash,
      validDayCount,
      sparse,
      closingDue,
      entry: entry || null,
    };
  }

  return {
    mode: "refresh_open",
    statsHash,
    validDayCount,
    sparse,
    closingDue,
    entry: entry || null,
  };
}

/**
 * @param {object} stats
 * @param {object} rep
 */
function buildRuleCareCopy(stats, rep) {
  const local = mascotCopyClient.composeLocalCopy("body_week", stats);
  let careText = local.text || "";
  const fallback = bodyStats.buildWeekXiaolinCare(
    rep.deduped || [],
    rep.averageScore || 0,
    rep.extremeLine || "",
  );
  if (fallback && C.findForbiddenUserCopyHits(fallback).ok) {
    careText = fallback;
  }
  if (!careText || !C.findForbiddenUserCopyHits(careText).ok) {
    careText = "小麟在这儿陪着您。这一周，先照顾好此刻的自己。";
  }
  return {
    statusDesc: rep.statusDesc || "",
    careText,
  };
}

/**
 * @param {object} params
 * @returns {import("../config/bodyWeekArchiveConstants").BodyWeekArchiveEntry}
 */
function buildArchiveEntry(params) {
  const {
    weekKey,
    statsHash,
    status,
    source,
    rep,
    bullets,
    statusDesc,
    careText,
  } = params;
  return {
    weekKey,
    statsHash,
    status,
    closedAt: status === C.ARCHIVE_STATUS.CLOSED ? new Date().toISOString() : "",
    bullets: bullets || [],
    statusDesc: statusDesc || "",
    careText: careText || "",
    source,
    finalStatusTitle: rep.finalStatusTitle || "",
    extremeLine: rep.extremeLine || "",
    validDayCount: rep.dayCount || 0,
    updatedAt: new Date().toISOString(),
  };
}

function copyFromArchive(entry) {
  return {
    statusDesc: entry.statusDesc || "",
    careText: entry.careText || "",
  };
}

/**
 * 本周进行中已模型成文且 hash 未变 → 周一后只升格为 closed，不再调云
 * @param {import("../config/bodyWeekArchiveConstants").BodyWeekArchiveEntry|null} entry
 * @param {string} statsHash
 */
function canPromoteOpenModelClosure(entry, statsHash) {
  return !!(
    entry &&
    entry.status === C.ARCHIVE_STATUS.OPEN &&
    entry.source === C.ARCHIVE_SOURCE.MODEL &&
    entry.statsHash === statsHash &&
    entry.statusDesc &&
    entry.careText
  );
}

/**
 * @param {string} weekKey
 * @param {import("../config/bodyWeekArchiveConstants").BodyWeekArchiveEntry} entry
 * @param {object} rep
 */
function promoteOpenEntryToClosed(weekKey, entry, rep) {
  const closed = buildArchiveEntry({
    weekKey,
    statsHash: entry.statsHash,
    status: C.ARCHIVE_STATUS.CLOSED,
    source: C.ARCHIVE_SOURCE.MODEL,
    rep,
    bullets: entry.bullets || [],
    statusDesc: entry.statusDesc,
    careText: entry.careText,
  });
  return bodyWeekArchive.putEntry(weekKey, closed);
}

/**
 * @param {object} ctx
 * @param {string} ctx.weekKey
 * @param {object} ctx.rep
 * @param {object} ctx.stats
 * @param {BodyWeekCareMode} ctx.planMode
 * @param {boolean} ctx.archiveClosed
 * @returns {Promise<{ statusDesc: string, careText: string, persisted: boolean }>}
 */
function buildPrevWeekRep(allRecords, weekStart, weekEnd) {
  if (!allRecords || !weekStart || !weekEnd) return null;
  const prevStart = new Date(weekStart);
  prevStart.setDate(prevStart.getDate() - 7);
  const prevEnd = new Date(weekEnd);
  prevEnd.setDate(prevEnd.getDate() - 7);
  return bodyStats.buildWeekReportPayload(allRecords, prevStart, prevEnd);
}

function runCarePipeline(ctx) {
  const { weekKey, rep, stats, planMode, archiveClosed } = ctx;
  const prevRep = buildPrevWeekRep(ctx.allRecords, ctx.weekStart, ctx.weekEnd);
  const bullets = bodyWeekBullets.buildBodyWeekBullets(rep, stats, prevRep);
  const statsHash = bodyWeekBullets.buildBodyWeekStatsHash(rep);
  const targetStatus = archiveClosed ? C.ARCHIVE_STATUS.CLOSED : C.ARCHIVE_STATUS.OPEN;

  if (planMode === "rule_sparse") {
    const copy = buildRuleCareCopy(stats, rep);
    const entry = buildArchiveEntry({
      weekKey,
      statsHash,
      status: targetStatus,
      source: C.ARCHIVE_SOURCE.RULE,
      rep,
      bullets,
      statusDesc: copy.statusDesc,
      careText: copy.careText,
    });
    bodyWeekArchive.putEntry(weekKey, entry);
    return Promise.resolve(
      Object.assign({ persisted: true }, copy),
    );
  }

  const instant = buildRuleCareCopy(stats, rep);

  return bodyWeekCareClient
    .generateBodyWeekCare({
      bullets,
      weekKey,
      dayCount: rep.dayCount,
      finalStatusTitle: rep.finalStatusTitle,
    })
    .then((cloud) => {
      if (cloud.ok) {
        const entry = buildArchiveEntry({
          weekKey,
          statsHash,
          status: targetStatus,
          source: C.ARCHIVE_SOURCE.MODEL,
          rep,
          bullets,
          statusDesc: cloud.statusDesc,
          careText: cloud.careText,
        });
        const saved = bodyWeekArchive.putEntry(weekKey, entry);
        if (!saved.ok) {
          console.warn("[bodyWeekReportCare] putEntry model", saved.errors);
        }
        return {
          statusDesc: cloud.statusDesc,
          careText: cloud.careText,
          persisted: saved.ok,
          source: C.ARCHIVE_SOURCE.MODEL,
        };
      }

      console.warn("[bodyWeekReportCare] model failed", cloud.errCode);
      const entry = buildArchiveEntry({
        weekKey,
        statsHash,
        status: targetStatus,
        source: C.ARCHIVE_SOURCE.RULE_FALLBACK,
        rep,
        bullets,
        statusDesc: instant.statusDesc,
        careText: instant.careText,
      });
      bodyWeekArchive.putEntry(weekKey, entry);
      return Object.assign({ persisted: true, source: C.ARCHIVE_SOURCE.RULE_FALLBACK }, instant);
    })
    .catch((e) => {
      console.error("[bodyWeekReportCare] pipeline", e);
      const entry = buildArchiveEntry({
        weekKey,
        statsHash,
        status: targetStatus,
        source: C.ARCHIVE_SOURCE.RULE_FALLBACK,
        rep,
        bullets,
        statusDesc: instant.statusDesc,
        careText: instant.careText,
      });
      bodyWeekArchive.putEntry(weekKey, entry);
      return Object.assign({ persisted: true, source: C.ARCHIVE_SOURCE.RULE_FALLBACK }, instant);
    });
}

module.exports = {
  resolveCarePlan,
  buildRuleCareCopy,
  buildArchiveEntry,
  copyFromArchive,
  canPromoteOpenModelClosure,
  promoteOpenEntryToClosed,
  runCarePipeline,
};
